import { MentalHealthSkill } from '../skill-types.js';

export const GroundingSkill: MentalHealthSkill = {
  id: 'GROUNDING',
  name: 'Grounding Exercises',
  description: 'Immediate somatic and sensory coping exercises (e.g. 5-4-3-2-1).',
  intent: 'COPING',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION'],
  allowedTools: [], 
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: false,
    mustIncludeDisclaimer: false,
    maxLengthTokens: 800
  }
};
