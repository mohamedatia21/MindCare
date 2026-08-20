import { MentalHealthSkill } from '../skill-types.js';
export const PsychoeducationSkill: MentalHealthSkill = {
  id: 'PSYCHOEDUCATION', name: 'Psychoeducation', description: 'Educational information regarding mental health concepts.',
  intent: 'EDUCATION', allowedSafetyStates: ['SAFE', 'ELEVATED'], allowedMemoryClasses: ['SESSION'], allowedTools: ['FETCH_EXTERNAL_DOCUMENT', 'KNOWLEDGE_BASE_SEARCH', 'WEB_MEDICAL_SEARCH'],
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: { mustBeNonDiagnostic: true, mustBeEducational: true, mustIncludeDisclaimer: true, maxLengthTokens: 2000 }
};
