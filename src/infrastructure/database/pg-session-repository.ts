import pg from 'pg';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

export interface Session {
    id: string;
    userId: string;
    startedAt: Date;
    endedAt?: Date;
    status: 'ACTIVE' | 'CLOSED';
}

export class PostgresSessionRepository {
    private logger = new RuntimeLogger();

    constructor(private pool: pg.Pool) {}

    /**
     * Executes an operation inside an RLS-enforced transaction.
     */
    private async withRlsTransaction<T>(userId: string, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
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

    async createSession(userId: string, sessionId: string): Promise<void> {
        const query = `INSERT INTO sessions (id, user_id, status, started_at) VALUES ($1, $2, 'ACTIVE', CURRENT_TIMESTAMP)`;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                await client.query(query, [sessionId, userId]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'session-repo', timestamp: new Date() });
                throw new Error("Failed to create session");
            }
        });
    }

    async getSession(userId: string, sessionId: string): Promise<Session | null> {
        const query = `SELECT id, user_id, started_at, ended_at, status FROM sessions WHERE id = $1 AND user_id = $2`;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                const { rows } = await client.query(query, [sessionId, userId]);
                if (rows.length === 0) return null;
                return {
                    id: rows[0].id, userId: rows[0].user_id,
                    startedAt: rows[0].started_at,
                    endedAt: rows[0].ended_at || undefined,
                    status: rows[0].status
                };
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'session-repo', timestamp: new Date() });
                throw new Error("Failed to retrieve session");
            }
        });
    }

    async endSession(userId: string, sessionId: string): Promise<void> {
        const query = `UPDATE sessions SET status = 'CLOSED', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'`;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                await client.query(query, [sessionId, userId]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'session-repo', timestamp: new Date() });
                throw new Error("Failed to end session");
            }
        });
    }
}
