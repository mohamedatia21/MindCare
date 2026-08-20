import { MCPServerDef } from './types.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';

export class MCPRegistry {
  private servers = new Map<string, MCPServerDef>();

  constructor() {
    // Pre-populate with Phase 4G.2 Requirements
    this.servers.set('mcp-fetch-server', {
      id: 'mcp-fetch-server',
      name: 'Vulnerable External Fetch Server',
      version: '1.1.2',
      enabled: false,
      disabledReason: 'SECURITY_VULNERABILITY_SSRF',
      trustLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      allowedTools: [],
      allowedClinicalModes: [],
      timeoutMs: 0,
      maxResponseBytes: 0,
      transport: 'stdio'
    });

    this.servers.set('mindcare-internal-fetch', {
      id: 'mindcare-internal-fetch',
      name: 'Hardened Internal Fetch Server',
      version: '1.0.0',
      enabled: true,
      trustLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      allowedTools: ['FETCH_EXTERNAL_DOCUMENT'],
      allowedClinicalModes: ['SAFE'],
      timeoutMs: 5000,
      maxResponseBytes: 5000000,
      transport: 'stdio',
      command: 'npx',
      args: ['tsx', 'src/infrastructure/mcp/internal-fetch-server.ts']
    });
  }

  public registerServer(server: MCPServerDef) {
    this.servers.set(server.id, server);
  }

  public getServer(serverId: string): Result<MCPServerDef, PolicyViolationError> {
    const server = this.servers.get(serverId);
    if (!server) return err(new PolicyViolationError(`Unknown MCP server: ${serverId}`));
    if (!server.enabled) return err(new PolicyViolationError(`MCP server disabled: ${serverId}. Reason: ${server.disabledReason || 'None'}`));
    return ok(server);
  }

  public validateToolAllowed(serverId: string, toolName: string): Result<boolean, PolicyViolationError> {
    const serverRes = this.getServer(serverId);
    if (!serverRes.ok) return err(serverRes.error);
    
    const server = serverRes.value;
    if (!server.allowedTools.includes(toolName)) {
      return err(new PolicyViolationError(`Tool ${toolName} not allowed on server ${serverId}`));
    }
    return ok(true);
  }
}
