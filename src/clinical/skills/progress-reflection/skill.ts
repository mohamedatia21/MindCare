import { MentalHealthSkill } from '../skill-types.js';

export const ProgressReflectionSkill: MentalHealthSkill = {
  id: 'PROGRESS_REFLECTION',
  name: 'Progress Reflection',
  description: 'Reviewing therapeutic milestones and past sessions.',
  intent: 'REFLECTION',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION', 'PROGRESS'],
  allowedTools: ['GET_PROGRESS'], 
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: false,
    mustIncludeDisclaimer: false,
    maxLengthTokens: 1000
  }
};
