import { Index } from '@pinecone-database/pinecone';
import { getPineconeClient } from './pinecone-client.js';
import { VectorStore, VectorQueryOptions, VectorRecord } from './vector-store.js';

export interface KnowledgeMetadata {
    id: string; // The Postgres UUID
    text: string;
    pdf_page: number | null;
    topic: string | null;
    section: string | null;
    source_document: string;
    source_type: string;
    book_title: string | null;
    author: string | null;
    edition: string | null;
    chapter: string | null;
}

export class PineconeKnowledgeStore implements VectorStore<KnowledgeMetadata> {
    private index: Index;

    constructor() {
        const indexName = process.env.PINECONE_INDEX_KNOWLEDGE || 'mindcare-knowledge';
        this.index = getPineconeClient().index(indexName);
    }

    /**
     * Deterministic ID generation for Knowledge Chunks
     */
    private buildVectorId(postgresId: string): string {
        return `knowledge:${postgresId}`;
    }

    async upsert(id: string, vector: number[], metadata?: KnowledgeMetadata): Promise<void> {
        await this.index.upsert([{
            id: this.buildVectorId(id),
            values: vector,
            metadata: metadata as Record<string, any>
        }] as any);
    }

    async batchUpsert(records: { id: string; vector: number[]; metadata?: KnowledgeMetadata }[]): Promise<void> {
        const batch = records.map(r => ({
            id: this.buildVectorId(r.id),
            values: r.vector,
            metadata: r.metadata as Record<string, any>
        }));
        
        // Upsert in batches of 100 to avoid request size limits
        const batchSize = 100;
        for (let i = 0; i < batch.length; i += batchSize) {
            const chunk = batch.slice(i, i + batchSize);
            await this.index.upsert(chunk as any);
        }
    }

    async query(options: VectorQueryOptions): Promise<VectorRecord<KnowledgeMetadata>[]> {
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
            id: match.id.replace('knowledge:', ''), // return the underlying postgres id
            score: match.score ?? 0,
            metadata: match.metadata as unknown as KnowledgeMetadata
        }));
    }

    async delete(id: string): Promise<void> {
        await this.index.deleteOne(this.buildVectorId(id) as any);
    }

    async deleteByFilter(filter: Record<string, any>): Promise<void> {
        // Pinecone requires explicit configuration to delete by filter, but we don't need it for knowledge right now.
        // It's mostly used for memory.
        throw new Error('deleteByFilter is not implemented for Knowledge store');
    }
}
