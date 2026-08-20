import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresMemoryRepository } from '../src/infrastructure/database/pg-memory-repository.js';
import { PostgresSessionRepository } from '../src/infrastructure/database/pg-session-repository.js';
import { PostgresConsentRepository } from '../src/infrastructure/database/pg-consent-repository.js';
import { dbPool, closePool } from '../src/infrastructure/database/pg-pool.js';
import { MigrationRunner } from '../src/infrastructure/database/migration-runner.js';
import { randomUUID } from 'crypto';

// Setup real DB for tests if running in an environment with DB configured
const runDBTests = !!process.env.DATABASE_URL && dbPool !== null;

(runDBTests ? describe : describe.skip)('Phase 8: Strict Tenant Isolation (Database Level)', () => {
    let memoryRepo: PostgresMemoryRepository;
    let sessionRepo: PostgresSessionRepository;
    let consentRepo: PostgresConsentRepository;

    const userA = randomUUID();
    const userB = randomUUID();
    const sessionA = randomUUID();
    const memoryA = randomUUID();

    beforeAll(async () => {
        if (!dbPool) return;
        const runner = new MigrationRunner(dbPool);
        await runner.runMigrations();

        memoryRepo = new PostgresMemoryRepository(dbPool);
        sessionRepo = new PostgresSessionRepository(dbPool);
        consentRepo = new PostgresConsentRepository(dbPool);

        // Insert test users directly
        await dbPool.query("INSERT INTO users (id, role) VALUES ($1, 'USER')", [userA]);
        await dbPool.query("INSERT INTO users (id, role) VALUES ($1, 'USER')", [userB]);
    });

    afterAll(async () => {
        if (!dbPool) return;
        // Cleanup test data
        await dbPool.query("DELETE FROM users WHERE id IN ($1, $2)", [userA, userB]);
        await closePool();
    });

    it('Creates session and memory for User A', async () => {
        await sessionRepo.createSession(userA, sessionA);
        await memoryRepo.save(userA, {
            id: memoryA,
            userId: userA,
            memoryClass: 'SENSITIVE',
            content: 'User A private thought',
            epistemicStatus: 'USER_REPORTED',
            status: 'ACTIVE',
            retentionPolicy: 'LONG_TERM_APPROVED',
            consentState: 'GRANTED',
            source: 'test',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const mem = await memoryRepo.find(userA, memoryA);
        expect(mem).toBeDefined();
        expect(mem?.content).toBe('User A private thought');
    });

    it('DENIES User B from reading User A memory', async () => {
        const mem = await memoryRepo.find(userB, memoryA);
        expect(mem).toBeNull(); // Tenant mismatch enforced in SQL
    });

    it('DENIES User B from updating User A memory', async () => {
        await expect(memoryRepo.update(userB, memoryA, { content: 'hacked' }))
            .rejects.toThrow('Failed to update memory'); // Error from rowCount === 0
        
        // Verify it wasn't modified
        const mem = await memoryRepo.find(userA, memoryA);
        expect(mem?.content).toBe('User A private thought');
    });

    it('DENIES User B from deleting User A memory', async () => {
        await memoryRepo.softDelete(userB, memoryA);
        
        // Verify it wasn't deleted
        const mem = await memoryRepo.find(userA, memoryA);
        expect(mem?.status).toBe('ACTIVE');
    });

    it('DENIES User B from accessing User A session', async () => {
        const sess = await sessionRepo.getSession(userB, sessionA);
        expect(sess).toBeNull();
    });

    it('Enforces memory creation under own tenant ID', async () => {
        const memoryX = randomUUID();
        // Trying to save memory owned by User A, but API called by User B
        await expect(memoryRepo.save(userB, {
            id: memoryX,
            userId: userA, // Mismatch!
            memoryClass: 'SENSITIVE',
            content: 'User B injection',
            epistemicStatus: 'USER_REPORTED',
            status: 'ACTIVE',
            retentionPolicy: 'LONG_TERM_APPROVED',
            consentState: 'GRANTED',
            source: 'test',
            createdAt: new Date(),
            updatedAt: new Date()
        })).rejects.toThrow('Tenant mismatch');
    });
});
