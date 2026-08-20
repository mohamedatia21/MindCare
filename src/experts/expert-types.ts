import { SafetyState } from '../core/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';
import { Result } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { Actor } from '../memory/types.js';

export type ExpertId = 
  | 'EMERGENCY_HANDOFF'
  | 'SCHEMA_THERAPY'
  | 'SUPPORTIVE_LISTENER'
  | 'ALGORITHMIC_DEPROGRAMMING';

export interface ExpertExecutionResult {
  expertId: ExpertId;
  content: string;
  isLocked: boolean; // If true, the session is locked in this expert (e.g. 24h crisis)
  directivesExecuted: string[];
}

export interface Expert {
  readonly id: ExpertId;
  
  /**
   * Executes the expert's specific LLM prompt and tool chain.
   */
  execute(
    input: UnifiedInput,
    safetyState: SafetyState,
    actor: Actor,
    directives: string[]
  ): Promise<Result<ExpertExecutionResult, SafetyError>>;
}
