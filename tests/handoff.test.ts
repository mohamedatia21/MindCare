import { describe, it, expect, beforeEach } from 'vitest';
import { HandoffPolicyGate } from '../src/handoff/handoff-policy.js';
import { AdvancedToolGate } from '../src/tools/tool-gate.js';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryAuditLogger } from '../src/memory/audit-logger.js';
import { MemoryMinimizer } from '../src/tools/minimizer.js';
import { Actor } from '../src/memory/types.js';

describe('Phase 4F: Human Handoff Runtime', () => {
  let handoffGate: HandoffPolicyGate;
  let toolGate: AdvancedToolGate;
  const admin: Actor = { id: 'admin1', role: 'ADMIN' };
  const sys: Actor = { id: 'sys1', role: 'SYSTEM' };
  const user: Actor = { id: 'u1', role: 'USER' };

  beforeEach(() => {
    handoffGate = new HandoffPolicyGate();
    const repo = new InMemoryMemoryRepository();
    const audit = new MemoryAuditLogger();
    const policy = new MemoryPolicyGate(repo, audit);
    const minimizer = new MemoryMinimizer();
    toolGate = new AdvancedToolGate(policy, minimizer, undefined, handoffGate);
  });

  it('1. Crisis automatically creates emergency handoff state', () => {
    const res = handoffGate.initiateHandoff(sys, 'u1', 'USER_REQUESTED_CONSULTATION', 'CRISIS');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.type).toBe('EMERGENCY_SAFETY_ESCALATION');
      expect(res.value.state).toBe('EMERGENCY_HANDOFF');
      expect(res.value.consentState).toBe('GRANTED'); // Emergency overrides
    }
  });

  it('5. Consent denial blocks transfer', () => {
    const pkg = handoffGate.initiateHandoff(sys, 'u1', 'USER_REQUESTED_CONSULTATION', 'SAFE', 'DENIED');
    expect(pkg.ok).toBe(true);
    if (pkg.ok) {
      const trans = handoffGate.executeTransfer(sys, pkg.value.handoffId);
      expect(trans.ok).toBe(false);
      if (!trans.ok) expect(trans.error.message).toContain('Consent denied');
    }
  });

  it('6. Consent revocation blocks future transfer', () => {
    const pkg = handoffGate.initiateHandoff(sys, 'u1', 'RECOMMENDED_SUPPORT', 'SAFE', 'GRANTED');
    if (pkg.ok) {
      handoffGate.updateConsent(user, pkg.value.handoffId, 'REVOKED');
      const trans = handoffGate.executeTransfer(sys, pkg.value.handoffId);
      expect(trans.ok).toBe(false);
      if (!trans.ok) expect(trans.error.message).toContain('Consent revoked');
    }
  });

  it('9. Inference cannot become FACT (ToolGate Downgrade)', async () => {
    const res = await toolGate.authorizeAndExecute({
      toolName: 'REQUEST_HUMAN_HANDOFF',
      arguments: { type: 'RECOMMENDED_SUPPORT', minimizedContext: [{ statement: 'Has ADHD', epistemicStatus: 'FACT' }] },
      actor: sys,
      userId: 'u1',
      requestId: 'r1',
      timestamp: new Date()
    }, () => 'SAFE');

    expect(res.ok).toBe(true);
    if (res.ok && res.value.ok) {
      const handoffId = String((res.value.data as Record<string, unknown>).handoffId);
      const pkg = handoffGate.accessHandoff(sys, 'u1', handoffId);
      expect(pkg.ok).toBe(true);
      if (pkg.ok) {
        expect(pkg.value.minimizedContext[0]?.epistemicStatus).toBe('INFERENCE');
      }
    }
  });

  it('11. IDOR attempt rejected', () => {
    const pkg = handoffGate.initiateHandoff(sys, 'u1', 'USER_REQUESTED_CONSULTATION', 'SAFE');
    if (pkg.ok) {
      const hacker: Actor = { id: 'u2', role: 'USER' };
      const access = handoffGate.accessHandoff(hacker, 'u2', pkg.value.handoffId);
      expect(access.ok).toBe(false);
      if (!access.ok) expect(access.error.message).toContain('IDOR Attempt');
    }
  });

  it('12. Admin cannot automatically access sensitive psychological data', () => {
    const pkg = handoffGate.initiateHandoff(sys, 'u1', 'USER_REQUESTED_CONSULTATION', 'SAFE');
    if (pkg.ok) {
      const access = handoffGate.accessHandoff(admin, 'u1', pkg.value.handoffId);
      expect(access.ok).toBe(false);
      if (!access.ok) expect(access.error.message).toContain('ADMIN role cannot');
    }
  });

  it('14. Expired handoff rejected', () => {
    const pkg = handoffGate.initiateHandoff(sys, 'u1', 'USER_REQUESTED_CONSULTATION', 'SAFE', 'GRANTED');
    if (pkg.ok) {
      pkg.value.expiresAt = new Date(Date.now() - 10000); // artificially expire
      const trans = handoffGate.executeTransfer(sys, pkg.value.handoffId);
      expect(trans.ok).toBe(false);
      if (!trans.ok) expect(trans.error.message).toContain('expired');
    }
  });

  it('23. LLM cannot directly create unrestricted handoff (requires Consent via ToolGate)', async () => {
    const res = await toolGate.authorizeAndExecute({
      toolName: 'REQUEST_HUMAN_HANDOFF',
      arguments: { type: 'USER_REQUESTED_CONSULTATION' },
      actor: sys,
      userId: 'u1',
      requestId: 'r1',
      timestamp: new Date()
    }, () => 'SAFE');

    expect(res.ok).toBe(true);
    if (res.ok && res.value.ok) {
      const handoffId = String((res.value.data as Record<string, unknown>).handoffId);
      const trans = handoffGate.executeTransfer(sys, handoffId);
      expect(trans.ok).toBe(false); // Fails because consent is PENDING, LLM cannot set GRANTED
    }
  });
});
