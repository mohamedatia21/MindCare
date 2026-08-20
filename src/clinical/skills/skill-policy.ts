import { MentalHealthSkill } from './skill-types.js';
import { SafetyState, MemoryClass } from '../../core/types.js';
import { Actor } from '../../memory/types.js';
import { Result, ok, err } from '../../core/result.js';
import { PolicyViolationError } from '../../core/errors.js';

export class SkillPolicyGate {
  public authorize(
    skill: MentalHealthSkill,
    safetyState: SafetyState,
    actor: Actor,
    requestedMemoryClasses: MemoryClass[],
    requestedTools: string[]
  ): Result<MentalHealthSkill, PolicyViolationError> {
    
    // 1. Hard Crisis Block
    if (safetyState === 'CRISIS') {
      return err(new PolicyViolationError(`Cannot execute normal mental health skill ${skill.id} in CRISIS state`));
    }

    // 2. Safety State Authorization
    if (!skill.allowedSafetyStates.includes(safetyState)) {
      return err(new PolicyViolationError(`Skill ${skill.id} not authorized in safety state ${safetyState}`));
    }

    // 3. Memory Scope Authorization
    for (const memClass of requestedMemoryClasses) {
      if (!skill.allowedMemoryClasses.includes(memClass)) {
        return err(new PolicyViolationError(`Skill ${skill.id} is not authorized to access memory class ${memClass}`));
      }
    }

    // 4. Tool Scope Authorization
    for (const tool of requestedTools) {
      if (!skill.allowedTools.includes(tool)) {
        return err(new PolicyViolationError(`Skill ${skill.id} is not authorized to execute tool ${tool}`));
      }
    }

    // 5. Actor Authorization
    if (actor.role !== 'USER' && actor.role !== 'CLINICAL_AGENT') {
      return err(new PolicyViolationError(`Actor role ${actor.role} not authorized to execute therapeutic skills`));
    }

    return ok(skill);
  }
}
