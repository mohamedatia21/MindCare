import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

/**
 * Phase 10: Production Infrastructure Tests
 * 
 * Tests cover:
 * 1. RLS enforcement (unit-level simulation since DB may not be available)
 * 2. Valkey lock atomicity (SET NX PX + Lua release)
 * 3. Valkey connection failure → Fail-Closed (NOT fallback)
 * 4. WST ticket lifecycle with Valkey
 * 5. ValkeyStateCoordinator cache miss vs connection error
 */

// ============================================================
// 1. RLS: PostgresMemoryRepository SET LOCAL enforcement
// ============================================================
describe('Phase 10: RLS Transaction Enforcement', () => {
    it('wraps every operation in BEGIN/SET LOCAL/COMMIT', async () => {
        const queryLog: string[] = [];

        const mockClient = {
            query: vi.fn(async (sql: string, params?: any[]) => {
                queryLog.push(sql.trim());
                if (sql.includes('SELECT') && sql.includes('memories')) {
                    return { rows: [], rowCount: 0 };
                }
                return { rows: [], rowCount: 1 };
            }),
            release: vi.fn()
        };

        const mockPool = {
            connect: vi.fn(async () => mockClient),
            query: vi.fn()
        };

        const { PostgresMemoryRepository } = await import('../src/infrastructure/database/pg-memory-repository.js');
        const repo = new PostgresMemoryRepository(mockPool as any);

        const userId = randomUUID();
        await repo.findMany(userId);

        // Verify the exact sequence: BEGIN -> SET LOCAL -> query -> COMMIT
        expect(queryLog[0]).toBe('BEGIN');
        expect(queryLog[1]).toContain('set_config(\'app.current_user_id\'');
        // The actual SELECT query
        expect(queryLog[2]).toContain('SELECT');
        expect(queryLog[3]).toBe('COMMIT');

        // Verify SET LOCAL was called with the correct userId
        expect(mockClient.query).toHaveBeenCalledWith(
            'SELECT set_config(\'app.current_user_id\', $1, true)',
            [userId]
        );

        // Verify client was released back to pool
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back on error and still releases client', async () => {
        const queryLog: string[] = [];
        const mockClient = {
            query: vi.fn(async (sql: string) => {
                queryLog.push(sql.trim());
                if (sql.includes('SELECT') && sql.includes('memories')) {
                    throw new Error('Simulated DB error');
                }
                return { rows: [], rowCount: 0 };
            }),
            release: vi.fn()
        };

        const mockPool = {
            connect: vi.fn(async () => mockClient),
            query: vi.fn()
        };

        const { PostgresMemoryRepository } = await import('../src/infrastructure/database/pg-memory-repository.js');
        const repo = new PostgresMemoryRepository(mockPool as any);

        await expect(repo.findMany(randomUUID())).rejects.toThrow();
        
        // Must have rolled back
        expect(queryLog).toContain('ROLLBACK');
        // Must have released the client
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('User A cannot read User B memory through RLS-enforced repo', async () => {
        const userA = randomUUID();
        const userB = randomUUID();
        const memoryId = randomUUID();

        // This mock simulates RLS: queries scoped to SET LOCAL user only return matching rows
        let currentUserId: string | null = null;

        const mockClient = {
            query: vi.fn(async (sql: string, params?: any[]) => {
                if (sql.includes('BEGIN')) return {};
                if (sql.includes('SET LOCAL') || sql.includes('set_config')) {
                    currentUserId = params?.[0] || null;
                    return {};
                }
                if (sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
                    currentUserId = null;
                    return {};
                }
                // Simulate RLS: only return rows if the userId matches
                if (sql.includes('SELECT') && sql.includes('memories')) {
                    if (currentUserId === userA) {
                        return {
                            rows: [{
                                id: memoryId, user_id: userA, memory_class: 'SENSITIVE',
                                content: 'Private A', epistemic_status: 'USER_REPORTED',
                                status: 'ACTIVE', retention_policy: 'LONG_TERM_APPROVED',
                                consent_state: 'GRANTED', source: 'test',
                                created_at: new Date(), updated_at: new Date(),
                                expires_at: null, embedding: null
                            }],
                            rowCount: 1
                        };
                    }
                    // userB trying to access userA's memory -> RLS blocks it
                    return { rows: [], rowCount: 0 };
                }
                return { rows: [], rowCount: 1 };
            }),
            release: vi.fn()
        };

        const mockPool = {
            connect: vi.fn(async () => mockClient),
            query: vi.fn()
        };

        const { PostgresMemoryRepository } = await import('../src/infrastructure/database/pg-memory-repository.js');
        const repo = new PostgresMemoryRepository(mockPool as any);

        // User A can read their own memory
        const memA = await repo.find(userA, memoryId);
        expect(memA).not.toBeNull();
        expect(memA?.content).toBe('Private A');

        // User B CANNOT read User A's memory (RLS enforced)
        const memB = await repo.find(userB, memoryId);
        expect(memB).toBeNull();
    });
});

// ============================================================
// 2. ValkeyStateCoordinator: Cache Miss vs Connection Error
// ============================================================
describe('Phase 10: ValkeyStateCoordinator Fail-Closed', () => {

    it('returns false (Fail-Closed) when Valkey connection throws', async () => {
        const mockRedis = {
            get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
            set: vi.fn(),
            del: vi.fn(),
            eval: vi.fn()
        };

        const mockRepo = {
            findMany: vi.fn().mockResolvedValue([]),
            find: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            purgeAllUserData: vi.fn(),
            findSimilar: vi.fn()
        };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        const result = await coordinator.isUserActiveAndConsented('user-123');

        // MUST be false (Fail-Closed), NOT fallback to DB
        expect(result).toBe(false);
        // DB should NOT have been called
        expect(mockRepo.findMany).not.toHaveBeenCalled();
    });

    it('returns false for cache miss when cutover flag is disabled', async () => {
        // Ensure the flag is NOT set
        delete process.env.ENABLE_LEGACY_CUTOVER_FALLBACK;

        const mockRedis = {
            get: vi.fn().mockResolvedValue(null), // Cache miss, Valkey is UP
            set: vi.fn(),
            del: vi.fn(),
            eval: vi.fn()
        };

        const mockRepo = {
            findMany: vi.fn().mockResolvedValue([]),
            find: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            purgeAllUserData: vi.fn(),
            findSimilar: vi.fn()
        };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        const result = await coordinator.isUserActiveAndConsented('user-abc');

        // Cache miss + no cutover flag = false
        expect(result).toBe(false);
        expect(mockRepo.findMany).not.toHaveBeenCalled();
    });

    it('falls back to DB during cutover when flag is enabled and Valkey is UP', async () => {
        const originalVal = process.env.ENABLE_LEGACY_CUTOVER_FALLBACK;
        process.env.ENABLE_LEGACY_CUTOVER_FALLBACK = 'true';

        const mockRedis = {
            get: vi.fn().mockResolvedValue(null), // Cache miss, Valkey is UP
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn(),
            eval: vi.fn()
        };

        const userId = 'user-cutover';
        const mockRepo = {
            findMany: vi.fn().mockResolvedValue([
                { consentState: 'GRANTED', status: 'ACTIVE' }
            ]),
            find: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            purgeAllUserData: vi.fn(),
            findSimilar: vi.fn()
        };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        const result = await coordinator.isUserActiveAndConsented(userId);

        // During cutover: cache miss + active DB record = true
        expect(result).toBe(true);
        // Should have lazy-loaded into Valkey
        expect(mockRedis.set).toHaveBeenCalledWith(`active_user:${userId}`, 'ACTIVE', 'EX', 3600);

        // Restore
        if (originalVal === undefined) delete process.env.ENABLE_LEGACY_CUTOVER_FALLBACK;
        else process.env.ENABLE_LEGACY_CUTOVER_FALLBACK = originalVal;
    });

    it('does NOT fall back to DB during cutover when Valkey connection throws', async () => {
        const originalVal = process.env.ENABLE_LEGACY_CUTOVER_FALLBACK;
        process.env.ENABLE_LEGACY_CUTOVER_FALLBACK = 'true';

        const mockRedis = {
            get: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')), // Connection error
            set: vi.fn(),
            del: vi.fn(),
            eval: vi.fn()
        };

        const mockRepo = {
            findMany: vi.fn().mockResolvedValue([{ consentState: 'GRANTED' }]),
            find: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            purgeAllUserData: vi.fn(),
            findSimilar: vi.fn()
        };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        const result = await coordinator.isUserActiveAndConsented('user-xyz');

        // MUST be Fail-Closed even with cutover flag on
        expect(result).toBe(false);
        // DB MUST NOT be called when Valkey connection fails
        expect(mockRepo.findMany).not.toHaveBeenCalled();

        if (originalVal === undefined) delete process.env.ENABLE_LEGACY_CUTOVER_FALLBACK;
        else process.env.ENABLE_LEGACY_CUTOVER_FALLBACK = originalVal;
    });

    it('returns true when Valkey has ACTIVE status', async () => {
        const mockRedis = {
            get: vi.fn().mockResolvedValue('ACTIVE'),
            set: vi.fn(),
            del: vi.fn(),
            eval: vi.fn()
        };

        const mockRepo = {
            findMany: vi.fn(),
            find: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            purgeAllUserData: vi.fn(),
            findSimilar: vi.fn()
        };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        const result = await coordinator.isUserActiveAndConsented('user-active');
        expect(result).toBe(true);
    });
});

// ============================================================
// 3. Valkey Lock Atomicity
// ============================================================
describe('Phase 10: Valkey Distributed Lock (lock:guard)', () => {

    it('acquires lock with SET NX PX and releases with Lua script', async () => {
        let storedLockId: string | null = null;

        const mockRedis = {
            get: vi.fn().mockResolvedValue('ACTIVE'),
            set: vi.fn(async (key: string, value: string, ...args: any[]) => {
                storedLockId = value;
                return 'OK';
            }),
            del: vi.fn(),
            eval: vi.fn(async (script: string, numKeys: number, key: string, lockId: string) => {
                // Simulate Lua: only delete if lockId matches
                if (lockId === storedLockId) {
                    storedLockId = null;
                    return 1;
                }
                return 0;
            })
        };

        const mockRepo = { findMany: vi.fn(), find: vi.fn(), save: vi.fn(), update: vi.fn(), softDelete: vi.fn(), purgeAllUserData: vi.fn(), findSimilar: vi.fn() };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        let operationExecuted = false;
        await coordinator.withLock('user-lock-test', async () => {
            operationExecuted = true;

            // Lock should be held
            expect(mockRedis.set).toHaveBeenCalledWith(
                'lock:guard:user-lock-test',
                expect.any(String),
                'PX', 10000, 'NX'
            );
        });

        expect(operationExecuted).toBe(true);

        // Lock should have been released via Lua eval
        expect(mockRedis.eval).toHaveBeenCalledWith(
            expect.stringContaining('redis.call("get"'),
            1,
            'lock:guard:user-lock-test',
            expect.any(String)
        );

        // Lock should be released
        expect(storedLockId).toBeNull();
    });

    it('throws when lock cannot be acquired (contention)', async () => {
        const mockRedis = {
            set: vi.fn().mockResolvedValue(null), // NX fails = lock already held
            eval: vi.fn()
        };

        const mockRepo = { findMany: vi.fn(), find: vi.fn(), save: vi.fn(), update: vi.fn(), softDelete: vi.fn(), purgeAllUserData: vi.fn(), findSimilar: vi.fn() };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        await expect(coordinator.withLock('user-contended', async () => {
            throw new Error('Should not execute');
        })).rejects.toThrow('Lock acquisition failed');
    });

    it('releases lock even when operation throws', async () => {
        let lockReleased = false;

        const mockRedis = {
            set: vi.fn().mockResolvedValue('OK'),
            eval: vi.fn(async () => { lockReleased = true; return 1; })
        };

        const mockRepo = { findMany: vi.fn(), find: vi.fn(), save: vi.fn(), update: vi.fn(), softDelete: vi.fn(), purgeAllUserData: vi.fn(), findSimilar: vi.fn() };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        await expect(coordinator.withLock('user-error', async () => {
            throw new Error('Operation failed');
        })).rejects.toThrow('Operation failed');

        // Lock MUST be released even on error (finally block)
        expect(lockReleased).toBe(true);
    });

    it('does NOT release lock if a different instance holds it (wrong lockId)', async () => {
        const mockRedis = {
            set: vi.fn().mockResolvedValue('OK'),
            eval: vi.fn(async (script: string, numKeys: number, key: string, lockId: string) => {
                // Simulate: stored lockId is different
                return 0; // Lua returns 0 = not our lock
            })
        };

        const mockRepo = { findMany: vi.fn(), find: vi.fn(), save: vi.fn(), update: vi.fn(), softDelete: vi.fn(), purgeAllUserData: vi.fn(), findSimilar: vi.fn() };

        const { ValkeyStateCoordinator } = await import('../src/infrastructure/realtime/valkey-state-coordinator.js');
        const coordinator = new ValkeyStateCoordinator(mockRedis as any, mockRepo as any);

        await coordinator.withLock('user-wrong-owner', async () => {
            // Operation completes
        });

        // Lua script was called but returned 0 (did not delete)
        expect(mockRedis.eval).toHaveBeenCalled();
    });
});

// ============================================================
// 4. WST Ticket Service with Valkey
// ============================================================
describe('Phase 10: WST Ticket Service (Valkey-backed)', () => {

    it('generates ticket stored in Valkey with EX TTL', async () => {
        const mockRedis = {
            set: vi.fn().mockResolvedValue('OK'),
            call: vi.fn().mockResolvedValue(null)
        };

        const { WSTicketService } = await import('../src/infrastructure/auth/ws-ticket-service.js');
        const service = new WSTicketService(mockRedis as any);

        const payload = { sub: 'user-123', role: 'USER', iat: 0, exp: 0 };
        const ticket = await service.generateTicket(payload);

        expect(ticket).toBeDefined();
        expect(ticket.length).toBe(64); // 32 bytes hex

        // Must store with EX 10
        expect(mockRedis.set).toHaveBeenCalledWith(
            `wst:${ticket}`,
            JSON.stringify(payload),
            'EX', 10
        );
    });

    it('consumes ticket atomically via GETDEL', async () => {
        const payload = { sub: 'user-456', role: 'USER', iat: 0, exp: 0 };

        const mockRedis = {
            set: vi.fn().mockResolvedValue('OK'),
            call: vi.fn().mockResolvedValue(JSON.stringify(payload))
        };

        const { WSTicketService } = await import('../src/infrastructure/auth/ws-ticket-service.js');
        const service = new WSTicketService(mockRedis as any);

        const result = await service.consumeTicket('fake-ticket-id');

        expect(result).toEqual(payload);
        // Must use GETDEL for atomic single-use
        expect(mockRedis.call).toHaveBeenCalledWith('GETDEL', 'wst:fake-ticket-id');
    });

    it('returns null for expired/missing ticket', async () => {
        const mockRedis = {
            set: vi.fn(),
            call: vi.fn().mockResolvedValue(null) // GETDEL returns null
        };

        const { WSTicketService } = await import('../src/infrastructure/auth/ws-ticket-service.js');
        const service = new WSTicketService(mockRedis as any);

        const result = await service.consumeTicket('nonexistent-ticket');
        expect(result).toBeNull();
    });

    it('ticket contains NO clinical data (only userId, role)', async () => {
        const mockRedis = {
            set: vi.fn().mockResolvedValue('OK'),
            call: vi.fn()
        };

        const { WSTicketService } = await import('../src/infrastructure/auth/ws-ticket-service.js');
        const service = new WSTicketService(mockRedis as any);

        const payload = { sub: 'user-789', role: 'USER', iat: 0, exp: 0 };
        await service.generateTicket(payload);

        // Verify what was stored
        const storedData = mockRedis.set.mock.calls[0]![1] as string;
        const parsed = JSON.parse(storedData);

        // MUST NOT contain clinical data
        expect(parsed).not.toHaveProperty('memories');
        expect(parsed).not.toHaveProperty('diagnosis');
        expect(parsed).not.toHaveProperty('content');
        expect(parsed).not.toHaveProperty('sessions');

        // MUST only contain auth identifiers
        expect(parsed).toHaveProperty('sub');
        expect(parsed).toHaveProperty('role');
    });
});

// ============================================================
// 5. RLS Migration SQL Validation
// ============================================================
describe('Phase 10: RLS Migration SQL Correctness', () => {
    it('migration contains FORCE ROW LEVEL SECURITY for all tables', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const migrationPath = path.join(process.cwd(), 'src/infrastructure/database/migrations/003_add_rls.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Must contain ENABLE + FORCE for each table
        expect(sql).toContain('ALTER TABLE memories ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE memories FORCE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE consents ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE consents FORCE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE sessions ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE sessions FORCE ROW LEVEL SECURITY');

        // Must strip BYPASSRLS from the app role
        expect(sql).toContain('NOBYPASSRLS');

        // Must use current_setting for RLS policy
        expect(sql).toContain("current_setting('app.current_user_id'");
    });
});
