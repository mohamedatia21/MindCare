import { MentalHealthSkill } from '../skill-types.js';
export const BreathingSkill: MentalHealthSkill = {
  id: 'BREATHING', name: 'Breathing Exercises', description: 'Box breathing, diaphragmatic breathing.',
  intent: 'COPING', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION'], allowedTools: [],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: false, mustIncludeDisclaimer: false, maxLengthTokens: 600 }
};
