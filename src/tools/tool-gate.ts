import { ToolRequest, ToolResult, AllowedToolName } from './types.js';
import { validateWriteMemory } from './schemas.js';
import { MemoryMinimizer } from './minimizer.js';
import { MemoryPolicyGate } from '../memory/memory-policy.js';
import { SafetyState } from '../core/types.js';
import { Result, ok, err } from '../core/result.js';
import { ToolExecutionError, PolicyViolationError } from '../core/errors.js';
import { MCPPolicyGate } from '../mcp/mcp-policy-gate.js';
import { HandoffPolicyGate } from '../handoff/handoff-policy.js';
import { HandoffType } from '../handoff/types.js';

import { RAGTool } from '../infrastructure/rag/rag-tool.js';
import { WebMedicalSearchTool } from './web-search-tool.js';

export class AdvancedToolGate {
  constructor(
    private memoryPolicy: MemoryPolicyGate,
    private minimizer: MemoryMinimizer,
    private mcpGate?: MCPPolicyGate,
    private handoffGate?: HandoffPolicyGate,
    private ragTool?: RAGTool,
    private webSearchTool: WebMedicalSearchTool = new WebMedicalSearchTool()
  ) {}

  public async authorizeAndExecute(
    request: ToolRequest, 
    getSafetyState: () => SafetyState
  ): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    
    if (getSafetyState() === 'CRISIS') {
      if (request.toolName !== 'GET_CRISIS_RESOURCES' && request.toolName !== 'REQUEST_HUMAN_HANDOFF') {
         return err(new PolicyViolationError("Tool execution blocked during CRISIS state"));
      }
    }

    switch (request.toolName as AllowedToolName) {
      case 'WRITE_MEMORY':
        return this.executeWriteMemory(request);
      
      case 'EXTERNAL_KNOWLEDGE_SEARCH':
        return this.executeMCP(request, getSafetyState);

      case 'KNOWLEDGE_BASE_SEARCH':
        return this.executeRAG(request);

      case 'WEB_MEDICAL_SEARCH':
        return this.executeWebSearch(request);

      case 'REQUEST_HUMAN_HANDOFF':
        return this.executeHandoff(request, getSafetyState());

      case 'READ_MEMORY':
      case 'DELETE_MEMORY':
      case 'UPDATE_MEMORY':
      case 'GET_PROGRESS':
      case 'GET_CRISIS_RESOURCES':
        return err(new ToolExecutionError(`Tool ${request.toolName} implemented but not active in 4D sandbox yet`));
      default:
        return err(new ToolExecutionError(`Unknown tool: ${request.toolName}`));
    }
  }

  private executeHandoff(request: ToolRequest, safetyState: SafetyState): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    if (!this.handoffGate) return Promise.resolve(err(new ToolExecutionError("Handoff capability not configured.")));

    const args = request.arguments;
    const type = (args.type as HandoffType | undefined) ?? 'RECOMMENDED_SUPPORT';
    const rawContext = Array.isArray(args.minimizedContext) ? args.minimizedContext : [];

    // Epistemic Status Enforcement: If the LLM tries to write "FACT" to context, downgrade to INFERENCE.
    const context = rawContext.map((c) => {
       const item = c as { statement: string; epistemicStatus: string };
       return {
         statement: item.statement,
         epistemicStatus: item.epistemicStatus === 'FACT' ? 'INFERENCE' : item.epistemicStatus
       };
    });

    const initiateRes = this.handoffGate.initiateHandoff(
       request.actor, 
       request.userId, 
       type, 
       safetyState, 
       'PENDING', 
       context
    );

    if (!initiateRes.ok) {
       return Promise.resolve(ok({
         ok: false,
         error: `Handoff Failed: ${initiateRes.error.message}`,
         metadata: { semanticBoundary: 'SYSTEM_GENERATED', truncated: false }
       }));
    }

    return Promise.resolve(ok({
      ok: true,
      data: { handoffId: initiateRes.value.handoffId, state: initiateRes.value.state },
      metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
    }));
  }

  private async executeMCP(request: ToolRequest, getSafetyState: () => SafetyState): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    if (!this.mcpGate) {
      return err(new ToolExecutionError("MCP capability layer not configured."));
    }

    const mcpRes = await this.mcpGate.execute({
      requestId: request.requestId,
      actorId: request.actor.id,
      toolName: 'web_search', 
      serverId: 'search_server',
      arguments: request.arguments,
      timestamp: request.timestamp
    }, getSafetyState());

    if (!mcpRes.ok) {
      return ok({
        ok: false,
        error: `MCP Execution Failed: ${mcpRes.error.message}`,
        metadata: { semanticBoundary: 'MCP_DATA', truncated: false }
      });
    }

    return ok({
      ok: true,
      data: mcpRes.value.data,
      metadata: { semanticBoundary: 'MCP_DATA', truncated: false }
    });
  }

  private async executeWriteMemory(request: ToolRequest): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    const parsed = validateWriteMemory(request.arguments);
    if (!parsed.ok) return err(parsed.error);

    const sanitized = this.minimizer.sanitizeAndValidate(parsed.value);
    if (!sanitized.ok) return err(sanitized.error);
    const finalArgs = sanitized.value;

    const memoryObj = {
      id: `mem_${Date.now().toString()}_${Math.floor(Math.random()*1000).toString()}`,
      userId: request.userId,
      memoryClass: finalArgs.memoryClass,
      content: finalArgs.content,
      epistemicStatus: finalArgs.epistemicStatus,
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionPolicy: 'LONG_TERM_APPROVED' as const,
      consentState: 'PENDING' as const,
      source: finalArgs.source
    };

    const writeResult = await this.memoryPolicy.writeMemory(request.actor, request.userId, memoryObj);
    
    if (!writeResult.ok) {
      return ok({
        ok: false,
        error: `Policy Rejected: ${writeResult.error.message}`,
        metadata: { semanticBoundary: 'SYSTEM_GENERATED', truncated: false }
      });
    }

    return ok({
      ok: true,
      data: { memoryId: memoryObj.id },
      metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
    });
  }

  private async executeRAG(request: ToolRequest): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    if (!this.ragTool) {
      return err(new ToolExecutionError("KNOWLEDGE_BASE_SEARCH capability not configured."));
    }
    const query = request.arguments.query;
    if (typeof query !== 'string') {
       return err(new ToolExecutionError("Missing or invalid 'query' argument for KNOWLEDGE_BASE_SEARCH"));
    }
    return this.ragTool.execute(query, request.requestId);
  }

  private async executeWebSearch(request: ToolRequest): Promise<Result<ToolResult, ToolExecutionError | PolicyViolationError>> {
    const query = request.arguments.query;
    if (typeof query !== 'string') {
       return err(new ToolExecutionError("Missing or invalid 'query' argument for WEB_MEDICAL_SEARCH"));
    }
    const result = await this.webSearchTool.execute(query, request.requestId);
    return ok(result);
  }
}
