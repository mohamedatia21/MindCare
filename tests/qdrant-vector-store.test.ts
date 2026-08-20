import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QdrantKnowledgeStore } from '../src/infrastructure/vector/qdrant-knowledge-store.js';
import { QdrantMemoryStore } from '../src/infrastructure/vector/qdrant-memory-store.js';

const mockUpsert = vi.fn();
const mockQuery = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/infrastructure/vector/qdrant-client.js', () => ({
    getQdrantClient: () => ({
        upsert: mockUpsert,
        query: mockQuery,
        delete: mockDelete
    })
}));

describe('QdrantKnowledgeStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query knowledge with correct parameters and map results', async () => {
        mockQuery.mockResolvedValue({
            points: [
                {
                    id: 101,
                    score: 0.92,
                    payload: {
                        book_title: 'WHO mhGAP',
                        pdf_page: 45,
                        text: 'Clinical guidance for depression.'
                    }
                }
            ]
        });

        const store = new QdrantKnowledgeStore();
        const results = await store.query({
            vector: [0.1, 0.2, 0.3],
            topK: 3
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe('101');
        expect(results[0]?.score).toBe(0.92);
        expect(results[0]?.metadata?.book_title).toBe('WHO mhGAP');
    });

    it('should upsert knowledge chunks with correct payload', async () => {
        const store = new QdrantKnowledgeStore();
        await store.upsert('chunk-1', [0.1, 0.2], {
            id: 'chunk-1',
            text: 'Guideline text',
            pdf_page: 12,
            topic: 'Depression',
            section: 'Assessment',
            source_document: 'mhgap.pdf',
            source_type: 'WHO_GUIDELINE',
            book_title: 'WHO mhGAP-IG',
            author: 'WHO',
            edition: 'v2.0',
            chapter: 'DEP'
        });

        expect(mockUpsert).toHaveBeenCalledWith('mindcare_clinical_corpus', expect.objectContaining({
            points: [
                expect.objectContaining({
                    id: 'chunk-1',
                    vector: [0.1, 0.2]
                })
            ]
        }));
    });
});

describe('QdrantMemoryStore (Tenant Isolation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should enforce user_id filter during query and prevent cross-tenant queries', async () => {
        mockQuery.mockResolvedValue({
            points: [
                {
                    id: 'mem-1',
                    score: 0.95,
                    payload: { id: 'mem-1', user_id: 'user-A', memory_class: 'SESSION', epistemic_status: 'CONFIRMED' }
                }
            ]
        });

        const store = new QdrantMemoryStore();
        const results = await store.query({
            vector: [0.1, 0.2],
            topK: 5,
            filter: { user_id: 'user-A' }
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.user_id).toBe('user-A');
        expect(mockQuery).toHaveBeenCalledWith('mindcare_memories', expect.objectContaining({
            filter: { must: [{ key: 'user_id', match: { value: 'user-A' } }] }
        }));
    });

    it('should throw Tenant Isolation violation if user_id filter is omitted', async () => {
        const store = new QdrantMemoryStore();
        await expect(store.query({
            vector: [0.1, 0.2],
            topK: 5
        })).rejects.toThrow(/Tenant isolation violation/);
    });
});
