import { QdrantClient } from '@qdrant/js-client-rest';
import { getQdrantClient } from './qdrant-client.js';
import { VectorStore, VectorQueryOptions, VectorRecord } from './vector-store.js';
import { MemoryMetadata } from './pinecone-memory-store.js';

export class QdrantMemoryStore implements VectorStore<MemoryMetadata> {
    private client: QdrantClient;
    private collectionName: string;

    constructor() {
        this.client = getQdrantClient();
        this.collectionName = process.env.QDRANT_COLLECTION_MEMORY || 'mindcare_memories';
    }

    async upsert(id: string, vector: number[], metadata?: MemoryMetadata): Promise<void> {
        if (!metadata || !metadata.user_id) {
            throw new Error('user_id is required in metadata for tenant isolation');
        }

        await this.client.upsert(this.collectionName, {
            wait: true,
            points: [{
                id,
                vector,
                payload: metadata as Record<string, any>
            }]
        });
    }

    async batchUpsert(records: { id: string; vector: number[]; metadata?: MemoryMetadata }[]): Promise<void> {
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const chunk = records.slice(i, i + batchSize);
            for (const r of chunk) {
                if (!r.metadata || !r.metadata.user_id) {
                    throw new Error(`user_id missing for record ${r.id}`);
                }
            }
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

    async query(options: VectorQueryOptions): Promise<VectorRecord<MemoryMetadata>[]> {
        if (!options.filter || !options.filter.user_id) {
            throw new Error('Tenant isolation violation: queries must explicitly filter by user_id');
        }

        const must = Object.entries(options.filter).map(([key, value]) => ({
            key,
            match: { value }
        }));

        const results: any = await this.client.query(this.collectionName, {
            query: options.vector,
            limit: options.topK,
            filter: { must },
            with_payload: true,
            with_vector: false
        });

        const points = results.points || [];

        return points.map((hit: any) => ({
            id: String(hit.id),
            score: hit.score,
            metadata: (hit.payload || {}) as MemoryMetadata
        }));
    }

    async delete(id: string): Promise<void> {
        await this.client.delete(this.collectionName, {
            wait: true,
            points: [id]
        });
    }

    async deleteByFilter(filter: Record<string, any>): Promise<void> {
        if (!filter || Object.keys(filter).length === 0) {
            throw new Error('deleteByFilter requires a non-empty filter object');
        }

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
