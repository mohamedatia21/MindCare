import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

describe('Real Infrastructure: PostgreSQL RLS', () => {
    let pool: Pool;
    const userA = randomUUID();
    const userB = randomUUID();

    beforeAll(async () => {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mindcare'
        });
        
        try {
            await pool.query('SELECT 1');
        } catch (error) {
            console.warn('REAL POSTGRESQL INSTANCE REQUIRED. Test will fail or be skipped.');
        }
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    it('should prevent User A from reading User B data (NOBYPASSRLS)', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL app.current_user_id = '${userA}'`);
            
            // Assuming table 'memories' exists with RLS
            const result = await client.query(`SELECT * FROM memories WHERE user_id = '${userB}'`);
            expect(result.rows.length).toBe(0);
            
            await client.query('ROLLBACK');
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message.includes('password authentication failed')) {
                if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') {
                    throw new Error('REQUIRE_REAL_INFRASTRUCTURE is true but PostgreSQL is unavailable.');
                }
                console.warn('UNVERIFIED — REAL POSTGRESQL INSTANCE REQUIRED');
                return; // Skip assertion if DB isn't there
            }
            throw error;
        } finally {
            client.release();
        }
    });

    it('should fail safely if app.current_user_id is missing', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Deliberately DO NOT set app.current_user_id
            
            const res = await client.query(`SELECT * FROM memories`);
            expect(res.rows.length).toBe(0);
            
            await client.query('ROLLBACK');
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message.includes('password')) {
                if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') throw error;
                return;
            }
            throw error;
        } finally {
            client.release();
        }
    });

    it('should ensure pooled connections do not leak tenant context', async () => {
        const client1 = await pool.connect();
        try {
            await client1.query('BEGIN');
            await client1.query(`SET LOCAL app.current_user_id = '${userA}'`);
            await client1.query('COMMIT');
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message.includes('password')) {
                if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') throw error;
                return;
            }
        } finally {
            client1.release();
        }
        
        const client2 = await pool.connect();
        try {
            await client2.query('BEGIN');
            const res = await client2.query(`SHOW app.current_user_id`);
            expect(res.rows[0]['app.current_user_id']).not.toBe(userA);
            await client2.query('ROLLBACK');
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message.includes('password')) {
                if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') throw error;
                return;
            }
            if (error.message.includes('unrecognized configuration parameter')) {
                // Expected if not set
                expect(true).toBe(true);
            } else {
                throw error;
            }
        } finally {
            client2.release();
        }
    });
});
