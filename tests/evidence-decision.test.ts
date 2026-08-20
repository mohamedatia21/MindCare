import { describe, it, expect } from 'vitest';
import { EvidenceDecisionEngine } from '../src/infrastructure/evidence/evidence-decision-engine.js';

describe('EvidenceDecisionEngine', () => {
    const engine = new EvidenceDecisionEngine();

    describe('CRISIS_PRIORITY', () => {
        it('returns CRISIS_PRIORITY when safety state is CRISIS', () => {
            const decision = engine.decide('ايه أعراض الاكتئاب', 'CRISIS', true);
            expect(decision.mode).toBe('CRISIS_PRIORITY');
            expect(decision.useInternalRAG).toBe(false);
            expect(decision.useExternalSearch).toBe(false);
            expect(decision.timeoutMs).toBe(0);
        });

        it('CRISIS overrides even medical queries', () => {
            const decision = engine.decide('what is the treatment for depression', 'CRISIS', true);
            expect(decision.mode).toBe('CRISIS_PRIORITY');
        });

        it('CRISIS overrides research queries', () => {
            const decision = engine.decide('latest studies on anxiety treatment', 'CRISIS', true);
            expect(decision.mode).toBe('CRISIS_PRIORITY');
        });
    });

    describe('NO_RETRIEVAL — Conversational', () => {
        it('detects English greetings as conversational', () => {
            const decision = engine.decide('hello how are you', 'SAFE', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });

        it('detects Arabic greetings as conversational', () => {
            const decision = engine.decide('أهلا ازيك', 'SAFE', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });

        it('detects emotional expressions as conversational', () => {
            const decision = engine.decide('I feel sad today', 'SAFE', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });

        it('detects Arabic emotional expressions as conversational', () => {
            const decision = engine.decide('حاسس بقلق', 'SAFE', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });

        it('detects thanks as conversational', () => {
            const decision = engine.decide('thanks for the help', 'SAFE', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });
    });

    describe('INTERNAL_ONLY — Medical queries with RAG', () => {
        it('routes medical queries to internal when RAG available', () => {
            const decision = engine.decide('what are the symptoms of depression', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_ONLY');
            expect(decision.useInternalRAG).toBe(true);
            expect(decision.useExternalSearch).toBe(false);
        });

        it('routes Arabic medical queries to internal', () => {
            const decision = engine.decide('ايه أعراض القلق', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_ONLY');
            expect(decision.useInternalRAG).toBe(true);
        });

        it('routes treatment queries to internal', () => {
            const decision = engine.decide('ايه علاج الاكتئاب', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_ONLY');
        });

        it('routes colloquial Arabic queries to internal', () => {
            const decision = engine.decide('عايز اعرف عن القلق', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_ONLY');
        });
    });

    describe('EXTERNAL_ONLY — Medical queries without RAG', () => {
        it('routes to external when no internal RAG', () => {
            const decision = engine.decide('what are the symptoms of depression', 'SAFE', false);
            expect(decision.mode).toBe('EXTERNAL_ONLY');
            expect(decision.useInternalRAG).toBe(false);
            expect(decision.useExternalSearch).toBe(true);
        });
    });

    describe('INTERNAL_AND_EXTERNAL — Research/Current queries', () => {
        it('routes research queries to both sources', () => {
            const decision = engine.decide('latest research on CBT for anxiety', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_AND_EXTERNAL');
            expect(decision.useInternalRAG).toBe(true);
            expect(decision.useExternalSearch).toBe(true);
        });

        it('routes "latest" queries to both sources', () => {
            const decision = engine.decide('what is the current treatment for PTSD', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_AND_EXTERNAL');
        });

        it('routes statistics queries to both sources', () => {
            const decision = engine.decide('statistics on depression worldwide', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_AND_EXTERNAL');
        });

        it('routes Arabic research queries to both', () => {
            const decision = engine.decide('أحدث دراسات عن القلق', 'SAFE', true);
            expect(decision.mode).toBe('INTERNAL_AND_EXTERNAL');
        });
    });

    describe('shouldSupplementWithExternal', () => {
        it('recommends supplement when internal is not grounded', () => {
            expect(engine.shouldSupplementWithExternal(false, 0.3, 0.65)).toBe(true);
        });

        it('recommends supplement when score is borderline', () => {
            expect(engine.shouldSupplementWithExternal(true, 0.70, 0.65)).toBe(true);
        });

        it('does not recommend supplement for high-confidence match', () => {
            expect(engine.shouldSupplementWithExternal(true, 0.90, 0.65)).toBe(false);
        });
    });

    describe('ELEVATED safety state', () => {
        it('still routes medical queries normally in ELEVATED', () => {
            const decision = engine.decide('ايه أعراض الاكتئاب', 'ELEVATED', true);
            expect(decision.mode).toBe('INTERNAL_ONLY');
        });

        it('still allows conversational in ELEVATED', () => {
            const decision = engine.decide('شكرا على المساعدة', 'ELEVATED', true);
            expect(decision.mode).toBe('NO_RETRIEVAL');
        });
    });
});
