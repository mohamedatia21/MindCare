import { KnowledgeRetriever } from './knowledge-retriever.js';

/**
 * Eval harness for RAG retrieval quality.
 *
 * Structure ported from CleanRAG2 notebook Cells 57-58 (benchmark dataset + retrieval evaluation).
 * Computes: Precision, Recall, F1, MRR (Mean Reciprocal Rank), Hit Rate.
 *
 * CLINICAL CONTENT NOTE:
 * The notebook's specific example clinical queries (depression symptoms, psychosis, bipolar
 * disorder, alcohol withdrawal, etc.) are NOT included as default fixtures here — those require
 * Track 3 (human clinical specialist) review before use as production benchmarks.
 * Two neutral placeholder items are shipped as structural scaffolding only.
 *
 * Add real benchmark items only after Track 3 review signs off on the query/keyword set.
 */

export type ExpectedTool = 'knowledge_base_search' | 'web_search' | 'direct_chat';

export interface BenchmarkItem {
    query: string;
    expectedTool: ExpectedTool;
    /**
     * Keywords expected to appear in retrieved chunk text (lowercase, space-separated).
     * Only meaningful for expectedTool === 'knowledge_base_search'.
     */
    expectedKeywords: string[];
    /** Optional: human-readable description of what this test is checking. */
    description?: string;
}

export interface RetrievalMetrics {
    query: string;
    precision: number;
    recall: number;
    f1: number;
    /** Reciprocal rank of the first relevant chunk. 0 if no relevant chunk found. */
    reciprocalRank: number;
    /** 1 if at least one relevant chunk was retrieved, 0 otherwise. */
    hitRate: number;
    topScore: number;
    grounded: boolean;
    chunkCount: number;
}

export interface EvalReport {
    totalItems: number;
    retrievalItems: number;
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    mrr: number;
    overallHitRate: number;
    perQuery: RetrievalMetrics[];
    ranAt: Date;
}

/**
 * Placeholder benchmark items (structural scaffolding only).
 * ⚠️ DO NOT add clinical query content here without Track 3 review.
 */
export const PLACEHOLDER_BENCHMARK: BenchmarkItem[] = [
    {
        query: 'What psychosocial support strategies are recommended?',
        expectedTool: 'knowledge_base_search',
        expectedKeywords: ['psychosocial', 'support', 'intervention'],
        description: 'Neutral psychosocial strategy query — placeholder only, requires Track 3 review'
    },
    {
        query: 'I just want to chat about how my day went',
        expectedTool: 'direct_chat',
        expectedKeywords: [],
        description: 'Conversational query that should NOT trigger knowledge base search'
    }
];

/**
 * Evaluates retrieval quality for all items with expectedTool === 'knowledge_base_search'.
 *
 * Precision = fraction of retrieved chunks that contain at least one expected keyword
 * Recall    = fraction of expected keywords found in any retrieved chunk
 * F1        = harmonic mean of precision and recall
 * MRR       = mean 1/rank of the first relevant chunk across all queries
 * Hit Rate  = fraction of queries where at least one relevant chunk was retrieved
 */
export async function evaluateRetrievalQuality(
    items: BenchmarkItem[],
    retriever: KnowledgeRetriever,
    k = 3
): Promise<EvalReport> {
    const retrievalItems = items.filter(i => i.expectedTool === 'knowledge_base_search');
    const perQuery: RetrievalMetrics[] = [];

    for (const item of retrievalItems) {
        const result = await retriever.retrieve(item.query);
        const topKChunks = result.chunks.slice(0, k);
        const expectedKw = item.expectedKeywords.map(kw => kw.toLowerCase());

        if (expectedKw.length === 0) {
            // No keyword ground truth — record structural data only
            perQuery.push({
                query: item.query,
                precision: 0,
                recall: 0,
                f1: 0,
                reciprocalRank: 0,
                hitRate: result.grounded ? 1 : 0,
                topScore: result.chunks[0]?.score ?? 0,
                grounded: result.grounded,
                chunkCount: result.chunks.length
            });
            continue;
        }

        // Precision: fraction of retrieved chunks that contain ≥1 expected keyword
        const relevantChunks = topKChunks.filter(chunk =>
            expectedKw.some(kw => chunk.text.toLowerCase().includes(kw))
        );
        const precision = topKChunks.length > 0 ? relevantChunks.length / topKChunks.length : 0;

        // Recall: fraction of expected keywords found in any retrieved chunk text
        const allRetrievedText = topKChunks.map(c => c.text.toLowerCase()).join(' ');
        const foundKeywords = expectedKw.filter(kw => allRetrievedText.includes(kw));
        const recall = expectedKw.length > 0 ? foundKeywords.length / expectedKw.length : 0;

        const f1 = precision + recall > 0
            ? (2 * precision * recall) / (precision + recall)
            : 0;

        // MRR: rank of first relevant chunk (1-indexed)
        const firstRelevantRank = topKChunks.findIndex(chunk =>
            expectedKw.some(kw => chunk.text.toLowerCase().includes(kw))
        );
        const reciprocalRank = firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0;

        perQuery.push({
            query: item.query,
            precision,
            recall,
            f1,
            reciprocalRank,
            hitRate: relevantChunks.length > 0 ? 1 : 0,
            topScore: result.chunks[0]?.score ?? 0,
            grounded: result.grounded,
            chunkCount: result.chunks.length
        });
    }

    const n = perQuery.length;
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
        totalItems: items.length,
        retrievalItems: retrievalItems.length,
        avgPrecision: avg(perQuery.map(r => r.precision)),
        avgRecall: avg(perQuery.map(r => r.recall)),
        avgF1: avg(perQuery.map(r => r.f1)),
        mrr: avg(perQuery.map(r => r.reciprocalRank)),
        overallHitRate: avg(perQuery.map(r => r.hitRate)),
        perQuery,
        ranAt: new Date()
    };
}

/**
 * Pretty-print an EvalReport to stdout (for use in scripts / CI).
 */
export function printEvalReport(report: EvalReport): void {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`RETRIEVAL EVAL REPORT — ${report.ranAt.toISOString()}`);
    console.log(`${'='.repeat(72)}`);
    console.log(`Items: ${report.totalItems} total, ${report.retrievalItems} retrieval queries`);
    console.log(`Avg Precision : ${(report.avgPrecision * 100).toFixed(1)}%`);
    console.log(`Avg Recall    : ${(report.avgRecall * 100).toFixed(1)}%`);
    console.log(`Avg F1        : ${(report.avgF1 * 100).toFixed(1)}%`);
    console.log(`MRR           : ${report.mrr.toFixed(3)}`);
    console.log(`Hit Rate      : ${(report.overallHitRate * 100).toFixed(1)}%`);
    console.log(`\nPer-query breakdown:`);

    for (const q of report.perQuery) {
        const status = q.grounded ? '✓ GROUNDED  ' : '✗ UNGROUNDED';
        console.log(`  [${status}] score=${q.topScore.toFixed(3)} chunks=${q.chunkCount} P=${(q.precision*100).toFixed(0)}% R=${(q.recall*100).toFixed(0)}% F1=${(q.f1*100).toFixed(0)}%`);
        console.log(`            "${q.query.substring(0, 80)}"`);
    }
    console.log(`${'='.repeat(72)}\n`);
}
