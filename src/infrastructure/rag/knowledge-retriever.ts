import { EmbeddingClient } from './embedding-client.js';
import { VectorStore } from '../vector/vector-store.js';
import { KnowledgeMetadata } from '../vector/pinecone-knowledge-store.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import OpenAI from 'openai';

/**
 * A single retrieved knowledge chunk from the WHO mhGAP corpus.
 */
export interface KnowledgeChunk {
    id: string;
    text: string;
    pdfPage: number | null;
    topic: string | null;
    section: string | null;
    sourceDocument: string;
    /** Bibliographic metadata for structured citations */
    sourceType: string;
    bookTitle: string | null;
    author: string | null;
    edition: string | null;
    chapter: string | null;
    /** Cosine similarity score [0,1]. Higher is more relevant. */
    score: number;
}

/**
 * The result of a single retrieval call.
 * grounded=false means no chunks exceeded the similarity threshold —
 * the caller MUST surface this and not ask the LLM to answer from general memory.
 */
export interface RetrievalResult {
    grounded: boolean;
    chunks: KnowledgeChunk[];
    expandedQuery: string;
    rawQuery: string;
    retrievalMs: number;
}

/**
 * Formatted context block for injection into the LLM system prompt.
 * Matches the source/page/topic/text structure from CleanRAG2 notebook Cell 23.
 */
export interface AssembledContext {
    contextBlock: string;
    grounded: boolean;
    chunkCount: number;
    sources: string[];
}

export class KnowledgeRetriever {
    /**
     * Minimum cosine similarity score for a chunk to be considered relevant.
     * Chunks below this threshold are excluded. If no chunks pass, grounded=false.
     * Configurable via KNOWLEDGE_SIMILARITY_THRESHOLD env var.
     */
    private readonly SIMILARITY_THRESHOLD: number;

    private readonly TOP_K = 4;
    private embeddingClient: EmbeddingClient;
    private logger = new RuntimeLogger();
    private llmClient: OpenAI;

    constructor(private vectorStore: VectorStore<KnowledgeMetadata>) {
        this.SIMILARITY_THRESHOLD = parseFloat(
            process.env.KNOWLEDGE_SIMILARITY_THRESHOLD ?? '0.65'
        );

        const geminiKey = process.env.GEMINI_API_KEY;
        const grokKey = process.env.GROK_API_KEY;
        const openAiKey = process.env.OPENAI_API_KEY;

        this.embeddingClient = new EmbeddingClient();

        const primaryPref = process.env.PRIMARY_LLM_PROVIDER || 'openai';

        if (primaryPref === 'openai' && openAiKey) {
            const isGroq = openAiKey.startsWith('gsk_');
            this.llmClient = new OpenAI({
                apiKey: openAiKey,
                baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
            });
        } else if (geminiKey) {
            this.llmClient = new OpenAI({
                apiKey: geminiKey,
                baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                defaultHeaders: { 'x-goog-api-key': geminiKey }
            });
        } else if (grokKey) {
            this.llmClient = new OpenAI({
                apiKey: grokKey,
                baseURL: 'https://api.x.ai/v1'
            });
        } else if (openAiKey) {
            const isGroq = openAiKey.startsWith('gsk_');
            this.llmClient = new OpenAI({
                apiKey: openAiKey,
                baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
            });
        } else {
            // Safe mock client placeholder for test/offline environments
            this.llmClient = new OpenAI({ apiKey: 'MOCK_KEY' });
        }
    }

    /**
     * Main retrieval entry point.
     *
     * Pipeline (ported from CleanRAG2 Cells 59, 61, 62):
     *  1. Query expansion — LLM translates/expands terse/Arabic query to precise English keywords
     *  2. Embed the expanded query (1536-dim, OpenAI)
     *  3. pgvector cosine similarity search against knowledge_chunks (HNSW)
     *  4. Similarity threshold gate — code-level, NOT relying on LLM self-policing
     *  5. Log groundedness for auditability
     */
    public async retrieve(rawQuery: string): Promise<RetrievalResult> {
        const startMs = Date.now();

        // Step 1: Query expansion
        const expandedQuery = await this.expandQuery(rawQuery);

        // Step 2: Embed
        const embedding = await this.embeddingClient.embed(expandedQuery);

        // Step 3: Pinecone cosine similarity (1 - distance = score for euclidean, but we use cosine metric so score is cosine similarity)
        const vectorResults = await this.vectorStore.query({
            vector: embedding,
            topK: this.TOP_K
        });

        const rows = vectorResults.map(r => {
            const meta: any = r.metadata || {};
            return {
                id: r.id || meta.id || 'chunk',
                text: meta.text || meta.content || '',
                pdf_page: meta.pdf_page ?? meta.page_number ?? null,
                topic: meta.topic || null,
                section: meta.section || null,
                source_document: meta.source_document || meta.source_file || 'WHO mhGAP',
                source_type: meta.source_type || 'WHO_GUIDELINE',
                book_title: meta.book_title || meta.source_file || 'WHO mhGAP Guidelines',
                author: meta.author || 'WHO',
                edition: meta.edition || 'v2.0',
                chapter: meta.chapter || null,
                score: r.score ?? 0
            };
        });

        // Step 4: Similarity threshold gate (architectural code-level check)
        const aboveThreshold = rows.filter(r => r.score >= this.SIMILARITY_THRESHOLD);

        const grounded = aboveThreshold.length > 0;
        const retrievalMs = Date.now() - startMs;

        // Step 5: Log groundedness — auditable, never assumed
        if (grounded) {
            this.logger.info('RetrievalGrounded', {
                requestId: 'rag',
                rawQuery: rawQuery.substring(0, 100),
                expandedQuery: expandedQuery.substring(0, 100),
                chunkCount: aboveThreshold.length,
                topScore: aboveThreshold[0]?.score ?? 0,
                threshold: this.SIMILARITY_THRESHOLD,
                retrievalMs,
                timestamp: new Date()
            });
        } else {
            this.logger.warn('RetrievalUngrounded', {
                requestId: 'rag',
                rawQuery: rawQuery.substring(0, 100),
                expandedQuery: expandedQuery.substring(0, 100),
                bestScore: rows[0]?.score ?? 0,
                threshold: this.SIMILARITY_THRESHOLD,
                reason: rows.length === 0 ? 'NO_CHUNKS_IN_DB' : 'ALL_BELOW_THRESHOLD',
                retrievalMs,
                timestamp: new Date()
            });
        }

        return {
            grounded,
            chunks: aboveThreshold.map(r => ({
                id: r.id,
                text: r.text,
                pdfPage: r.pdf_page,
                topic: r.topic,
                section: r.section,
                sourceDocument: r.source_document,
                sourceType: r.source_type || 'internal_book',
                bookTitle: r.book_title,
                author: r.author,
                edition: r.edition,
                chapter: r.chapter,
                score: r.score
            })),
            expandedQuery,
            rawQuery,
            retrievalMs
        };
    }

    /**
     * Assembles retrieved chunks into a structured context block for LLM injection.
     * Format ported from CleanRAG2 notebook Cell 23.
     *
     * If grounded=false, returns a context block signalling insufficient information —
     * the LLM is instructed (via buildClinicalPolicy) to acknowledge this explicitly
     * rather than answering from general memory.
     */
    public assembleContext(result: RetrievalResult): AssembledContext {
        if (!result.grounded) {
            return {
                contextBlock: '[KNOWLEDGE_BASE: No relevant WHO mhGAP information was found above the confidence threshold for this query. Do NOT answer from general knowledge — explicitly acknowledge that the retrieved context is insufficient and recommend consulting a licensed professional.]',
                grounded: false,
                chunkCount: 0,
                sources: []
            };
        }

        const blocks = result.chunks.map((chunk, i) => {
            const parts: string[] = [];
            const bookName = chunk.bookTitle || chunk.sourceDocument || 'WHO mhGAP';
            parts.push(`Source: ${bookName}`);
            if (chunk.author) parts.push(`Author: ${chunk.author}`);
            if (chunk.edition) parts.push(`Edition: ${chunk.edition}`);
            if (chunk.chapter) parts.push(`Chapter: ${chunk.chapter}`);
            if (chunk.pdfPage !== null) parts.push(`Page: ${chunk.pdfPage}`);
            if (chunk.topic) parts.push(`Topic: ${chunk.topic}`);
            if (chunk.section) parts.push(`Section: ${chunk.section}`);
            parts.push(`Relevance: ${(chunk.score * 100).toFixed(1)}%`);

            return `[CHUNK ${i + 1}]\n${parts.join(' | ')}\n\n${chunk.text}`;
        });

        const sources = [...new Set(
            result.chunks
                .filter(c => c.pdfPage !== null)
                .map(c => {
                    const name = c.bookTitle || c.sourceDocument || 'WHO mhGAP';
                    return `📖 ${name} p.${c.pdfPage}`;
                })
        )];

        return {
            contextBlock: `[KNOWLEDGE_BASE: WHO mhGAP Retrieved Context — ${result.chunks.length} chunk(s)]\n\n${blocks.join('\n\n---\n\n')}\n\n[END KNOWLEDGE_BASE]`,
            grounded: true,
            chunkCount: result.chunks.length,
            sources
        };
    }

    /**
     * Query expansion via LLM (ported from CleanRAG2 notebook Cell 61/62).
     *
     * Translates Arabic queries to English and expands terse queries into
     * precise search keywords that match the intent — not additional topics.
     *
     * CLINICAL CONTENT NOTE: The keyword instruction structure is ported from the notebook's
     * Cell 61/62 query expansion logic. The specific clinical category labels used
     * ("symptoms/signs", "treatment", "management") are minimal functional terms.
     * ⚠️  REQUIRES TRACK 3 REVIEW before production use with real clinical content.
     */
    private async expandQuery(rawQuery: string): Promise<string> {
        try {
            const isGroq = process.env.OPENAI_API_KEY?.startsWith('gsk_');
            const primaryPref = process.env.PRIMARY_LLM_PROVIDER || 'openai';
            const model = primaryPref === 'openai' && isGroq
                ? (process.env.OPENAI_MODEL || 'openai/gpt-oss-120b')
                : (process.env.GEMINI_MODEL || 'gemini-3.6-flash');

            const expansionPromise = this.llmClient.chat.completions.create({
                model,
                messages: [
                    {
                        role: 'user',
                        content: `Convert this user question into 3-5 concise English search keywords that match the EXACT user intent.
- If the query is in Arabic, translate it to English keywords first.
- If they ask for symptoms/signs, focus only on: clinical features, symptoms, signs.
- If they ask for treatment, focus only on: management, interventions, treatment.
- DO NOT add extra topics that were not asked.
- Return ONLY the space-separated keywords for: '${rawQuery}'`
                    }
                ],
                max_tokens: 250,
                temperature: 0
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Query expansion timeout (1500ms)')), 1500)
            );

            const response = await Promise.race([expansionPromise, timeoutPromise]);

            let expanded = response.choices[0]?.message?.content?.trim() ?? '';
            
            // Strip any <think>...</think> reasoning traces if present
            expanded = expanded.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            
            // Strip surrounding quotes
            expanded = expanded.replace(/^["']|["']$/g, '').trim();

            // If expansion yielded empty string (e.g. reasoning exhausted tokens or model failure), fallback to raw query
            if (!expanded || expanded.length === 0) {
                return rawQuery;
            }

            return expanded;
        } catch {
            // Graceful degradation: use raw query if expansion fails
            this.logger.warn('QueryExpansionFailed', {
                requestId: 'rag',
                timestamp: new Date()
            });
            return rawQuery;
        }
    }
}
