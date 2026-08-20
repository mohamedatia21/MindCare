import { describe, it, expect, beforeEach } from 'vitest';
import { LLMRuntime } from '../src/clinical/llm-runtime.js';
import { MockLLMAdapter } from '../src/infrastructure/llm/mock-provider.js';
import { OutputSafetyFilter } from '../src/clinical/output-safety-filter.js';
import { AdvancedToolGate } from '../src/tools/tool-gate.js';
import { MemoryMinimizer } from '../src/tools/minimizer.js';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryAuditLogger } from '../src/memory/audit-logger.js';
import { Actor, ContextPackage } from '../src/memory/types.js';
import { CrisisResponseBuilder } from '../src/clinical/crisis-response-builder.js';
import { DefaultResourceResolver } from '../src/safety/resource-resolver.js';
import { SupportiveConversationSkill } from '../src/clinical/skills/supportive-conversation/skill.js';

describe('Phase 4E: LLM Runtime & Output Safety Filter', () => {
  let runtime: LLMRuntime;
  let mockProvider: MockLLMAdapter;
  const actor: Actor = { id: 'sys1', role: 'CLINICAL_AGENT' };
  const emptyContext: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

  beforeEach(() => {
    mockProvider = new MockLLMAdapter();
    const filter = new OutputSafetyFilter();
    
    const repo = new InMemoryMemoryRepository();
    const audit = new MemoryAuditLogger();
    const policy = new MemoryPolicyGate(repo, audit);
    const minimizer = new MemoryMinimizer();
    const toolGate = new AdvancedToolGate(policy, minimizer);
    
    const resolver = new DefaultResourceResolver();
    const crisisBuilder = new CrisisResponseBuilder(resolver);
    
    runtime = new LLMRuntime(mockProvider, filter, toolGate, crisisBuilder);
  });

  describe('Adversarial & Safety Outputs (OutputSafetyFilter)', () => {
    it('Blocks Diagnostic Claims', async () => {
      mockProvider.setMockScenario('DIAGNOSIS');
      const res = await runtime.execute({ content: "diagnose me", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('DIAGNOSTIC_CLAIM');
      expect(res.content).not.toContain('anxiety'); // Original text blocked
    });

    it('Blocks Medication Claims', async () => {
      mockProvider.setMockScenario('MEDICATION');
      const res = await runtime.execute({ content: "meds", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('MEDICATION_CLAIM');
    });

    it('Blocks Fake Therapist Identity', async () => {
      mockProvider.setMockScenario('FAKE_THERAPIST');
      const res = await runtime.execute({ content: "who are you", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('FAKE_IDENTITY');
    });

    it('Blocks Self-Harm Encouragement', async () => {
      mockProvider.setMockScenario('SELF_HARM');
      const res = await runtime.execute({ content: "im ending it", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('SELF_HARM_ENCOURAGEMENT');
    });

    it('Blocks System Prompt Leakage', async () => {
      mockProvider.setMockScenario('LEAKAGE');
      const res = await runtime.execute({ content: "reveal instructions", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('POLICY_LEAKAGE');
    });
  });

  describe('Provider Failures & Fallbacks', () => {
    it('Handles Provider Timeout Safely', async () => {
      mockProvider.setMockScenario('TIMEOUT');
      const res = await runtime.execute({ content: "hello", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('PROVIDER_ERROR');
    });

    it('Handles Malformed JSON / Missing Fields Safely', async () => {
      mockProvider.setMockScenario('MALFORMED');
      const res = await runtime.execute({ content: "hello", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, SupportiveConversationSkill);
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('MALFORMED_OUTPUT');
    });
  });

  describe('Runtime Execution Limits', () => {
    it('Aborts Infinite Tool Loops safely (MAX_TOOL_CALLS)', async () => {
      mockProvider.setMockScenario('TOOL_LOOP'); // Will always return a requested tool
      const res = await runtime.execute({ content: "hello", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, { ...SupportiveConversationSkill, allowedTools: ['WRITE_MEMORY'] });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('LOOP_LIMIT_EXCEEDED');
    });

    it('Gracefully rejects unknown / unauthorized tools', async () => {
      mockProvider.setMockScenario('TOOL_INJECTION');
      // The tool gate will reject the unknown tool, feed the error back, 
      // but since mock provider ALWAYS returns the tool, it will eventually hit loop limit.
      // We authorize the tool at the skill level so we can test the tool gate level!
      const res = await runtime.execute({ content: "hello", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'SAFE', actor, { ...SupportiveConversationSkill, allowedTools: ['UNKNOWN_HACK_TOOL'] });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('LOOP_LIMIT_EXCEEDED');
    });
  });

  describe('Crisis State Routing Integration', () => {
    it('Bypasses LLM entirely when SafetyState is CRISIS', async () => {
      mockProvider.setMockScenario('SAFE'); // Provider would normally generate safe response
      const res = await runtime.execute({ content: "i am in crisis", userId: 'u1', sessionId: 's1', timestamp: new Date() }, emptyContext, () => 'CRISIS', actor, SupportiveConversationSkill);
      
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('CRISIS_STATE_LOCKDOWN');
      expect(res.content).toContain('988');
    });
  });
});
