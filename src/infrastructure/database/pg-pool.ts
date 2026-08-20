import pg from 'pg';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

const { Pool } = pg;

export const createPool = () => {
    if (!process.env.DATABASE_URL) {
        return null;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 20
    });

    const logger = new RuntimeLogger();

    pool.on('error', (err) => {
        logger.error('DatabasePoolError', {
            requestId: 'pool',
            error: err.message,
            timestamp: new Date()
        });
    });

    return pool;
};

export const dbPool = process.env.NODE_ENV !== 'test' && process.env.DATABASE_URL ? createPool() : null;

export async function closePool() {
    if (dbPool) {
        await dbPool.end();
    }
}
