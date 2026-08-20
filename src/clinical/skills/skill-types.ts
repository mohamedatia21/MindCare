import { SafetyState, MemoryClass } from '../../core/types.js';
import { PolicyViolationError } from '../../core/errors.js';
import { Actor } from '../../memory/types.js';

export type SkillId = 
  | 'SUPPORTIVE_CONVERSATION'
  | 'EMOTIONAL_VALIDATION'
  | 'GROUNDING'
  | 'BREATHING'
  | 'CBT'
  | 'BEHAVIORAL_ACTIVATION'
  | 'JOURNALING'
  | 'SLEEP_SUPPORT'
  | 'STRESS_MANAGEMENT'
  | 'PSYCHOEDUCATION'
  | 'PROGRESS_REFLECTION';

export type SkillIntent = 'COPING' | 'EDUCATION' | 'REFLECTION' | 'SUPPORT' | 'EXERCISE';

export type ProhibitedAction = 
  | 'DIAGNOSE'
  | 'PRESCRIBE_MEDICATION'
  | 'OVERRIDE_SAFETY_STATE'
  | 'DIRECT_MEMORY_WRITE'
  | 'DIRECT_MCP_ACCESS'
  | 'EXECUTE_UNAUTHORIZED_TOOLS';

export interface SkillOutputConstraints {
  mustBeNonDiagnostic: boolean;
  mustBeEducational: boolean;
  mustIncludeDisclaimer: boolean;
  maxLengthTokens: number;
}

export interface SkillExecutionInput {
  userInput: string;
  userId: string;
  sessionId: string;
  actor: Actor;
  safetyState: SafetyState;
}

export interface SkillExecutionResult {
  skillId: SkillId;
  content: string;
  executedTools: string[];
  safe: boolean;
}

export type SkillError = PolicyViolationError;

export interface MentalHealthSkill {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly intent: SkillIntent;
  
  readonly allowedSafetyStates: SafetyState[];
  readonly allowedMemoryClasses: MemoryClass[];
  readonly allowedTools: string[];
  readonly prohibitedActions: ProhibitedAction[];
  readonly outputConstraints: SkillOutputConstraints;
}

export interface SkillSelectionResult {
  skillId: SkillId;
  confidence: number;
  reasonCode: string;
}
