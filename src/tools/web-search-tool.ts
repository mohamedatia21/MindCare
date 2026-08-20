import { ToolResult } from './types.js';
import { SourceTrustScorer } from '../infrastructure/evidence/source-trust-scorer.js';
import { RuntimeLogger } from '../observability/runtime-logger.js';

/**
 * WebMedicalSearchTool — Hardened web search with sanitization and trust scoring.
 * 
 * Security: All retrieved content passes through injection detection
 * (same patterns as MCPSanitizer) before entering the LLM context.
 * 
 * Skill Traceability:
 *   Skill: external-content-sanitizer → "Identifies and neutralizes prompt-injection"
 *   Skill: security-and-hardening → "Validate all external input at the system boundary"
 */
export class WebMedicalSearchTool {
  private trustScorer = new SourceTrustScorer();
  private logger = new RuntimeLogger();
  private readonly MAX_SNIPPET_LENGTH = 2000;

  public async execute(query: string, requestId: string): Promise<ToolResult> {
    try {
      // Append medical context to general queries to ensure reliable hits
      const enhancedQuery = `${query} (site:nimh.nih.gov OR site:mayoclinic.org OR site:who.int OR site:clevelandclinic.org OR site:altibbi.com OR site:webteb.com)`;
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enhancedQuery)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) {
        return { 
          ok: false, 
          error: 'Web search request failed with status ' + response.status,
          metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
        };
      }
      
      const html = await response.text();
      const results: Array<{title: string, url: string, snippet: string, trustTier: string, organization: string}> = [];
      const resultRegex = /<a class="result__url" href="([^"]+)".*?>(.*?)<\/a>.*?<a class="result__snippet[^>]+>(.*?)<\/a>/gs;
      
      let match;
      let count = 0;
      
      while ((match = resultRegex.exec(html)) !== null && count < 5) {
        let snippetUrl = match[1] || '';
        if (snippetUrl.includes('uddg=')) {
          const urlMatch = snippetUrl.match(/uddg=([^&]+)/);
          if (urlMatch && urlMatch[1]) snippetUrl = decodeURIComponent(urlMatch[1]);
        }

        const rawTitle = (match[2] || '').replace(/<[^>]+>/g, '').trim();
        const rawSnippet = (match[3] || '').replace(/<[^>]+>/g, '').trim();

        // Sanitize: check for prompt injection in retrieved content
        if (this.containsInjection(rawTitle) || this.containsInjection(rawSnippet)) {
          this.logger.warn('WebSearchInjectionBlocked', {
            requestId,
            url: snippetUrl,
            timestamp: new Date()
          });
          continue; // Skip this result entirely
        }

        // Truncate oversized snippets
        const safeSnippet = rawSnippet.length > this.MAX_SNIPPET_LENGTH 
          ? rawSnippet.substring(0, this.MAX_SNIPPET_LENGTH) + '...'
          : rawSnippet;

        // Score trust tier
        const trustResult = this.trustScorer.score(snippetUrl);

        results.push({
          url: snippetUrl,
          title: rawTitle,
          snippet: safeSnippet,
          trustTier: trustResult.tier,
          organization: trustResult.organization,
        });
        count++;
      }
      
      if (results.length === 0) {
         // Fallback to Wikipedia Arabic API if DuckDuckGo blocks us or returns no results
         const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
         const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
         if (wikiRes.ok) {
           const wikiJson = await wikiRes.json();
           const wikiResults = wikiJson?.query?.search || [];
           for (let i = 0; i < Math.min(3, wikiResults.length); i++) {
             const r = wikiResults[i];
             const wikiSnippet = r.snippet.replace(/<[^>]+>/g, '');
             if (this.containsInjection(wikiSnippet)) continue;
             const wikiResultUrl = `https://ar.wikipedia.org/wiki/${encodeURIComponent(r.title)}`;
             const trustResult = this.trustScorer.score(wikiResultUrl);
             results.push({
               url: wikiResultUrl,
               title: r.title,
               snippet: wikiSnippet,
               trustTier: trustResult.tier,
               organization: trustResult.organization,
             });
           }
         }
      }

      if (results.length === 0) {
         return {
            ok: true,
            data: { message: 'No reliable medical web results found.' },
            metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
         };
      }

      // Sort by trust tier (highest first)
      const tierOrder: Record<string, number> = { 'TIER_A': 0, 'TIER_B': 1, 'TIER_C': 2, 'TIER_D': 3, 'TIER_E': 4 };
      results.sort((a, b) => (tierOrder[a.trustTier] ?? 4) - (tierOrder[b.trustTier] ?? 4));

      const formattedResults = results.map((r, i) => 
        `[WEB_RESULT ${i+1}]\nURL: ${r.url}\nTitle: ${r.title}\nOrganization: ${r.organization}\nTrust Tier: ${r.trustTier}\nSnippet: ${r.snippet}`
      ).join('\n\n');

      this.logger.info('WebSearchCompleted', {
        requestId,
        resultCount: results.length,
        topTier: results[0]?.trustTier,
        timestamp: new Date()
      });

      return {
        ok: true,
        data: { searchResults: formattedResults },
        metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
      };

    } catch (e: any) {
      return { 
        ok: false, 
        error: `Search execution failed: ${e.message}`,
        metadata: { semanticBoundary: 'TOOL_RESULT', truncated: false }
      };
    }
  }

  /**
   * Injection detection — same patterns as MCPSanitizer.
   * Treats all external content as untrusted DATA.
   * External content saying "ignore instructions" must NEVER override system policy.
   */
  private containsInjection(text: string): boolean {
    const normalized = text.toLowerCase()
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFKC');

    return (
      normalized.includes('ignorepreviousinstructions') ||
      normalized.includes('ignoreallsafetyrules') ||
      normalized.includes('systemprompt') ||
      normalized.includes('overridesafety') ||
      normalized.includes('disablesafety') ||
      //<system>|[system]|developer|<tool>
      /\<system\>|\[system\]|\bdeveloper\b|\<tool\>/i.test(normalized) ||
      normalized.includes('"safetystate"') ||
      normalized.includes('"authorization"') ||
      normalized.includes('"consentstate"')
    );
  }
}
