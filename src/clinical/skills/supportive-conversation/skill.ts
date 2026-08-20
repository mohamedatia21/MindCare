import { MentalHealthSkill } from '../skill-types.js';

export const SupportiveConversationSkill: MentalHealthSkill = {
  id: 'SUPPORTIVE_CONVERSATION',
  name: 'Supportive Conversation',
  description: 'General empathetic, non-directive active listening and support.',
  intent: 'SUPPORT',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION', 'USER-PREFERENCE'],
  allowedTools: ['KNOWLEDGE_BASE_SEARCH', 'WEB_MEDICAL_SEARCH'], // RAG allowed for grounded empathy
  prohibitedActions: ['DIAGNOSE', 'PRESCRIBE_MEDICATION', 'OVERRIDE_SAFETY_STATE', 'DIRECT_MEMORY_WRITE', 'DIRECT_MCP_ACCESS', 'EXECUTE_UNAUTHORIZED_TOOLS'],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: false,
    mustIncludeDisclaimer: false,
    maxLengthTokens: 1000
  }
};
