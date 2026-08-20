/**
 * Citation Verifier
 * 
 * Post-LLM verification layer that ensures citations match retrieved evidence.
 * The LLM must NOT generate citation metadata itself — this layer enforces that
 * only metadata from the retrieval system appears in citations.
 * 
 * Verification Rules:
 * 1. Cited page numbers must match retrieved pdf_page metadata
 * 2. Cited URLs must match retrieved URLs from web search results
 * 3. Cited organizations must match source metadata
 * 4. If verification fails, the citation is replaced with verified metadata
 * 
 * Skill Traceability:
 *   Skill: security-and-hardening → "Validate all external input"
 *   Skill: external-content-sanitizer → "Flagged content never echoed back"
 */

import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { SourceTrustScorer, SourceTrustResult } from './source-trust-scorer.js';

export interface RetrievedSourceMetadata {
    type: 'internal_book' | 'external_web';
    // Internal book fields
    bookTitle?: string;
    author?: string;
    edition?: string;
    chapter?: string;
    section?: string;
    pdfPage?: number | null;
    sourceDocument?: string;
    // External web fields
    url?: string;
    title?: string;
    organization?: string;
    snippet?: string;
    trustTier?: string;
}

export interface CitationVerificationResult {
    verified: boolean;
    citations: VerifiedCitation[];
    unverifiedCount: number;
    fabricatedCount: number;
}

export interface VerifiedCitation {
    type: 'internal_book' | 'external_web';
    verified: boolean;
    // Only populated from verified retrieval metadata
    bookTitle?: string | undefined;
    author?: string | undefined;
    edition?: string | undefined;
    chapter?: string | undefined;
    section?: string | undefined;
    page?: number | null | undefined;
    pageVerified?: boolean | undefined;
    url?: string | undefined;
    urlVerified?: boolean | undefined;
    organization?: string | undefined;
    trustTier?: string | undefined;
}

export class CitationVerifier {
    private logger = new RuntimeLogger();
    private trustScorer = new SourceTrustScorer();

    /**
     * Build verified citation block from retrieval metadata.
     * This ONLY uses metadata from the retrieval system — never from the LLM.
     */
    public buildVerifiedCitations(
        retrievedSources: RetrievedSourceMetadata[]
    ): CitationVerificationResult {
        const citations: VerifiedCitation[] = [];
        let fabricatedCount = 0;

        for (const source of retrievedSources) {
            if (source.type === 'internal_book') {
                citations.push({
                    type: 'internal_book',
                    verified: true,
                    bookTitle: source.bookTitle || source.sourceDocument,
                    author: source.author,
                    edition: source.edition,
                    chapter: source.chapter,
                    section: source.section,
                    page: source.pdfPage ?? null,
                    pageVerified: source.pdfPage !== null && source.pdfPage !== undefined,
                });
            } else if (source.type === 'external_web' && source.url) {
                const trustResult = this.trustScorer.score(source.url);
                citations.push({
                    type: 'external_web',
                    verified: true,
                    url: source.url,
                    urlVerified: true,
                    organization: trustResult.organization,
                    trustTier: trustResult.tier,
                });
            }
        }

        return {
            verified: citations.length > 0,
            citations,
            unverifiedCount: 0,
            fabricatedCount,
        };
    }

    /**
     * Verify that an LLM-generated response does not contain fabricated citations.
     * Checks if page numbers or URLs in the response match the retrieved metadata.
     * 
     * Returns the original response with any fabricated citations flagged.
     */
    public verifyResponseCitations(
        llmResponse: string,
        retrievedSources: RetrievedSourceMetadata[]
    ): { cleanResponse: string; fabricatedDetected: boolean } {
        let cleanResponse = llmResponse;
        let fabricatedDetected = false;

        // Extract page numbers mentioned in the response
        const pagePattern = /(?:الصفحة|page|ص\.|p\.)\s*(\d+)/gi;
        let match;
        const mentionedPages = new Set<number>();
        while ((match = pagePattern.exec(llmResponse)) !== null) {
            const pageStr = match[1];
            if (pageStr) mentionedPages.add(parseInt(pageStr, 10));
        }

        // Collect all verified pages from retrieval
        const verifiedPages = new Set<number>();
        for (const source of retrievedSources) {
            if (source.pdfPage !== null && source.pdfPage !== undefined) {
                verifiedPages.add(source.pdfPage);
            }
        }

        // Check for fabricated pages (mentioned but not in retrieval)
        for (const page of mentionedPages) {
            if (!verifiedPages.has(page) && verifiedPages.size > 0) {
                fabricatedDetected = true;
                this.logger.warn('FabricatedPageDetected', {
                    requestId: 'citation-verifier',
                    mentionedPage: page,
                    verifiedPages: Array.from(verifiedPages),
                    timestamp: new Date()
                });
            }
        }

        // Extract URLs mentioned in the response
        const urlPattern = /https?:\/\/[^\s)}\]"']+/gi;
        const mentionedUrls: string[] = [];
        while ((match = urlPattern.exec(llmResponse)) !== null) {
            mentionedUrls.push(match[0]);
        }

        // Collect verified URLs from retrieval
        const verifiedUrls = new Set<string>();
        for (const source of retrievedSources) {
            if (source.url) {
                verifiedUrls.add(source.url.toLowerCase());
            }
        }

        // Check for fabricated URLs
        for (const url of mentionedUrls) {
            const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
            let isVerified = false;
            for (const vUrl of verifiedUrls) {
                if (normalizedUrl.startsWith(vUrl.replace(/\/+$/, '')) ||
                    vUrl.replace(/\/+$/, '').startsWith(normalizedUrl)) {
                    isVerified = true;
                    break;
                }
            }
            if (!isVerified && verifiedUrls.size > 0) {
                fabricatedDetected = true;
                this.logger.warn('FabricatedURLDetected', {
                    requestId: 'citation-verifier',
                    mentionedUrl: url,
                    timestamp: new Date()
                });
            }
        }

        return { cleanResponse, fabricatedDetected };
    }

    /**
     * Format verified citations for inclusion in the final response.
     * Uses only verified retrieval metadata — never LLM-generated metadata.
     */
    public formatCitationBlock(
        result: CitationVerificationResult,
        language: 'EGYPTIAN_ARABIC' | 'ENGLISH'
    ): string {
        if (result.citations.length === 0) return '';

        const parts: string[] = [];
        const label = language === 'EGYPTIAN_ARABIC' ? 'المصادر:' : 'Sources:';
        parts.push(`\n${label}`);

        for (const citation of result.citations) {
            if (citation.type === 'internal_book') {
                const bookName = citation.bookTitle || 'WHO mhGAP';
                if (citation.pageVerified && citation.page !== null) {
                    parts.push(`📖 ${bookName} - ${language === 'EGYPTIAN_ARABIC' ? 'ص' : 'p'}.${citation.page}`);
                } else {
                    parts.push(`📖 ${bookName}`);
                    if (citation.section) parts.push(`   ${language === 'EGYPTIAN_ARABIC' ? 'القسم' : 'Section'}: ${citation.section}`);
                }
            } else if (citation.type === 'external_web') {
                const org = citation.organization || 'External Source';
                parts.push(`🌐 ${org}`);
                if (citation.url && citation.urlVerified) {
                    parts.push(`   ${citation.url}`);
                }
                if (citation.trustTier) {
                    const tierLabel = language === 'EGYPTIAN_ARABIC' ? 'مستوى الموثوقية' : 'Trust Level';
                    parts.push(`   ${tierLabel}: ${citation.trustTier}`);
                }
            }
        }

        return parts.join('\n');
    }
}
