/**
 * Evidence Decision Engine
 * 
 * Deterministic pre-routing layer that decides what evidence sources
 * should be consulted BEFORE the LLM processes a query.
 * 
 * The LLM may interpret retrieved evidence but MUST NOT bypass this router.
 * 
 * Decision Modes:
 *   INTERNAL_ONLY     - Use internal book/RAG only
 *   EXTERNAL_ONLY     - Use external MCP/web search only
 *   INTERNAL_AND_EXTERNAL - Use both, with conflict resolution
 *   NO_RETRIEVAL      - Pure conversational, no evidence needed
 *   CRISIS_PRIORITY   - Safety takes absolute precedence, no retrieval delay
 * 
 * Skill Traceability:
 *   Skill: context-engineering → "Determine what context the model needs"
 *   Skill: crisis-detection-intervention-ai → "Crisis always takes priority"
 */

import { SafetyState } from '../../core/types.js';

export type EvidenceMode = 
    | 'INTERNAL_ONLY'
    | 'EXTERNAL_ONLY'
    | 'INTERNAL_AND_EXTERNAL'
    | 'NO_RETRIEVAL'
    | 'CRISIS_PRIORITY';

export interface EvidenceDecision {
    mode: EvidenceMode;
    reason: string;
    useInternalRAG: boolean;
    useExternalSearch: boolean;
    maxExternalSources: number;
    timeoutMs: number;
}

// Keywords indicating the user wants factual/medical information
const MEDICAL_QUERY_PATTERNS = [
    // English
    /\b(what is|symptoms|treatment|medication|therapy|diagnosis|research|studies|evidence|guidelines|clinical|disorder|disease|condition|cause|prevention|risk factors)\b/i,
    // Arabic
    /(?:ايه|إيه|ما هو|ما هي|أعراض|علاج|دواء|أدوية|تشخيص|أبحاث|دراسات|أدلة|إرشادات|اضطراب|مرض|حالة|أسباب|وقاية|عوامل الخطر)/,
    // Egyptian Arabic colloquial
    /(?:يعني ايه|عايز اعرف|ممكن تقولي|قولي عن)/,
];

// Keywords indicating user wants current/latest information
const CURRENT_INFO_PATTERNS = [
    /\b(latest|recent|current|new|updated|2024|2025|2026|nowadays|modern)\b/i,
    /(?:أحدث|جديد|حالي|آخر|أخيرة|الحديثة)/,
];

// Keywords for research/statistics queries
const RESEARCH_PATTERNS = [
    /\b(research|study|studies|statistics|data|meta-analysis|trial|experiment|publication|journal|peer.?reviewed)\b/i,
    /(?:بحث|دراسة|دراسات|إحصائيات|بيانات|تجربة|منشور)/,
];

// Conversational/emotional patterns that don't need retrieval
const CONVERSATIONAL_PATTERNS = [
    /\b(hello|hi|hey|how are you|good morning|good night|thanks|thank you|bye|goodbye)\b/i,
    /(?:مرحبا|أهلا|صباح|مساء|شكرا|مع السلامة|ازيك|عامل ايه|الحمد لله|تصبح)/,
    /\b(i feel|i'm feeling|i am feeling|i'm sad|i'm happy|i'm anxious|i need someone)\b/i,
    /(?:حاسس|حاسة|مكتئب|قلقان|محتاج حد|زعلان|فرحان)/,
];

export class EvidenceDecisionEngine {
    private readonly DEFAULT_TIMEOUT_MS = 8000;
    private readonly DEFAULT_MAX_SOURCES = 5;

    /**
     * Determine the evidence retrieval strategy for a given query.
     * This is DETERMINISTIC — no LLM involved.
     */
    public decide(
        userMessage: string,
        safetyState: SafetyState,
        hasInternalRAG: boolean
    ): EvidenceDecision {
        // CRISIS always takes absolute priority — no retrieval delay
        if (safetyState === 'CRISIS') {
            return {
                mode: 'CRISIS_PRIORITY',
                reason: 'Safety state is CRISIS. No retrieval delay allowed.',
                useInternalRAG: false,
                useExternalSearch: false,
                maxExternalSources: 0,
                timeoutMs: 0,
            };
        }

        const isConversational = CONVERSATIONAL_PATTERNS.some(p => p.test(userMessage));
        const isMedicalQuery = MEDICAL_QUERY_PATTERNS.some(p => p.test(userMessage));
        const wantsCurrentInfo = CURRENT_INFO_PATTERNS.some(p => p.test(userMessage));
        const wantsResearch = RESEARCH_PATTERNS.some(p => p.test(userMessage));

        // Pure conversational — no retrieval needed
        if (isConversational && !isMedicalQuery) {
            return {
                mode: 'NO_RETRIEVAL',
                reason: 'Conversational/emotional input — no evidence retrieval required.',
                useInternalRAG: false,
                useExternalSearch: false,
                maxExternalSources: 0,
                timeoutMs: 0,
            };
        }

        // Wants latest/current/research info → external (with internal supplement)
        if (wantsCurrentInfo || wantsResearch) {
            return {
                mode: hasInternalRAG ? 'INTERNAL_AND_EXTERNAL' : 'EXTERNAL_ONLY',
                reason: wantsResearch 
                    ? 'User requested research/statistics — both internal and external evidence needed.'
                    : 'User requested current/latest information — external evidence needed.',
                useInternalRAG: hasInternalRAG,
                useExternalSearch: true,
                maxExternalSources: this.DEFAULT_MAX_SOURCES,
                timeoutMs: this.DEFAULT_TIMEOUT_MS,
            };
        }

        // Medical/factual query → try internal first, supplement if needed
        if (isMedicalQuery && hasInternalRAG) {
            return {
                mode: 'INTERNAL_ONLY',
                reason: 'Medical query — internal book knowledge should be consulted first.',
                useInternalRAG: true,
                useExternalSearch: false,
                maxExternalSources: 0,
                timeoutMs: this.DEFAULT_TIMEOUT_MS,
            };
        }

        // Medical query but no internal RAG → external only
        if (isMedicalQuery && !hasInternalRAG) {
            return {
                mode: 'EXTERNAL_ONLY',
                reason: 'Medical query — no internal RAG available, using external search.',
                useInternalRAG: false,
                useExternalSearch: true,
                maxExternalSources: this.DEFAULT_MAX_SOURCES,
                timeoutMs: this.DEFAULT_TIMEOUT_MS,
            };
        }

        // Default: let the LLM decide via tool calls (existing behavior)
        return {
            mode: 'NO_RETRIEVAL',
            reason: 'No strong evidence signal detected — defaulting to conversational mode.',
            useInternalRAG: false,
            useExternalSearch: false,
            maxExternalSources: 0,
            timeoutMs: 0,
        };
    }

    /**
     * If internal retrieval returns low-confidence results,
     * decide whether to supplement with external search.
     */
    public shouldSupplementWithExternal(
        internalGrounded: boolean,
        topScore: number,
        threshold: number
    ): boolean {
        // If internal retrieval found nothing relevant, supplement externally
        if (!internalGrounded) return true;
        // If top score is borderline (within 10% of threshold), supplement
        if (topScore < threshold + 0.10) return true;
        return false;
    }
}
