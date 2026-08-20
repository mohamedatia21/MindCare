import { describe, it, expect, beforeEach } from 'vitest';
import { MCPPolicyGate } from '../src/mcp/mcp-policy-gate.js';
import { MCPRegistry } from '../src/mcp/mcp-registry.js';
import { MockMCPClient } from '../src/mcp/mcp-client.js';
import { MCPSanitizer } from '../src/mcp/mcp-sanitizer.js';
import { MCPInputSanitizer } from '../src/mcp/mcp-input-sanitizer.js';
import { AdvancedToolGate } from '../src/tools/tool-gate.js';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryAuditLogger } from '../src/memory/audit-logger.js';
import { MemoryMinimizer } from '../src/tools/minimizer.js';

describe('Phase 4E.2: MCP Production Integration & Hardening', () => {
  let mcpGate: MCPPolicyGate;
  let client: MockMCPClient;
  let registry: MCPRegistry;
  let toolGate: AdvancedToolGate;

  beforeEach(() => {
    client = new MockMCPClient();
    registry = new MCPRegistry();
    const sanitizer = new MCPSanitizer();
    const inputSanitizer = new MCPInputSanitizer();
    mcpGate = new MCPPolicyGate(client, registry, sanitizer, inputSanitizer);
    
    registry.registerServer({
      id: 'search_server',
      name: 'Search Server',
      version: '1.0.0',
      enabled: true,
      trustLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      allowedTools: ['web_search'],
      allowedClinicalModes: ['SAFE'],
      timeoutMs: 5000,
      maxResponseBytes: 10000,
      transport: 'stdio'
    });

    registry.registerServer({
      id: 'disabled_server',
      name: 'Disabled Server',
      version: '1.0.0',
      enabled: false,
      trustLevel: 'LOW',
      verificationStatus: 'VERIFIED',
      allowedTools: ['some_tool'],
      allowedClinicalModes: ['SAFE'],
      timeoutMs: 5000,
      maxResponseBytes: 10000,
      transport: 'stdio'
    });

    registry.registerServer({
      id: 'unverified_server',
      name: 'Unverified',
      version: '1.0.0',
      enabled: true,
      trustLevel: 'LOW',
      verificationStatus: 'UNVERIFIED',
      allowedTools: ['some_tool'],
      allowedClinicalModes: ['SAFE'],
      timeoutMs: 5000,
      maxResponseBytes: 10000,
      transport: 'stdio'
    });

    const repo = new InMemoryMemoryRepository();
    const audit = new MemoryAuditLogger();
    const policy = new MemoryPolicyGate(repo, audit);
    const minimizer = new MemoryMinimizer();
    toolGate = new AdvancedToolGate(policy, minimizer, mcpGate);
  });

  it('1. Unknown MCP server rejected', async () => {
    const res = await mcpGate.execute({ requestId: 'r1', actorId: 'a1', toolName: 'web_search', serverId: 'unknown', arguments: {}, timestamp: new Date() }, 'SAFE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('Unknown MCP server');
  });

  it('2. Unknown MCP tool rejected', async () => {
    const res = await mcpGate.execute({ requestId: 'r1', actorId: 'a1', toolName: 'unknown_tool', serverId: 'search_server', arguments: {}, timestamp: new Date() }, 'SAFE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('not allowed');
  });

  it('4. CRISIS blocks normal MCP tools', async () => {
    const res = await mcpGate.execute({ requestId: 'r1', actorId: 'a1', toolName: 'web_search', serverId: 'search_server', arguments: {}, timestamp: new Date() }, 'CRISIS');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('not permitted in state: CRISIS');
  });

  it('Unverified server is blocked', async () => {
    const res = await mcpGate.execute({ requestId: 'r1', actorId: 'a1', toolName: 'some_tool', serverId: 'unverified_server', arguments: {}, timestamp: new Date() }, 'SAFE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('Unverified MCP servers are blocked');
  });

  it('9. Timeout fails safe', async () => {
    client.setMockScenario('TIMEOUT');
    const res = await mcpGate.execute({ requestId: 'r1', actorId: 'a1', toolName: 'web_search', serverId: 'search_server', arguments: {}, timestamp: new Date() }, 'SAFE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('MCP_TIMEOUT');
  });

  it('AdvancedToolGate safely proxies to MCPPolicyGate', async () => {
    const res = await toolGate.authorizeAndExecute({
      toolName: 'EXTERNAL_KNOWLEDGE_SEARCH',
      arguments: { query: 'test' },
      actor: { id: 'a1', role: 'CLINICAL_AGENT' },
      userId: 'u1',
      requestId: 'r1',
      timestamp: new Date()
    }, () => 'SAFE');

    expect(res.ok).toBe(true);
  });
});
