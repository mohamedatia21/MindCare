import { QdrantClient } from '@qdrant/js-client-rest';
import { getQdrantClient } from './qdrant-client.js';
import { VectorStore, VectorQueryOptions, VectorRecord } from './vector-store.js';
import { KnowledgeMetadata } from './pinecone-knowledge-store.js';

export class QdrantKnowledgeStore implements VectorStore<KnowledgeMetadata> {
    private client: QdrantClient;
    private collectionName: string;

    constructor() {
        this.client = getQdrantClient();
        this.collectionName = process.env.QDRANT_COLLECTION_KNOWLEDGE || 'mindcare_clinical_corpus';
    }

    async upsert(id: string, vector: number[], metadata?: KnowledgeMetadata): Promise<void> {
        await this.client.upsert(this.collectionName, {
            wait: true,
            points: [{
                id,
                vector,
                payload: metadata as Record<string, any>
            }]
        });
    }

    async batchUpsert(records: { id: string; vector: number[]; metadata?: KnowledgeMetadata }[]): Promise<void> {
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const chunk = records.slice(i, i + batchSize);
            await this.client.upsert(this.collectionName, {
                wait: true,
                points: chunk.map(r => ({
                    id: r.id,
                    vector: r.vector,
                    payload: r.metadata as Record<string, any>
                }))
            });
        }
    }

    async query(options: VectorQueryOptions): Promise<VectorRecord<KnowledgeMetadata>[]> {
        const queryParams: any = {
            query: options.vector,
            limit: options.topK,
            with_payload: true,
            with_vector: false
        };

        if (options.filter) {
            const must = Object.entries(options.filter).map(([key, value]) => ({
                key,
                match: { value }
            }));
            queryParams.filter = { must };
        }

        const results: any = await this.client.query(this.collectionName, queryParams);
        const points = results.points || [];

        return points.map((hit: any) => ({
            id: String(hit.id),
            score: hit.score,
            metadata: (hit.payload || {}) as KnowledgeMetadata
        }));
    }

    async delete(id: string): Promise<void> {
        await this.client.delete(this.collectionName, {
            wait: true,
            points: [id]
        });
    }

    async deleteByFilter(filter: Record<string, any>): Promise<void> {
        const must = Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value }
        }));
        await this.client.delete(this.collectionName, {
            wait: true,
            filter: { must }
        });
    }
}
