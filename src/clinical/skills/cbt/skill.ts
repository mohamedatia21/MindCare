import { MentalHealthSkill } from '../skill-types.js';

export const CBTSkill: MentalHealthSkill = {
  id: 'CBT',
  name: 'Cognitive Behavioral Therapy Exercise',
  description: 'Structured exercises for cognitive restructuring and behavioral analysis.',
  intent: 'EXERCISE',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION', 'PROGRESS', 'USER-PREFERENCE'],
  allowedTools: ['GET_PROGRESS', 'RECORD_CBT_ENTRY'], 
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: true,
    mustIncludeDisclaimer: true,
    maxLengthTokens: 2000
  }
};
