/**
 * Source Trust Scorer
 * 
 * Classifies external domains into trust tiers for evidence-grounded responses.
 * 
 * TIER_A: Government / International Health Organizations / Official Guidelines
 * TIER_B: Peer-Reviewed / Academic Medical Institutions  
 * TIER_C: Recognized Medical Education Sources
 * TIER_D: General Web Sources
 * TIER_E: Untrusted / Blocked
 * 
 * Skill Traceability:
 *   Skill: security-and-hardening → Rule: "Validate all external input at the system boundary"
 *   Skill: external-content-sanitizer → Rule: "Severity-keyed action for external sources"
 */

export type SourceTrustTier = 'TIER_A' | 'TIER_B' | 'TIER_C' | 'TIER_D' | 'TIER_E';

export interface SourceTrustResult {
    url: string;
    domain: string;
    tier: SourceTrustTier;
    organization: string;
    isAllowedForClinical: boolean;
}

// Domain → Trust Tier mapping
// Based on MINDCARE_SOURCE_REGISTRY.md
const TIER_A_DOMAINS: Record<string, string> = {
    'nimh.nih.gov': 'National Institute of Mental Health (NIMH)',
    'www.nimh.nih.gov': 'National Institute of Mental Health (NIMH)',
    'nih.gov': 'National Institutes of Health (NIH)',
    'www.nih.gov': 'National Institutes of Health (NIH)',
    'who.int': 'World Health Organization (WHO)',
    'www.who.int': 'World Health Organization (WHO)',
    'cdc.gov': 'Centers for Disease Control and Prevention (CDC)',
    'www.cdc.gov': 'Centers for Disease Control and Prevention (CDC)',
    'nhs.uk': 'National Health Service (NHS)',
    'www.nhs.uk': 'National Health Service (NHS)',
    'apa.org': 'American Psychological Association (APA)',
    'www.apa.org': 'American Psychological Association (APA)',
    'nice.org.uk': 'National Institute for Health and Care Excellence (NICE)',
    'www.nice.org.uk': 'National Institute for Health and Care Excellence (NICE)',
};

const TIER_B_DOMAINS: Record<string, string> = {
    'pubmed.ncbi.nlm.nih.gov': 'PubMed / NCBI',
    'ncbi.nlm.nih.gov': 'NCBI',
    'cochranelibrary.com': 'Cochrane Library',
    'www.cochranelibrary.com': 'Cochrane Library',
    'mayoclinic.org': 'Mayo Clinic',
    'www.mayoclinic.org': 'Mayo Clinic',
    'clevelandclinic.org': 'Cleveland Clinic',
    'www.clevelandclinic.org': 'Cleveland Clinic',
    'medlineplus.gov': 'MedlinePlus',
    'www.medlineplus.gov': 'MedlinePlus',
};

const TIER_C_DOMAINS: Record<string, string> = {
    'en.wikipedia.org': 'Wikipedia (English)',
    'ar.wikipedia.org': 'Wikipedia (Arabic)',
    'wikipedia.org': 'Wikipedia',
    'webteb.com': 'WebTeb',
    'www.webteb.com': 'WebTeb',
    'altibbi.com': 'Altibbi',
    'www.altibbi.com': 'Altibbi',
};

// Blocked sources — never use for clinical claims
const BLOCKED_PATTERNS = [
    'reddit.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'quora.com',
    'medium.com',
    'blogspot.com',
    'wordpress.com',
];

export class SourceTrustScorer {
    /**
     * Score a URL and return its trust classification.
     * 
     * The scorer uses exact domain matching against the allowlist.
     * Unknown domains default to TIER_D (general web).
     * Blocked domains return TIER_E.
     */
    public score(url: string): SourceTrustResult {
        let domain: string;
        try {
            const parsed = new URL(url);
            domain = parsed.hostname.toLowerCase();
        } catch {
            return {
                url,
                domain: 'invalid',
                tier: 'TIER_E',
                organization: 'Unknown (invalid URL)',
                isAllowedForClinical: false
            };
        }

        // Check blocked patterns first
        for (const blocked of BLOCKED_PATTERNS) {
            if (domain === blocked || domain.endsWith(`.${blocked}`)) {
                return {
                    url,
                    domain,
                    tier: 'TIER_E',
                    organization: `Blocked: ${domain}`,
                    isAllowedForClinical: false
                };
            }
        }

        // Check Tier A
        const tierAOrg = TIER_A_DOMAINS[domain];
        if (tierAOrg) {
            return { url, domain, tier: 'TIER_A', organization: tierAOrg, isAllowedForClinical: true };
        }

        // Check subdomains of Tier A (e.g., health.nih.gov)
        for (const [tierDomain, org] of Object.entries(TIER_A_DOMAINS)) {
            if (domain.endsWith(`.${tierDomain}`)) {
                return { url, domain, tier: 'TIER_A', organization: org, isAllowedForClinical: true };
            }
        }

        // Check Tier B
        const tierBOrg = TIER_B_DOMAINS[domain];
        if (tierBOrg) {
            return { url, domain, tier: 'TIER_B', organization: tierBOrg, isAllowedForClinical: true };
        }
        for (const [tierDomain, org] of Object.entries(TIER_B_DOMAINS)) {
            if (domain.endsWith(`.${tierDomain}`)) {
                return { url, domain, tier: 'TIER_B', organization: org, isAllowedForClinical: true };
            }
        }

        // Check Tier C
        const tierCOrg = TIER_C_DOMAINS[domain];
        if (tierCOrg) {
            return { url, domain, tier: 'TIER_C', organization: tierCOrg, isAllowedForClinical: true };
        }
        for (const [tierDomain, org] of Object.entries(TIER_C_DOMAINS)) {
            if (domain.endsWith(`.${tierDomain}`)) {
                return { url, domain, tier: 'TIER_C', organization: org, isAllowedForClinical: true };
            }
        }

        // Default: Tier D (general web)
        return {
            url,
            domain,
            tier: 'TIER_D',
            organization: domain,
            isAllowedForClinical: false
        };
    }

    /**
     * Score multiple URLs and sort by trust tier (highest first).
     */
    public scoreAndRank(urls: string[]): SourceTrustResult[] {
        const tierOrder: Record<SourceTrustTier, number> = {
            'TIER_A': 0, 'TIER_B': 1, 'TIER_C': 2, 'TIER_D': 3, 'TIER_E': 4
        };
        return urls
            .map(url => this.score(url))
            .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
    }
}
