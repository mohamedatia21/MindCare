import { Index } from '@pinecone-database/pinecone';
import { getPineconeClient } from './pinecone-client.js';
import { VectorStore, VectorQueryOptions, VectorRecord } from './vector-store.js';

export interface MemoryMetadata {
    id: string; // The Postgres UUID
    user_id: string; // Used for tenant isolation filtering
    memory_class: string;
    epistemic_status: string;
}

/**
 * Stores vector representations of memories.
 * Metric: Euclidean (matches original pgvector L2 distance `<->` operator).
 * 
 * PINE-CONE METRIC SEMANTICS DOCUMENTATION:
 * When using the 'euclidean' metric in Pinecone, the returned `score` is the 
 * squared Euclidean distance. Therefore, lower scores indicate higher similarity 
 * (closer vectors). Pinecone automatically sorts results such that the lowest 
 * scores (most similar) are returned first.
 * 
 * Existing pgvector behavior for Memory was: `ORDER BY embedding <-> $2::vector LIMIT $3`
 * This translates identically to Pinecone's default euclidean query behavior (returns topK nearest neighbors).
 */
export class PineconeMemoryStore implements VectorStore<MemoryMetadata> {
    private index: Index;

    constructor() {
        const indexName = process.env.PINECONE_INDEX_MEMORY || 'mindcare-memories';
        this.index = getPineconeClient().index(indexName);
    }

    /**
     * Deterministic ID generation for Memories
     */
    private buildVectorId(postgresId: string): string {
        return `memory:${postgresId}`;
    }

    async upsert(id: string, vector: number[], metadata?: MemoryMetadata): Promise<void> {
        if (!metadata || !metadata.user_id) {
            throw new Error('user_id is required in metadata for tenant isolation');
        }

        await this.index.upsert([{
            id: this.buildVectorId(id),
            values: vector,
            metadata: metadata as Record<string, any>
        }] as any);
    }

    async batchUpsert(records: { id: string; vector: number[]; metadata?: MemoryMetadata }[]): Promise<void> {
        const batch = records.map(r => {
            if (!r.metadata || !r.metadata.user_id) {
                throw new Error(`user_id missing for record ${r.id}`);
            }
            return {
                id: this.buildVectorId(r.id),
                values: r.vector,
                metadata: r.metadata as Record<string, any>
            };
        });
        
        const batchSize = 100;
        for (let i = 0; i < batch.length; i += batchSize) {
            const chunk = batch.slice(i, i + batchSize);
            await this.index.upsert(chunk as any);
        }
    }

    /**
     * Queries the memory vector store.
     * CRITICAL: Must provide user_id in the filter to enforce tenant isolation at the infrastructure level.
     */
    async query(options: VectorQueryOptions): Promise<VectorRecord<MemoryMetadata>[]> {
        if (!options.filter || !options.filter.user_id) {
            throw new Error('Tenant isolation violation: queries must explicitly filter by user_id');
        }

        const queryOptions: any = {
            vector: options.vector,
            topK: options.topK,
            includeMetadata: true,
            includeValues: false
        };
        if (options.filter) {
            queryOptions.filter = options.filter;
        }

        const result = await this.index.query(queryOptions);

        return result.matches.map((match: any) => ({
            id: match.id.replace('memory:', ''), // return underlying postgres id
            score: match.score ?? 0,
            metadata: match.metadata as unknown as MemoryMetadata
        }));
    }

    async delete(id: string): Promise<void> {
        await this.index.deleteOne(this.buildVectorId(id) as any);
    }

    async deleteByFilter(filter: Record<string, any>): Promise<void> {
        if (!filter || Object.keys(filter).length === 0) {
            throw new Error('deleteByFilter requires a non-empty filter object');
        }
        
        // This is safe to run even if there are no records matching the filter.
        // It's used for purging user data.
        await this.index.deleteMany(filter);
    }
}
