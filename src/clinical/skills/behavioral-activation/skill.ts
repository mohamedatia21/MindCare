import { MentalHealthSkill } from '../skill-types.js';
export const BehavioralActivationSkill: MentalHealthSkill = {
  id: 'BEHAVIORAL_ACTIVATION', name: 'Behavioral Activation', description: 'Goal setting and task activation.',
  intent: 'EXERCISE', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION', 'PROGRESS'], allowedTools: ['GET_PROGRESS'],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: true, mustIncludeDisclaimer: false, maxLengthTokens: 1500 }
};
