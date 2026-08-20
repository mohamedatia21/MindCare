import { MentalHealthSkill } from '../skill-types.js';

/**
 * Evidence Retrieval Skill
 * 
 * Specialized skill for evidence-grounded factual responses.
 * Allows both internal book search and external web search.
 * Requires source citations and educational disclaimers.
 * 
 * Skill Traceability:
 *   Category: 01-clinical-core
 *   Purpose: Evidence-grounded answers with verified source citations
 *   Tools: KNOWLEDGE_BASE_SEARCH, WEB_MEDICAL_SEARCH
 */
export const EvidenceRetrievalSkill: MentalHealthSkill = {
  id: 'PSYCHOEDUCATION', // Reuses PSYCHOEDUCATION slot as it has the same intent
  name: 'Evidence-Based Knowledge Retrieval',
  description: 'Retrieves and presents evidence-grounded medical/psychological information with verified source citations.',
  intent: 'EDUCATION',
  allowedSafetyStates: ['SAFE', 'ELEVATED'],
  allowedMemoryClasses: ['SESSION'],
  allowedTools: ['KNOWLEDGE_BASE_SEARCH', 'WEB_MEDICAL_SEARCH', 'FETCH_EXTERNAL_DOCUMENT'],
  prohibitedActions: [
    'DIAGNOSE',
    'PRESCRIBE_MEDICATION',
    'OVERRIDE_SAFETY_STATE',
    'DIRECT_MEMORY_WRITE',
    'DIRECT_MCP_ACCESS',
    'EXECUTE_UNAUTHORIZED_TOOLS'
  ],
  outputConstraints: {
    mustBeNonDiagnostic: true,
    mustBeEducational: true,
    mustIncludeDisclaimer: true,
    maxLengthTokens: 2000
  }
};
