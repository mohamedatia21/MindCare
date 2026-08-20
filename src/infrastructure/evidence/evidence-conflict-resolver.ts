/**
 * Evidence Conflict Resolver
 * 
 * Detects and resolves conflicts between internal book knowledge
 * and external web evidence. Never silently chooses one source.
 * 
 * Resolution Strategy:
 *   1. Compare source authority (TIER_A > TIER_B > TIER_C)
 *   2. Compare publication date (newer wins for clinical guidelines)
 *   3. Generate transparent conflict annotation for the LLM
 *   4. Never hide contradictory evidence from the user
 * 
 * Skill Traceability:
 *   Skill: context-engineering → "Provide accurate, non-contradictory context"
 *   Skill: crisis-detection-intervention-ai → "Safety overrides evidence conflicts"
 */

import { SourceTrustTier } from './source-trust-scorer.js';

export interface EvidenceSource {
    type: 'internal_book' | 'external_web';
    content: string;
    trustTier: SourceTrustTier | 'INTERNAL';
    sourceName: string;
    publicationDate?: string;
    section?: string;
    page?: number | null;
    url?: string;
}

export interface ConflictReport {
    hasConflict: boolean;
    conflictDescription?: string;
    recommendedSource?: EvidenceSource;
    reason?: string;
    transparencyNote?: string;
}

const TIER_AUTHORITY: Record<string, number> = {
    'INTERNAL': 3, // Internal book = TIER_B equivalent (WHO mhGAP)
    'TIER_A': 4,
    'TIER_B': 3,
    'TIER_C': 2,
    'TIER_D': 1,
    'TIER_E': 0,
};

export class EvidenceConflictResolver {
    /**
     * Compare two evidence sources and produce a conflict report.
     * If both agree, returns hasConflict: false.
     * If they disagree, provides transparent resolution.
     */
    public resolve(
        internalSource: EvidenceSource | null,
        externalSource: EvidenceSource | null
    ): ConflictReport {
        // No conflict if only one source exists
        if (!internalSource || !externalSource) {
            return { hasConflict: false };
        }

        // Simple heuristic: if content is substantively similar, no conflict
        const similarity = this.textSimilarity(internalSource.content, externalSource.content);
        if (similarity > 0.6) {
            return { hasConflict: false };
        }

        // Conflict detected — resolve by authority and date
        const internalAuthority = TIER_AUTHORITY[internalSource.trustTier] ?? 2;
        const externalAuthority = TIER_AUTHORITY[externalSource.trustTier] ?? 1;

        let recommended: EvidenceSource;
        let reason: string;

        if (externalAuthority > internalAuthority) {
            recommended = externalSource;
            reason = `External source (${externalSource.sourceName}, ${externalSource.trustTier}) has higher authority.`;
        } else if (internalAuthority > externalAuthority) {
            recommended = internalSource;
            reason = `Internal book (${internalSource.sourceName}) has higher or equal authority.`;
        } else {
            // Equal authority — prefer newer if dates available
            if (externalSource.publicationDate && internalSource.publicationDate) {
                const extDate = new Date(externalSource.publicationDate);
                const intDate = new Date(internalSource.publicationDate);
                if (extDate > intDate) {
                    recommended = externalSource;
                    reason = `Both sources have equal authority. External source is newer.`;
                } else {
                    recommended = internalSource;
                    reason = `Both sources have equal authority. Internal source is preferred.`;
                }
            } else {
                // Default to internal book (WHO mhGAP is authoritative)
                recommended = internalSource;
                reason = `Equal authority — defaulting to internal reference book.`;
            }
        }

        const transparencyNote = this.buildTransparencyNote(
            internalSource, externalSource, recommended, reason
        );

        return {
            hasConflict: true,
            conflictDescription: `Conflict between ${internalSource.sourceName} and ${externalSource.sourceName}.`,
            recommendedSource: recommended,
            reason,
            transparencyNote
        };
    }

    /**
     * Build a transparency note that can be shown to the user.
     * The user should always know when sources disagree.
     */
    private buildTransparencyNote(
        internal: EvidenceSource,
        external: EvidenceSource,
        recommended: EvidenceSource,
        reason: string
    ): string {
        const isArabic = true; // Default to Arabic for MindCare

        if (isArabic) {
            const internalLabel = internal.page 
                ? `${internal.sourceName} (ص.${internal.page})`
                : internal.sourceName;
            const externalLabel = external.url 
                ? `${external.sourceName} (${external.url})`
                : external.sourceName;
            const recommendedLabel = recommended === internal ? 'المصدر الداخلي' : 'المصدر الخارجي';

            return `ملاحظة: المصدر الداخلي (${internalLabel}) والمصدر الخارجي (${externalLabel}) يقدمان معلومات مختلفة. تم الاعتماد على ${recommendedLabel} لأن: ${reason}`;
        }

        return `Note: Internal source (${internal.sourceName}) and external source (${external.sourceName}) provide different information. Recommended: ${recommended.sourceName}. Reason: ${reason}`;
    }

    /**
     * Simple text similarity using Jaccard coefficient on word sets.
     * This is a fast heuristic — not a semantic comparison.
     */
    private textSimilarity(a: string, b: string): number {
        const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, '');
        const wordsA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 2));
        const wordsB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 2));

        if (wordsA.size === 0 || wordsB.size === 0) return 0;

        let intersection = 0;
        for (const w of wordsA) {
            if (wordsB.has(w)) intersection++;
        }

        const union = wordsA.size + wordsB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }
}
