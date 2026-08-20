import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../src/clinical/skills/skill-registry.js';
import { SkillPolicyGate } from '../src/clinical/skills/skill-policy.js';
import { DefaultClinicalRouter } from '../src/routing/clinical-router.js';
import { SupportiveConversationSkill } from '../src/clinical/skills/supportive-conversation/skill.js';
import { CBTSkill } from '../src/clinical/skills/cbt/skill.js';
import { GroundingSkill } from '../src/clinical/skills/grounding/skill.js';
import { JournalingSkill } from '../src/clinical/skills/journaling/skill.js';
import { ProgressReflectionSkill } from '../src/clinical/skills/progress-reflection/skill.js';
import { BreathingSkill } from '../src/clinical/skills/breathing/skill.js';
import { SleepSupportSkill } from '../src/clinical/skills/sleep-support/skill.js';
import { BehavioralActivationSkill } from '../src/clinical/skills/behavioral-activation/skill.js';
import { PsychoeducationSkill } from '../src/clinical/skills/psychoeducation/skill.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';
import { SkillId } from '../src/clinical/skills/skill-types.js';

describe('Phase 4 Remediation: Mental Health Skills Architecture', () => {
  let registry: SkillRegistry;
  let policyGate: SkillPolicyGate;
  let router: DefaultClinicalRouter;

  const dummyInput: UnifiedInput = { inputId: 'i1', sessionId: 's1', userId: 'u1', text: 'hello', modality: 'TEXT', timestamp: new Date() };
  const actor = { id: 'u1', role: 'USER' as const };

  beforeEach(() => {
    registry = new SkillRegistry();
    policyGate = new SkillPolicyGate();
    router = new DefaultClinicalRouter(registry, policyGate);
    
    // Register some skills
    registry.register(SupportiveConversationSkill);
    registry.register(CBTSkill);
    registry.register(GroundingSkill);
    registry.register(JournalingSkill);
    registry.register(ProgressReflectionSkill);
    registry.register(BreathingSkill);
    registry.register(SleepSupportSkill);
    registry.register(BehavioralActivationSkill);
    registry.register(PsychoeducationSkill);
  });

  describe('Skill Registry', () => {
    it('All registered skills resolve successfully', () => {
      const allSkills = registry.getAll();
      expect(allSkills.length).toBeGreaterThanOrEqual(9);
      expect(registry.get('SUPPORTIVE_CONVERSATION')).toBeDefined();
    });

    it('Duplicate skill registration is rejected', () => {
      expect(() => { registry.register(SupportiveConversationSkill); }).toThrow(/already registered/);
    });

    it('Unknown skill returns undefined', () => {
      expect(registry.get('FAKE_SKILL' as SkillId)).toBeUndefined();
    });
  });

  describe('Skill Policy Gate & Security Boundaries', () => {
    it('Skill cannot execute in CRISIS (CRISIS overrides all skills)', () => {
      const result = policyGate.authorize(SupportiveConversationSkill, 'CRISIS', actor, ['SESSION'], []);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('CRISIS');
    });

    it('Skill cannot use unauthorized tools', () => {
      // Grounding doesn't allow tools
      const result = policyGate.authorize(GroundingSkill, 'SAFE', actor, ['SESSION'], ['UNAUTHORIZED_TOOL']);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('not authorized to execute tool');
    });

    it('SENSITIVE memory remains protected', () => {
      // CBT doesn't allow SENSITIVE by default
      const result = policyGate.authorize(CBTSkill, 'SAFE', actor, ['SENSITIVE'], []);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('not authorized to access memory class');
    });
    
    it('Actor Role restricts therapeutic execution', () => {
      const adminActor = { id: 'admin1', role: 'ADMIN' as const };
      const result = policyGate.authorize(CBTSkill, 'SAFE', adminActor, ['SESSION'], []);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('not authorized to execute therapeutic skills');
    });
  });

  describe('Clinical Router Delegation', () => {
    it('Low-confidence skill selection falls back safely to SUPPORTIVE_CONVERSATION', async () => {
      const res = await router.route(dummyInput, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.skillId).toBe('SUPPORTIVE_CONVERSATION');
      }
    });

    it('Routes explicit intents to appropriate skills', async () => {
      const cbtInput = { ...dummyInput, text: "let's do a cbt exercise" };
      const res = await router.route(cbtInput, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.skillId).toBe('CBT');
      }
    });

    it('Routes grounding appropriately', async () => {
      const groundingInput = { ...dummyInput, text: "i am having a panic attack, help me ground" };
      const res = await router.route(groundingInput, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.skillId).toBe('GROUNDING');
      }
    });

    it('CRISIS completely locks the router before skill resolution', async () => {
      const res = await router.route(dummyInput, 'CRISIS', actor);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.message).toContain('CRISIS');
    });

    it('Routes progress reflection appropriately', async () => {
      const input = { ...dummyInput, text: "what progress have I made" };
      const res = await router.route(input, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.skillId).toBe('PROGRESS_REFLECTION');
    });

    it('Routes behavioral activation appropriately', async () => {
      const input = { ...dummyInput, text: "i'm procrastinating" };
      const res = await router.route(input, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.skillId).toBe('BEHAVIORAL_ACTIVATION');
    });

    it('Routes psychoeducation appropriately', async () => {
      const input = { ...dummyInput, text: "explain what anxiety is" };
      const res = await router.route(input, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.skillId).toBe('PSYCHOEDUCATION');
    });

    it('Routes sleep support appropriately', async () => {
      const input = { ...dummyInput, text: "i cannot sleep" };
      const res = await router.route(input, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.skillId).toBe('SLEEP_SUPPORT');
    });

    it('Routes breathing appropriately', async () => {
      const input = { ...dummyInput, text: "help me breathe" };
      const res = await router.route(input, 'SAFE', actor);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.skillId).toBe('BREATHING');
    });

    it('Target unauthorized fallback works (e.g. CBT not allowed due to requested tools missing, falls back to Support)', async () => {
      // Create a scenario where CBT is disabled for this user/state, 
      // Policy Gate will fail CBT. The router should fallback to Supportive Conversation.
      // We'll test this by pretending the policy gate fails all tools.
      
      const strictPolicyGate = new SkillPolicyGate();
      const mockRouter = new DefaultClinicalRouter(registry, strictPolicyGate);
      
      // We will override strictPolicyGate's authorize method to reject CBT
      strictPolicyGate.authorize = (skill, _state, _actor, _mem, _tools) => {
        if (skill.id === 'CBT') return { ok: false, error: new Error('CBT explicitly disabled') } as ReturnType<typeof strictPolicyGate.authorize>;
        return { ok: true, value: skill };
      };

      const cbtInput = { ...dummyInput, text: "let's do a cbt exercise" };
      const res = await mockRouter.route(cbtInput, 'SAFE', actor);
      
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.skillId).toBe('SUPPORTIVE_CONVERSATION'); // Fails safe!
        expect(res.value.reasonCode).toContain('TARGET_UNAUTHORIZED_FALLBACK');
      }
    });
  });

  describe('Adversarial Boundary Validation', () => {
    it('Skill cannot escalate its own privileges (Skill → unauthorized memory class)', () => {
      // Direct invocation attempting bypass
      const result = policyGate.authorize(SupportiveConversationSkill, 'SAFE', actor, ['CRISIS', 'SENSITIVE'], []);
      expect(result.ok).toBe(false);
    });

    it('Skill cannot escalate to arbitrary tools (Skill → unauthorized tool)', () => {
      const result = policyGate.authorize(GroundingSkill, 'SAFE', actor, ['SESSION'], ['EXECUTE_SHELL']);
      expect(result.ok).toBe(false);
    });
  });
});
