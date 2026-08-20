import { SafetyState } from '../core/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { Actor } from '../memory/types.js';
import { Expert, ExpertId, ExpertExecutionResult } from './expert-types.js';

export class EmergencyHandoffExpert implements Expert {
  public readonly id: ExpertId = 'EMERGENCY_HANDOFF';

  public async execute(
    input: UnifiedInput,
    safetyState: SafetyState,
    actor: Actor,
    directives: string[]
  ): Promise<Result<ExpertExecutionResult, SafetyError>> {
    
    // In a production environment, this would call an LLM with a highly constrained prompt
    // to generate a context-aware but perfectly safe empathetic grounding sentence.
    // For this implementation, we simulate the LLM generation:
    const llmEmpatheticGrounding = "أنا هنا معاك وحاسس بوجعك، أرجوك متكونش لوحدك في اللحظة دي وماتأذيش نفسك.";

    // MANDATORY HARDCODED CLINICAL HANDOFF
    // The number is formatted to be visually clear and TTS-friendly.
    const HARDCODED_CRISIS_MESSAGE = "\n\nأرجوك تواصل فوراً مع الخط الساخن للأمانة العامة للصحة النفسية على رقم 16328 (واحد، ستة، تلاتة، اتنين، تمانية). هم متاحين 24 ساعة ومجاناً، وفيه دكتور حقيقي جاهز يسمعك ويساعدك دلوقتي.";

    // We strictly append the hardcoded string outside of LLM control.
    const finalContent = `${llmEmpatheticGrounding}${HARDCODED_CRISIS_MESSAGE}`;

    return ok({
      expertId: this.id,
      content: finalContent,
      isLocked: true, // Engages the 24-hour mandatory lock
      directivesExecuted: directives
    });
  }
}
