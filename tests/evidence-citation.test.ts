import { describe, it, expect } from 'vitest';
import { CitationVerifier, RetrievedSourceMetadata } from '../src/infrastructure/evidence/citation-verifier.js';

describe('CitationVerifier', () => {
    const verifier = new CitationVerifier();

    describe('buildVerifiedCitations', () => {
        it('builds verified internal book citation with page', () => {
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                bookTitle: 'mhGAP Intervention Guide',
                author: 'World Health Organization',
                edition: 'Version 2.0 (2016)',
                chapter: 'Depression',
                section: 'Assessment',
                pdfPage: 42,
            }];
            const result = verifier.buildVerifiedCitations(sources);
            expect(result.verified).toBe(true);
            expect(result.citations).toHaveLength(1);
            expect(result.citations[0]!.type).toBe('internal_book');
            expect(result.citations[0]!.page).toBe(42);
            expect(result.citations[0]!.pageVerified).toBe(true);
            expect(result.citations[0]!.bookTitle).toBe('mhGAP Intervention Guide');
        });

        it('builds citation with pageVerified=false when page is null', () => {
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: null,
            }];
            const result = verifier.buildVerifiedCitations(sources);
            expect(result.citations[0]!.pageVerified).toBe(false);
            expect(result.citations[0]!.page).toBeNull();
        });

        it('builds verified external web citation with trust tier', () => {
            const sources: RetrievedSourceMetadata[] = [{
                type: 'external_web',
                url: 'https://www.who.int/mental-health/depression',
                title: 'Depression - WHO',
                organization: 'World Health Organization',
            }];
            const result = verifier.buildVerifiedCitations(sources);
            expect(result.verified).toBe(true);
            expect(result.citations[0]!.type).toBe('external_web');
            expect(result.citations[0]!.urlVerified).toBe(true);
            expect(result.citations[0]!.trustTier).toBe('TIER_A');
        });

        it('returns empty citations for empty sources', () => {
            const result = verifier.buildVerifiedCitations([]);
            expect(result.verified).toBe(false);
            expect(result.citations).toHaveLength(0);
        });

        it('handles mixed internal and external sources', () => {
            const sources: RetrievedSourceMetadata[] = [
                { type: 'internal_book', sourceDocument: 'WHO_mhGAP', pdfPage: 15 },
                { type: 'external_web', url: 'https://www.nimh.nih.gov/health/topics/depression' },
            ];
            const result = verifier.buildVerifiedCitations(sources);
            expect(result.citations).toHaveLength(2);
            expect(result.citations[0]!.type).toBe('internal_book');
            expect(result.citations[1]!.type).toBe('external_web');
        });
    });

    describe('verifyResponseCitations — fabricated page detection', () => {
        it('detects fabricated page numbers', () => {
            const response = 'الاكتئاب يؤثر على ملايين الناس حول العالم.\nالمصدر: WHO mhGAP - الصفحة 99';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: 42,
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(true);
        });

        it('accepts correct page numbers', () => {
            const response = 'الاكتئاب يؤثر على ملايين الناس.\nالمصدر: WHO mhGAP - الصفحة 42';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: 42,
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(false);
        });

        it('accepts English page format', () => {
            const response = 'Depression affects millions. Source: WHO mhGAP page 42';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: 42,
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(false);
        });

        it('does not flag pages when no sources have page metadata', () => {
            const response = 'Some info from page 99.';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: null,
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            // No verified pages to compare against, so no fabrication flag
            expect(result.fabricatedDetected).toBe(false);
        });
    });

    describe('verifyResponseCitations — fabricated URL detection', () => {
        it('detects fabricated URLs', () => {
            const response = 'Info from https://www.fake-medical-site.com/article';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'external_web',
                url: 'https://www.who.int/real-article',
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(true);
        });

        it('accepts verified URLs', () => {
            const response = 'Info from https://www.who.int/real-article';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'external_web',
                url: 'https://www.who.int/real-article',
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(false);
        });

        it('does not flag URLs when no sources have URL metadata', () => {
            const response = 'Info from https://www.example.com/article';
            const sources: RetrievedSourceMetadata[] = [{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: 42,
            }];
            const result = verifier.verifyResponseCitations(response, sources);
            expect(result.fabricatedDetected).toBe(false);
        });
    });

    describe('formatCitationBlock', () => {
        it('formats Arabic internal book citation with page', () => {
            const result = verifier.buildVerifiedCitations([{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                bookTitle: 'mhGAP Intervention Guide',
                pdfPage: 42,
            }]);
            const block = verifier.formatCitationBlock(result, 'EGYPTIAN_ARABIC');
            expect(block).toContain('المصادر:');
            expect(block).toContain('📖');
            expect(block).toContain('mhGAP Intervention Guide');
            expect(block).toContain('ص.42');
        });

        it('formats Arabic external citation with trust tier', () => {
            const result = verifier.buildVerifiedCitations([{
                type: 'external_web',
                url: 'https://www.who.int/depression',
            }]);
            const block = verifier.formatCitationBlock(result, 'EGYPTIAN_ARABIC');
            expect(block).toContain('🌐');
            expect(block).toContain('who.int');
            expect(block).toContain('مستوى الموثوقية');
        });

        it('formats English citation', () => {
            const result = verifier.buildVerifiedCitations([{
                type: 'internal_book',
                sourceDocument: 'WHO_mhGAP',
                pdfPage: 42,
            }]);
            const block = verifier.formatCitationBlock(result, 'ENGLISH');
            expect(block).toContain('Sources:');
            expect(block).toContain('p.42');
        });

        it('returns empty string for no citations', () => {
            const result = verifier.buildVerifiedCitations([]);
            const block = verifier.formatCitationBlock(result, 'EGYPTIAN_ARABIC');
            expect(block).toBe('');
        });
    });
});
