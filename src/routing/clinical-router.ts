import { SafetyState } from '../core/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { SkillRegistry } from '../clinical/skills/skill-registry.js';
import { SkillPolicyGate } from '../clinical/skills/skill-policy.js';
import { SkillSelectionResult, SkillId } from '../clinical/skills/skill-types.js';
import { Actor } from '../memory/types.js';
import { TriageLayer } from './triage-layer.js';

export interface ClinicalRouter {
  route(
    input: UnifiedInput, 
    safetyState: SafetyState,
    actor: Actor
  ): Promise<Result<SkillSelectionResult, SafetyError>>;
}

export class DefaultClinicalRouter implements ClinicalRouter {
  constructor(
    private registry: SkillRegistry,
    private policyGate: SkillPolicyGate
  ) {}

  public async route(
    input: UnifiedInput, 
    safetyState: SafetyState,
    actor: Actor
  ): Promise<Result<SkillSelectionResult, SafetyError>> {
    await Promise.resolve(); // satisfy async without await requirement
    
    const triage = new TriageLayer();
    const triageDecision = triage.evaluate(input, safetyState);

    if (triageDecision.urgency === 'CRITICAL') {
      return err(new SafetyError("Clinical router refused to operate: Safety state is CRISIS"));
    }

    // If the Triage Layer determines an elevated urgency, we route to the Expert system 
    if (triageDecision.urgency === 'ELEVATED') {
      return ok({
        skillId: 'SUPPORTIVE_CONVERSATION', // Defaulting legacy skill ID for now
        confidence: 1.0,
        reasonCode: `TRIAGE_OVERRIDE_${triageDecision.urgency}_TO_EXPERT_${triageDecision.targetExpertId}`
      });
    }

    // In a real implementation, this would use a fast secondary classifier or LLM router prompt to suggest a SkillId.
    // For this deterministic boundary, we mock the selection logic. 
    // We default to SUPPORTIVE_CONVERSATION if unknown.
    let targetSkillId: SkillId = 'SUPPORTIVE_CONVERSATION';
    const text = input.text.toLowerCase();
    
    if (text.includes('anxious') || text.includes('panic') || text.includes('ground')) {
      targetSkillId = 'GROUNDING';
    } else if (text.includes('journal') || text.includes('write')) {
      targetSkillId = 'JOURNALING';
    } else if (text.includes('cbt') || text.includes('exercise')) {
      targetSkillId = 'CBT';
    } else if (text.includes('sleep')) {
      targetSkillId = 'SLEEP_SUPPORT';
    } else if (text.includes('breathe') || text.includes('breathing')) {
      targetSkillId = 'BREATHING';
    } else if (text.includes('progress') || text.includes('milestone') || text.includes('how am i doing') || text.includes('improving') || text.includes('look back')) {
      targetSkillId = 'PROGRESS_REFLECTION';
    } else if (text.includes('motivation') || text.includes('task') || text.includes('procrastinating') || text.includes('get things done') || text.includes('putting things off')) {
      targetSkillId = 'BEHAVIORAL_ACTIVATION';
    } else if (text.includes('what is') || text.includes('explain') || text.includes('learn about') || text.includes('why does this happen') || text.includes('understand')) {
      targetSkillId = 'PSYCHOEDUCATION';
    }

    const skill = this.registry.get(targetSkillId);
    if (!skill) {
      // Fallback
      targetSkillId = 'SUPPORTIVE_CONVERSATION';
    }

    const finalSkill = this.registry.get(targetSkillId);
    if (!finalSkill) {
      return err(new SafetyError("Skill resolution failed critically"));
    }

    // The router MUST pass the selected skill through the SkillPolicyGate before returning it
    // We assume default session memory for routing purposes
    const authResult = this.policyGate.authorize(finalSkill, safetyState, actor, ['SESSION'], []);
    
    if (!authResult.ok) {
      // If the targeted skill is unauthorized (e.g. CBT not allowed in ELEVATED for some reason), fallback to supportive
      const fallbackSkill = this.registry.get('SUPPORTIVE_CONVERSATION');
      if (!fallbackSkill) return err(new SafetyError("Fallback skill missing"));
      const fallbackAuth = this.policyGate.authorize(fallbackSkill, safetyState, actor, ['SESSION'], []);
      if (!fallbackAuth.ok) {
        return err(new SafetyError("All clinical skills, including fallback, failed policy authorization"));
      }
      return ok({
        skillId: 'SUPPORTIVE_CONVERSATION',
        confidence: 1.0,
        reasonCode: `TARGET_UNAUTHORIZED_FALLBACK: ${authResult.error.message}`
      });
    }

    return ok({
      skillId: targetSkillId,
      confidence: 0.85,
      reasonCode: 'ROUTED_BY_HEURISTIC'
    });
  }
}
