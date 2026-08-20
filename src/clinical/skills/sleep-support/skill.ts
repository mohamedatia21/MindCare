import { MentalHealthSkill } from '../skill-types.js';
export const SleepSupportSkill: MentalHealthSkill = {
  id: 'SLEEP_SUPPORT', name: 'Sleep Support', description: 'Sleep hygiene and relaxation.',
  intent: 'EDUCATION', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION', 'USER-PREFERENCE'], allowedTools: [],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: true, mustIncludeDisclaimer: false, maxLengthTokens: 1200 }
};
