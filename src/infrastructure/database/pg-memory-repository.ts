import pg from 'pg';
import { MemoryObject, MemoryClass, EpistemicStatus, MemoryStatus, RetentionPolicyType, ConsentState } from '../../memory/types.js';
import { MemoryRepository } from '../../memory/repository.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { VectorStore } from '../vector/vector-store.js';
import { MemoryMetadata } from '../vector/pinecone-memory-store.js';

export class PostgresMemoryRepository implements MemoryRepository {
    private logger = new RuntimeLogger();

    constructor(
        private pool: pg.Pool,
        private vectorStore?: VectorStore<MemoryMetadata>
    ) {}

    /**
     * Helper to execute a query within an RLS-enforced transaction.
     * Sets `app.current_user_id` locally for the transaction.
     */
    private async withRlsTransaction<T>(userId: string, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Enforce Tenant Isolation via PostgreSQL Row-Level Security
            await client.query('SELECT set_config(\'app.current_user_id\', $1, true)', [userId]);
            
            const result = await operation(client);
            
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async save(userId: string, memory: MemoryObject): Promise<void> {
        if (memory.userId !== userId) {
            this.logger.error('TenantMismatchDetected', { requestId: 'repo', timestamp: new Date() });
            throw new Error("Tenant mismatch");
        }

        const query = `
            INSERT INTO memories (
                id, user_id, session_id, memory_class, content, epistemic_status, 
                status, retention_policy, consent_state, source, created_at, updated_at, expires_at
            ) VALUES (
                $1, $2, null, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                epistemic_status = EXCLUDED.epistemic_status,
                status = EXCLUDED.status,
                retention_policy = EXCLUDED.retention_policy,
                consent_state = EXCLUDED.consent_state,
                updated_at = EXCLUDED.updated_at,
                expires_at = EXCLUDED.expires_at
            WHERE memories.user_id = $2 AND memories.deleted_at IS NULL;
        `;

        const values = [
            memory.id, userId, memory.memoryClass, memory.content,
            memory.epistemicStatus, memory.status, memory.retentionPolicy,
            memory.consentState, memory.source,
            memory.createdAt || new Date(), memory.updatedAt || new Date(),
            memory.expiresAt || null
        ];

        // 1. Write to Postgres first (Source of Truth for relational metadata)
        await this.withRlsTransaction(userId, async (client) => {
            try {
                const result = await client.query(query, values);
                if (result.rowCount === 0) {
                    throw new Error("Memory not found or tenant mismatch");
                }
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', error: error.message, timestamp: new Date() });
                throw new Error("Failed to persist memory in PostgreSQL");
            }
        });

        // 2. Write to Pinecone (if embedding exists)
        if (memory.embedding && memory.embedding.length > 0 && this.vectorStore) {
            try {
                await this.vectorStore.upsert(memory.id, memory.embedding, {
                    id: memory.id,
                    user_id: userId,
                    memory_class: memory.memoryClass,
                    epistemic_status: memory.epistemicStatus
                });
            } catch (error: any) {
                // EXPLICIT FAILURE STRATEGY: Do not silently swallow Pinecone failure.
                // The postgres row exists but the vector is missing. We throw an error so the caller knows 
                // the save was partially failed, leaving an observable trail.
                this.logger.error('VectorStoreUpsertError', {
                    requestId: 'repo',
                    error: error.message,
                    memoryId: memory.id,
                    timestamp: new Date()
                });
                throw new Error(`Memory saved to Postgres, but vector upsert failed: ${error.message}`);
            }
        }
    }

    async find(userId: string, memoryId: string): Promise<MemoryObject | null> {
        const query = `
            SELECT id, user_id, memory_class, content, epistemic_status, status, retention_policy, consent_state, source, created_at, updated_at, expires_at
            FROM memories
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        `;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                const { rows } = await client.query(query, [memoryId, userId]);
                if (rows.length === 0) return null;
                return this.mapRowToMemoryObject(rows[0]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', timestamp: new Date() });
                throw new Error("Failed to retrieve memory");
            }
        });
    }

    async findMany(userId: string): Promise<MemoryObject[]> {
        const query = `
            SELECT id, user_id, memory_class, content, epistemic_status, status, retention_policy, consent_state, source, created_at, updated_at, expires_at
            FROM memories
            WHERE user_id = $1 AND deleted_at IS NULL
        `;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                const { rows } = await client.query(query, [userId]);
                return rows.map(this.mapRowToMemoryObject);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', timestamp: new Date() });
                throw new Error("Failed to retrieve memories");
            }
        });
    }

    async update(userId: string, memoryId: string, updates: Partial<MemoryObject>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [userId, memoryId];
        let paramIndex = 3;

        if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(updates.status); }
        if (updates.consentState !== undefined) { fields.push(`consent_state = $${paramIndex++}`); values.push(updates.consentState); }
        if (updates.content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(updates.content); }
        
        if (fields.length === 0) return;
        fields.push(`updated_at = $${paramIndex++}`);
        values.push(new Date());

        const query = `UPDATE memories SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 AND deleted_at IS NULL`;

        await this.withRlsTransaction(userId, async (client) => {
            try {
                const result = await client.query(query, values);
                if (result.rowCount === 0) {
                    throw new Error("Memory not found or tenant mismatch");
                }
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', timestamp: new Date() });
                throw new Error("Failed to update memory in PostgreSQL");
            }
        });

        // Note: Currently update() does not touch embeddings based on the existing implementation.
        // If it ever did, we would need to upsert to Pinecone here.
    }

    async softDelete(userId: string, memoryId: string): Promise<void> {
        // DELETE CONSISTENCY: 
        // 1. Delete from PostgreSQL first. If this fails, we don't orphan the Pinecone vector yet.
        // 2. Delete from Pinecone second. It is idempotent (safe if missing). 
        // If Pinecone delete fails, Postgres is already deleted (so the app won't use it anyway),
        // but we log the error for cleanup.

        const query = `
            UPDATE memories SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        `;
        await this.withRlsTransaction(userId, async (client) => {
            try {
                await client.query(query, [memoryId, userId]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', timestamp: new Date() });
                throw new Error("Failed to delete memory in PostgreSQL");
            }
        });

        if (this.vectorStore) {
            try {
                await this.vectorStore.delete(memoryId);
            } catch (error: any) {
                this.logger.error('VectorStoreDeleteError', {
                    requestId: 'repo',
                    error: error.message,
                    memoryId,
                    timestamp: new Date()
                });
                // We don't throw here because the logical deletion in PostgreSQL succeeded.
                // Throwing would cause the caller to think the delete completely failed.
            }
        }
    }

    async purgeAllUserData(userId: string): Promise<void> {
        const query = `DELETE FROM memories WHERE user_id = $1`;
        await this.withRlsTransaction(userId, async (client) => {
            try {
                await client.query(query, [userId]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'repo', timestamp: new Date() });
                throw new Error("Failed to purge user memories in PostgreSQL");
            }
        });

        if (this.vectorStore) {
            try {
                await this.vectorStore.deleteByFilter({ user_id: userId });
            } catch (error: any) {
                this.logger.error('VectorStorePurgeError', {
                    requestId: 'repo',
                    error: error.message,
                    userId,
                    timestamp: new Date()
                });
            }
        }
    }

    async findSimilar(userId: string, embedding: number[], limit: number = 5): Promise<MemoryObject[]> {
        if (!this.vectorStore) {
            return []; // Fallback if vector store is not wired (e.g. tests)
        }

        try {
            // Pinecone handles the similarity search, and guarantees tenant isolation via the filter.
            // The score returned by Pinecone Euclidean metric is used to sort (lowest score = best similarity).
            const vectorResults = await this.vectorStore.query({
                vector: embedding,
                topK: limit,
                filter: { user_id: userId } // Hard tenant boundary
            });

            if (vectorResults.length === 0) {
                return [];
            }

            const ids = vectorResults.map(r => r.id);

            // Fetch the full relational bodies from PostgreSQL to ensure complete fidelity
            // and RLS enforcement check.
            const query = `
                SELECT id, user_id, memory_class, content, epistemic_status, status, retention_policy, consent_state, source, created_at, updated_at, expires_at
                FROM memories
                WHERE id = ANY($1) AND user_id = $2 AND deleted_at IS NULL
            `;
            
            return this.withRlsTransaction(userId, async (client) => {
                const { rows } = await client.query(query, [ids, userId]);
                
                // We need to re-sort the Postgres rows to match the Pinecone score order
                const idToRow = new Map(rows.map(r => [r.id, this.mapRowToMemoryObject(r)]));
                const orderedMemories: MemoryObject[] = [];
                for (const vr of vectorResults) {
                    const mem = idToRow.get(vr.id);
                    if (mem) {
                        orderedMemories.push(mem);
                    }
                }
                
                return orderedMemories;
            });
        } catch (error: any) {
            this.logger.error('VectorStoreQueryError', { requestId: 'repo', error: error.message, timestamp: new Date() });
            throw new Error("Failed to retrieve similar memories");
        }
    }

    private mapRowToMemoryObject(row: any): MemoryObject {
        return {
            id: row.id, userId: row.user_id,
            memoryClass: row.memory_class as MemoryClass,
            content: row.content, epistemicStatus: row.epistemic_status as EpistemicStatus,
            status: row.status as MemoryStatus, retentionPolicy: row.retention_policy as RetentionPolicyType,
            consentState: row.consent_state as ConsentState, source: row.source,
            createdAt: row.created_at, updatedAt: row.updated_at,
            expiresAt: row.expires_at || undefined
        };
    }
}
