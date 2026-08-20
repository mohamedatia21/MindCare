import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RealMCPClient } from '../src/infrastructure/mcp/real-mcp-client.js';
import { MCPRegistry } from '../src/mcp/mcp-registry.js';
import { MCPPolicyGate } from '../src/mcp/mcp-policy-gate.js';
import { MCPSanitizer } from '../src/mcp/mcp-sanitizer.js';
import { MCPInputSanitizer } from '../src/mcp/mcp-input-sanitizer.js';

describe('Phase 4G.2: Hardened Internal Fetch Integration & SSRF Matrix', () => {
  let registry: MCPRegistry;
  let client: RealMCPClient;
  let gate: MCPPolicyGate;

  beforeEach(() => {
    registry = new MCPRegistry(); // Pre-populated with mindcare-internal-fetch
    client = new RealMCPClient(registry);
    gate = new MCPPolicyGate(client, registry, new MCPSanitizer(), new MCPInputSanitizer());
  });

  afterEach(async () => {
    await client.disconnect('mindcare-internal-fetch');
  });

  it('1. Vulnerable server explicitly rejected', async () => {
    const res = await gate.execute({
      requestId: 'r1', actorId: 'a1', toolName: 'fetch', serverId: 'mcp-fetch-server', arguments: {}, timestamp: new Date()
    }, 'SAFE');
    expect(res.ok).toBe(false);
    if (!res.ok) {
       expect(res.error.message).toContain('SECURITY_VULNERABILITY_SSRF');
    }
  });

  it('2. SUCCESS: Real HTTPS fetch to explicit allowlist domain', async () => {
    const res = await gate.execute({
      requestId: 'r2', actorId: 'a1', toolName: 'FETCH_EXTERNAL_DOCUMENT', serverId: 'mindcare-internal-fetch', 
      arguments: { url: 'https://en.wikipedia.org/wiki/Cognitive_behavioral_therapy' }, timestamp: new Date()
    }, 'SAFE');

    if (!res.ok) console.error("Internal Fetch Test Failed:", res.error);
    expect(res.ok).toBe(true);
    if (res.ok && res.value.data) {
       expect(res.value.data.toLowerCase()).toContain('cognitive behavioral therapy');
    }
  }, 30000);

  it('3. CRISIS Mode blocks real execution before transport connects', async () => {
    const res = await gate.execute({
      requestId: 'r3', actorId: 'a1', toolName: 'FETCH_EXTERNAL_DOCUMENT', serverId: 'mindcare-internal-fetch', 
      arguments: { url: 'https://en.wikipedia.org/wiki/Cognitive_behavioral_therapy' }, timestamp: new Date()
    }, 'CRISIS');

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('not permitted in state: CRISIS');
  });

  const ssrfTests = [
    { name: 'HTTP protocol rejected', url: 'http://en.wikipedia.org' },
    { name: 'Localhost domain rejected', url: 'https://localhost/admin' },
    { name: 'Private IP literal rejected', url: 'https://192.168.1.1' },
    { name: 'Unapproved domain rejected', url: 'https://google.com' },
    { name: 'File protocol rejected', url: 'file:///etc/passwd' }
  ];

  for (const t of ssrfTests) {
    it(`SSRF Block: ${t.name}`, async () => {
      const res = await gate.execute({
        requestId: `r-ssrf-${t.name}`, actorId: 'a1', toolName: 'FETCH_EXTERNAL_DOCUMENT', serverId: 'mindcare-internal-fetch', 
        arguments: { url: t.url }, timestamp: new Date()
      }, 'SAFE');

      // The Gate itself is OK (policy allowed the tool request to flow), but the tool returns an error payload
      // since the MCP client doesn't throw on standard Tool responses.
      if (!res.ok) console.error("Internal Fetch Test Failed:", res.error);
     expect(res.ok).toBe(true);
      if (res.ok && res.value.data) {
         expect(res.value.data).toContain('Error:');
      }
    }, 10000);
  }
});
