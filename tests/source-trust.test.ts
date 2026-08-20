import { describe, it, expect } from 'vitest';
import { SourceTrustScorer, SourceTrustTier } from '../src/infrastructure/evidence/source-trust-scorer.js';

describe('SourceTrustScorer', () => {
    const scorer = new SourceTrustScorer();

    describe('TIER_A — Government / International Health Organizations', () => {
        it('scores WHO as TIER_A', () => {
            const result = scorer.score('https://www.who.int/mental-health');
            expect(result.tier).toBe('TIER_A');
            expect(result.organization).toContain('WHO');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores NIMH as TIER_A', () => {
            const result = scorer.score('https://www.nimh.nih.gov/health/topics/depression');
            expect(result.tier).toBe('TIER_A');
            expect(result.organization).toContain('NIMH');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores NIH as TIER_A', () => {
            const result = scorer.score('https://www.nih.gov/research');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores CDC as TIER_A', () => {
            const result = scorer.score('https://www.cdc.gov/mental-health');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores NHS as TIER_A', () => {
            const result = scorer.score('https://www.nhs.uk/mental-health');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores APA as TIER_A', () => {
            const result = scorer.score('https://www.apa.org/topics/anxiety');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores NICE as TIER_A', () => {
            const result = scorer.score('https://www.nice.org.uk/guidance');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores NIH subdomains as TIER_A', () => {
            const result = scorer.score('https://health.nih.gov/topics');
            expect(result.tier).toBe('TIER_A');
        });
    });

    describe('TIER_B — Peer-Reviewed / Academic', () => {
        it('scores PubMed as TIER_A (NIH subdomain)', () => {
            const result = scorer.score('https://pubmed.ncbi.nlm.nih.gov/12345678/');
            expect(result.tier).toBe('TIER_A');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores Mayo Clinic as TIER_B', () => {
            const result = scorer.score('https://www.mayoclinic.org/diseases-conditions/depression');
            expect(result.tier).toBe('TIER_B');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores Cleveland Clinic as TIER_B', () => {
            const result = scorer.score('https://www.clevelandclinic.org/health');
            expect(result.tier).toBe('TIER_B');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores Cochrane as TIER_B', () => {
            const result = scorer.score('https://www.cochranelibrary.com/cdsr');
            expect(result.tier).toBe('TIER_B');
            expect(result.isAllowedForClinical).toBe(true);
        });
    });

    describe('TIER_C — Recognized Education', () => {
        it('scores Wikipedia English as TIER_C', () => {
            const result = scorer.score('https://en.wikipedia.org/wiki/Depression');
            expect(result.tier).toBe('TIER_C');
            expect(result.isAllowedForClinical).toBe(true);
        });

        it('scores Wikipedia Arabic as TIER_C', () => {
            const result = scorer.score('https://ar.wikipedia.org/wiki/اكتئاب');
            expect(result.tier).toBe('TIER_C');
        });

        it('scores WebTeb as TIER_C', () => {
            const result = scorer.score('https://www.webteb.com/mental-health');
            expect(result.tier).toBe('TIER_C');
        });

        it('scores Altibbi as TIER_C', () => {
            const result = scorer.score('https://www.altibbi.com/مقالات-طبية');
            expect(result.tier).toBe('TIER_C');
        });
    });

    describe('TIER_D — General Web', () => {
        it('scores unknown domains as TIER_D', () => {
            const result = scorer.score('https://randomhealthsite.com/article');
            expect(result.tier).toBe('TIER_D');
            expect(result.isAllowedForClinical).toBe(false);
        });
    });

    describe('TIER_E — Blocked', () => {
        it('blocks Reddit', () => {
            const result = scorer.score('https://www.reddit.com/r/mentalhealth');
            expect(result.tier).toBe('TIER_E');
            expect(result.isAllowedForClinical).toBe(false);
        });

        it('blocks Twitter/X', () => {
            expect(scorer.score('https://twitter.com/WHO').tier).toBe('TIER_E');
            expect(scorer.score('https://x.com/WHO').tier).toBe('TIER_E');
        });

        it('blocks Facebook', () => {
            const result = scorer.score('https://www.facebook.com/healthpage');
            expect(result.tier).toBe('TIER_E');
        });

        it('blocks Quora', () => {
            const result = scorer.score('https://www.quora.com/What-is-depression');
            expect(result.tier).toBe('TIER_E');
        });

        it('blocks Medium', () => {
            const result = scorer.score('https://medium.com/@someone/mental-health');
            expect(result.tier).toBe('TIER_E');
        });

        it('blocks invalid URLs', () => {
            const result = scorer.score('not-a-url');
            expect(result.tier).toBe('TIER_E');
        });
    });

    describe('scoreAndRank', () => {
        it('sorts results by trust tier (highest first)', () => {
            const urls = [
                'https://en.wikipedia.org/wiki/CBT',
                'https://www.who.int/mhgap',
                'https://www.mayoclinic.org/cbt',
                'https://randomsite.com/health',
            ];
            const ranked = scorer.scoreAndRank(urls);
            expect(ranked[0]!.tier).toBe('TIER_A');
            expect(ranked[1]!.tier).toBe('TIER_B');
            expect(ranked[2]!.tier).toBe('TIER_C');
            expect(ranked[3]!.tier).toBe('TIER_D');
        });
    });
});
