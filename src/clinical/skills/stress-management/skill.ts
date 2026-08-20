import { MentalHealthSkill } from '../skill-types.js';
export const StressManagementSkill: MentalHealthSkill = {
  id: 'STRESS_MANAGEMENT', name: 'Stress Management', description: 'Stress reduction education and planning.',
  intent: 'EDUCATION', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION'], allowedTools: [],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: true, mustIncludeDisclaimer: false, maxLengthTokens: 1200 }
};
