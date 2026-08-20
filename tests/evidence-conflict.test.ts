import { describe, it, expect } from 'vitest';
import { EvidenceConflictResolver, EvidenceSource } from '../src/infrastructure/evidence/evidence-conflict-resolver.js';

describe('EvidenceConflictResolver', () => {
    const resolver = new EvidenceConflictResolver();

    describe('No conflict scenarios', () => {
        it('returns no conflict when only internal source exists', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Depression treatment includes CBT and medication.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
                page: 42,
            };
            const result = resolver.resolve(internal, null);
            expect(result.hasConflict).toBe(false);
        });

        it('returns no conflict when only external source exists', () => {
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Depression treatment includes therapy.',
                trustTier: 'TIER_A',
                sourceName: 'NIMH',
                url: 'https://www.nimh.nih.gov/depression',
            };
            const result = resolver.resolve(null, external);
            expect(result.hasConflict).toBe(false);
        });

        it('returns no conflict when both sources agree', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'CBT cognitive behavioral therapy is effective treatment for depression anxiety disorders',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'CBT cognitive behavioral therapy is an effective treatment for depression and anxiety disorders',
                trustTier: 'TIER_A',
                sourceName: 'NIMH',
            };
            const result = resolver.resolve(internal, external);
            expect(result.hasConflict).toBe(false);
        });
    });

    describe('Conflict detection and resolution', () => {
        it('detects conflict between different content', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'First-line treatment for mild depression is psychoeducation and self-help.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
                page: 42,
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Pharmacological intervention with SSRIs is recommended as initial approach.',
                trustTier: 'TIER_B',
                sourceName: 'Mayo Clinic',
                url: 'https://www.mayoclinic.org/depression',
            };
            const result = resolver.resolve(internal, external);
            expect(result.hasConflict).toBe(true);
            expect(result.conflictDescription).toBeDefined();
            expect(result.transparencyNote).toBeDefined();
        });

        it('prefers TIER_A over INTERNAL (TIER_B equivalent)', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Recommendation A from the internal reference book.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Updated recommendation B from the government health agency.',
                trustTier: 'TIER_A',
                sourceName: 'NIMH',
            };
            const result = resolver.resolve(internal, external);
            expect(result.hasConflict).toBe(true);
            expect(result.recommendedSource?.sourceName).toBe('NIMH');
            expect(result.reason).toContain('higher authority');
        });

        it('prefers INTERNAL over TIER_C', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Authoritative medical guidance from the reference book.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Different information from a less authoritative educational source.',
                trustTier: 'TIER_C',
                sourceName: 'Wikipedia',
            };
            const result = resolver.resolve(internal, external);
            expect(result.hasConflict).toBe(true);
            expect(result.recommendedSource?.sourceName).toBe('WHO mhGAP');
        });

        it('prefers newer source when authority is equal', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Psychoeducation and watchful waiting are recommended as initial management for mild depressive episodes according to the handbook.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
                publicationDate: '2016-01-01',
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Systematic review pooled data from randomized controlled trials shows significant benefit of digital CBT interventions delivered via smartphone applications.',
                trustTier: 'TIER_B',
                sourceName: 'Cochrane Review',
                publicationDate: '2024-06-15',
            };
            const result = resolver.resolve(internal, external);
            expect(result.hasConflict).toBe(true);
            expect(result.recommendedSource?.sourceName).toBe('Cochrane Review');
            expect(result.reason).toContain('newer');
        });
    });

    describe('Transparency notes', () => {
        it('generates Arabic transparency note', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Internal approach for mild cases.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
                page: 55,
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'External different approach for moderate and severe cases.',
                trustTier: 'TIER_A',
                sourceName: 'NIMH',
                url: 'https://www.nimh.nih.gov/article',
            };
            const result = resolver.resolve(internal, external);
            expect(result.transparencyNote).toContain('المصدر الداخلي');
            expect(result.transparencyNote).toContain('المصدر الخارجي');
        });

        it('includes page number in transparency note when available', () => {
            const internal: EvidenceSource = {
                type: 'internal_book',
                content: 'Some different internal recommendation.',
                trustTier: 'INTERNAL',
                sourceName: 'WHO mhGAP',
                page: 77,
            };
            const external: EvidenceSource = {
                type: 'external_web',
                content: 'Some different external recommendation altogether.',
                trustTier: 'TIER_A',
                sourceName: 'WHO Updated',
            };
            const result = resolver.resolve(internal, external);
            expect(result.transparencyNote).toContain('ص.77');
        });
    });
});
