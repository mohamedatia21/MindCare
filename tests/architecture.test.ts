import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/core/state-machine.js';
import { DefaultClinicalRouter } from '../src/routing/clinical-router.js';
import { SkillRegistry } from '../src/clinical/skills/skill-registry.js';
import { SkillPolicyGate } from '../src/clinical/skills/skill-policy.js';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryAuditLogger } from '../src/memory/audit-logger.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';

describe('Phase 4A Architecture Boundaries', () => {
  const dummyInput: UnifiedInput = { inputId: '1', sessionId: '1', userId: '1', text: 'test', modality: 'TEXT', timestamp: new Date() };

  describe('State Machine & Safety Rules', () => {
    it('forces new user input into SAFETY_REVIEW', () => {
      const sm = new StateMachine();
      const res = sm.onNewInput(dummyInput);
      expect(res.ok).toBe(true);
      expect(sm.getState()).toBe('SAFETY_REVIEW');
    });

    it('prevents transitioning to clinical states without a SAFE decision', () => {
      const sm = new StateMachine();
      sm.onNewInput(dummyInput);
      
      // Attempt bypass
      const res = sm.transitionToClinical('SUPPORT');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('SAFETY_ERR');
      }
    });

    it('CRISIS state prevents new normal inputs', () => {
      const sm = new StateMachine();
      sm.onNewInput(dummyInput);
      sm.applySafetyDecision('CRISIS');
      
      const res = sm.onNewInput(dummyInput);
      expect(res.ok).toBe(false);
    });
  });

  describe('Clinical Router Boundary', () => {
    it('refuses to route if SafetyState is CRISIS', async () => {
      const router = new DefaultClinicalRouter(new SkillRegistry(), new SkillPolicyGate());
      const res = await router.route(dummyInput, 'CRISIS', {id: 'u1', role: 'USER'});
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain('CRISIS');
      }
    });
  });

  
  describe('Memory Policy Boundary', () => {
    it('rejects persistence of SENSITIVE memory without explicit consent', async () => {
      const repo = new InMemoryMemoryRepository();
      const audit = new MemoryAuditLogger();
      const policy = new MemoryPolicyGate(repo, audit);
      const res = await policy.writeMemory({id:'sys', role:'SYSTEM'}, 'user1', {
        id: '1', memoryClass: 'SENSITIVE', content: 'test', epistemicStatus: 'FACT', status: 'ACTIVE',
        createdAt: new Date(), updatedAt: new Date(), retentionPolicy: 'MANUAL_DELETE', consentState: 'PENDING', source: 't', userId: 'user1'
      });
      expect(res.ok).toBe(false);
    });

    it('rejects persistence of EPHEMERAL memory completely', async () => {
      const repo = new InMemoryMemoryRepository();
      const audit = new MemoryAuditLogger();
      const policy = new MemoryPolicyGate(repo, audit);
      const res = await policy.writeMemory({id:'sys', role:'SYSTEM'}, 'user1', {
        id: '1', memoryClass: 'EPHEMERAL', content: 'test', epistemicStatus: 'FACT', status: 'ACTIVE',
        createdAt: new Date(), updatedAt: new Date(), retentionPolicy: 'SESSION_ONLY', consentState: 'GRANTED', source: 't', userId: 'user1'
      });
      expect(res.ok).toBe(false);
    });
  });

  });
