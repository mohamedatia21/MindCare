import pg from 'pg';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { ConsentState } from '../../memory/types.js';

export interface ConsentRecord {
    id: string;
    userId: string;
    consentType: string;
    state: ConsentState;
    grantedAt?: Date;
    revokedAt?: Date;
}

export class PostgresConsentRepository {
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

    async getConsent(userId: string, consentType: string): Promise<ConsentRecord | null> {
        const query = `SELECT id, user_id, consent_type, state, granted_at, revoked_at FROM consents WHERE user_id = $1 AND consent_type = $2`;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                const { rows } = await client.query(query, [userId, consentType]);
                if (rows.length === 0) return null;
                return {
                    id: rows[0].id, userId: rows[0].user_id,
                    consentType: rows[0].consent_type,
                    state: rows[0].state as ConsentState,
                    grantedAt: rows[0].granted_at || undefined,
                    revokedAt: rows[0].revoked_at || undefined
                };
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'consent-repo', timestamp: new Date() });
                throw new Error("Failed to retrieve consent");
            }
        });
    }

    async setConsent(userId: string, consentType: string, state: ConsentState): Promise<void> {
        const grantedAt = state === 'GRANTED' ? new Date() : null;
        const revokedAt = state === 'REVOKED' ? new Date() : null;

        const query = `
            INSERT INTO consents (user_id, consent_type, state, granted_at, revoked_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, consent_type) DO UPDATE SET
                state = EXCLUDED.state,
                granted_at = CASE WHEN EXCLUDED.state = 'GRANTED' THEN CURRENT_TIMESTAMP ELSE consents.granted_at END,
                revoked_at = CASE WHEN EXCLUDED.state = 'REVOKED' THEN CURRENT_TIMESTAMP ELSE consents.revoked_at END,
                updated_at = CURRENT_TIMESTAMP
        `;
        return this.withRlsTransaction(userId, async (client) => {
            try {
                await client.query(query, [userId, consentType, state, grantedAt, revokedAt]);
            } catch (error: any) {
                this.logger.error('DatabaseQueryError', { requestId: 'consent-repo', timestamp: new Date() });
                throw new Error("Failed to set consent");
            }
        });
    }
}
