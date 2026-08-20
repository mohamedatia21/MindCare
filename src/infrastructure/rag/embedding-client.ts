import OpenAI from 'openai';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

/**
 * Generates embeddings via OpenAI text-embedding-3-small or Google Gemini gemini-embedding-2 (1536-dim).
 * Preserves the 1536-dimensional vector contract across all stores.
 */
export class EmbeddingClient {
    private readonly EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
    private openAiClient: OpenAI | null = null;
    private geminiApiKey: string | null = null;
    private logger = new RuntimeLogger();

    constructor() {
        const openAiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (openAiKey && !openAiKey.startsWith('gsk_')) {
            this.openAiClient = new OpenAI({ apiKey: openAiKey });
        } else if (geminiKey) {
            this.geminiApiKey = geminiKey;
        } else {
            throw new Error('Valid OPENAI_API_KEY or GEMINI_API_KEY is required for EmbeddingClient');
        }
    }

    /**
     * Generate an embedding for a single text string.
     * Returns a 1536-dimensional float array.
     */
    public async embed(text: string): Promise<number[]> {
        if (!text || text.trim().length === 0) {
            throw new Error('EmbeddingClient.embed: text must be non-empty');
        }

        const startMs = Date.now();
        try {
            if (this.openAiClient) {
                const response = await this.openAiClient.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: text.trim(),
                    dimensions: this.EMBEDDING_DIMENSIONS
                });

                const vector = response.data[0]?.embedding;
                if (!vector || vector.length !== this.EMBEDDING_DIMENSIONS) {
                    throw new Error(`Unexpected embedding dimensions: expected ${this.EMBEDDING_DIMENSIONS}, got ${vector?.length ?? 0}`);
                }

                this.logger.info('EmbeddingGenerated', {
                    requestId: 'embedding',
                    latencyMs: Date.now() - startMs,
                    model: 'text-embedding-3-small',
                    timestamp: new Date()
                });

                return vector;
            } else if (this.geminiApiKey) {
                const res = await globalThis.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${this.geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { parts: [{ text: text.trim() }] },
                        outputDimensionality: this.EMBEDDING_DIMENSIONS
                    })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Gemini embedding failed (${res.status}): ${errText}`);
                }

                const data: any = await res.json();
                const vector = data.embedding?.values;

                if (!vector || vector.length !== this.EMBEDDING_DIMENSIONS) {
                    throw new Error(`Unexpected Gemini embedding dimensions: expected ${this.EMBEDDING_DIMENSIONS}, got ${vector?.length ?? 0}`);
                }

                this.logger.info('EmbeddingGenerated', {
                    requestId: 'embedding',
                    latencyMs: Date.now() - startMs,
                    model: 'gemini-embedding-2',
                    timestamp: new Date()
                });

                return vector;
            } else {
                throw new Error('No embedding provider available.');
            }
        } catch (error: any) {
            this.logger.error('EmbeddingFailed', {
                requestId: 'embedding',
                error: error.message,
                latencyMs: Date.now() - startMs,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Batch embed multiple texts.
     */
    public async embedBatch(texts: string[], batchSize = 20): Promise<number[][]> {
        const results: number[][] = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(t => this.embed(t)));
            results.push(...batchResults);
        }
        return results;
    }
}
