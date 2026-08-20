import { MentalHealthSkill } from '../skill-types.js';

export const JournalingSkill: MentalHealthSkill = {
  id: 'JOURNALING',
  name: 'Guided Journaling',
  description: 'Prompts and reflection for personal journaling.',
  intent: 'REFLECTION',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION', 'PROGRESS', 'USER-PREFERENCE'],
  allowedTools: ['WRITE_JOURNAL_ENTRY'], 
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: false,
    mustIncludeDisclaimer: false,
    maxLengthTokens: 1500
  }
};
