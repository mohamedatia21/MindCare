import { MCPRequest, MCPResponse } from './types.js';
import { MCPClient } from './mcp-client.js';
import { MCPRegistry } from './mcp-registry.js';
import { MCPSanitizer } from './mcp-sanitizer.js';
import { MCPInputSanitizer } from './mcp-input-sanitizer.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError, ToolExecutionError } from '../core/errors.js';
import { SafetyState } from '../core/types.js';

export class MCPPolicyGate {
  constructor(
    private client: MCPClient,
    private registry: MCPRegistry,
    private outputSanitizer: MCPSanitizer,
    private inputSanitizer: MCPInputSanitizer
  ) {}

  public async execute(
    request: Omit<MCPRequest, 'safetyState'>, 
    safetyState: SafetyState
  ): Promise<Result<MCPResponse, PolicyViolationError | ToolExecutionError>> {
    
    const serverRes = this.registry.getServer(request.serverId);
    if (!serverRes.ok) return err(serverRes.error);
    const server = serverRes.value;

    if (!server.allowedClinicalModes.includes(safetyState)) {
       return err(new PolicyViolationError(`MCP execution blocked. Server ${server.id} is not permitted in state: ${safetyState}`));
    }

    if (server.verificationStatus !== 'VERIFIED') {
       return err(new PolicyViolationError(`Unverified MCP servers are blocked in production: ${server.id}`));
    }

    const toolRes = this.registry.validateToolAllowed(request.serverId, request.toolName);
    if (!toolRes.ok) return err(toolRes.error);

    const fullRequest: MCPRequest = { ...request, safetyState };

    const inputRes = this.inputSanitizer.sanitize(fullRequest);
    if (!inputRes.ok) return err(inputRes.error);

    let response: MCPResponse;
    try {
      // Pass the server's configured timeout explicitly if the request didn't set one
      const reqWithTimeout = { ...inputRes.value, timeoutMs: inputRes.value.timeoutMs || server.timeoutMs };
      response = await this.client.executeTool(reqWithTimeout);
    } catch (error: unknown) {
       return err(new ToolExecutionError(error instanceof Error && error.message.includes('Timeout') ? 'MCP_TIMEOUT' : 'MCP_PROVIDER_ERROR'));
    }

    const sanitizedOutRes = await this.outputSanitizer.sanitize(response);
    if (!sanitizedOutRes.ok) return err(sanitizedOutRes.error);

    return ok(sanitizedOutRes.value);
  }
}
