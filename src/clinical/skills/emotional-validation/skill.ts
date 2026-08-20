import { MentalHealthSkill } from '../skill-types.js';
export const EmotionalValidationSkill: MentalHealthSkill = {
  id: 'EMOTIONAL_VALIDATION', name: 'Emotional Validation', description: 'Affirming emotional experiences.',
  intent: 'SUPPORT', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION'], allowedTools: [],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: false, mustIncludeDisclaimer: false, maxLengthTokens: 800 }
};
