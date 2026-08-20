import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PineconeKnowledgeStore } from '../src/infrastructure/vector/pinecone-knowledge-store.js';
import { PineconeMemoryStore } from '../src/infrastructure/vector/pinecone-memory-store.js';
import { PostgresMemoryRepository } from '../src/infrastructure/database/pg-memory-repository.js';
import { MemoryObject } from '../src/memory/types.js';

// Mock Pinecone Client
const mockUpsert = vi.fn();
const mockQuery = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/infrastructure/vector/pinecone-client.js', () => {
    return {
        getPineconeClient: () => ({
            index: (name: string) => ({
                upsert: mockUpsert,
                query: mockQuery,
                deleteOne: mockDelete
            })
        })
    };
});

describe('Vector Store Pinecone Migration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate deterministic knowledge IDs', async () => {
        const store = new PineconeKnowledgeStore();
        await store.upsert('test-uuid', [0.1, 0.2]);
        expect(mockUpsert).toHaveBeenCalledWith([{
            id: 'knowledge:test-uuid',
            values: [0.1, 0.2],
            metadata: undefined
        }]);
    });

    it('should generate deterministic memory IDs', async () => {
        const store = new PineconeMemoryStore();
        await store.upsert('mem-uuid', [0.1, 0.2], {
            id: 'mem-uuid',
            user_id: 'user-1',
            memory_class: 'SESSION',
            epistemic_status: 'FACT'
        });
        expect(mockUpsert).toHaveBeenCalledWith([{
            id: 'memory:mem-uuid',
            values: [0.1, 0.2],
            metadata: {
                id: 'mem-uuid',
                user_id: 'user-1',
                memory_class: 'SESSION',
                epistemic_status: 'FACT'
            }
        }]);
    });

    it('should throw if user_id is missing on memory upsert', async () => {
        const store = new PineconeMemoryStore();
        await expect(store.upsert('mem-uuid', [0.1], { id: 'mem-uuid' } as any))
            .rejects.toThrow('user_id is required');
    });

    it('should enforce user_id isolation on memory query', async () => {
        const store = new PineconeMemoryStore();
        await expect(store.query({ vector: [0.1], topK: 5 }))
            .rejects.toThrow('Tenant isolation violation: queries must explicitly filter by user_id');
            
        mockQuery.mockResolvedValueOnce({ matches: [] });
        await store.query({ vector: [0.1], topK: 5, filter: { user_id: 'user-1' } });
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            filter: { user_id: 'user-1' }
        }));
    });

    it('adversarial test: User A query passes user_id=userA filter to Pinecone and only returns User A memories', async () => {
        const store = new PineconeMemoryStore();
        
        // Mock Pinecone query implementation that strictly evaluates the filter inside the vector DB
        mockQuery.mockImplementation(async (opts: any) => {
            const allIndexMemories = [
                { id: 'memory:mem-A', score: 0.05, metadata: { id: 'mem-A', user_id: 'user-A', memory_class: 'SESSION' } },
                { id: 'memory:mem-B', score: 0.01, metadata: { id: 'mem-B', user_id: 'user-B', memory_class: 'SESSION' } }
            ];

            const filtered = allIndexMemories.filter(m => m.metadata.user_id === opts.filter.user_id);
            return { matches: filtered };
        });

        const results = await store.query({
            vector: [0.1, 0.2, 0.3],
            topK: 10,
            filter: { user_id: 'user-A' }
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe('mem-A');
        expect(results[0]?.metadata?.user_id).toBe('user-A');
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            filter: { user_id: 'user-A' }
        }));
    });
});

describe('PostgresMemoryRepository Synchronization', () => {
    const mockDbPool = {
        connect: vi.fn().mockResolvedValue({
            query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
            release: vi.fn()
        })
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw if Postgres succeeds but Pinecone fails (explicit failure strategy)', async () => {
        const store = new PineconeMemoryStore();
        const repo = new PostgresMemoryRepository(mockDbPool, store);
        
        mockUpsert.mockRejectedValueOnce(new Error('Pinecone network error'));
        
        const memory: MemoryObject = {
            id: 'test-mem-id',
            userId: 'user-123',
            memoryClass: 'SESSION',
            content: 'test content',
            epistemicStatus: 'FACT',
            status: 'ACTIVE',
            retentionPolicy: 'SESSION_ONLY',
            consentState: 'GRANTED',
            source: 'test',
            createdAt: new Date(),
            updatedAt: new Date(),
            embedding: [0.1, 0.2] // Requires vector write
        };

        await expect(repo.save('user-123', memory)).rejects.toThrow('Memory saved to Postgres, but vector upsert failed: Pinecone network error');
    });
});
