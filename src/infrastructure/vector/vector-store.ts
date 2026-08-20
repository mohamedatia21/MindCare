export interface VectorQueryOptions {
    vector: number[];
    topK: number;
    filter?: Record<string, any>;
}

export interface VectorRecord<TMetadata = any> {
    id: string;
    score?: number;
    metadata?: TMetadata;
}

export interface VectorStore<TMetadata = any> {
    upsert(id: string, vector: number[], metadata?: TMetadata): Promise<void>;
    batchUpsert(records: { id: string; vector: number[]; metadata?: TMetadata }[]): Promise<void>;
    query(options: VectorQueryOptions): Promise<VectorRecord<TMetadata>[]>;
    delete(id: string): Promise<void>;
    deleteByFilter(filter: Record<string, any>): Promise<void>;
}
