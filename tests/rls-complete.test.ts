import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { PostgresSessionRepository } from '../src/infrastructure/database/pg-session-repository.js';
import { PostgresConsentRepository } from '../src/infrastructure/database/pg-consent-repository.js';

describe('Phase 11: Complete RLS Enforcement (Sessions & Consents)', () => {
    it('SessionRepository executes inside BEGIN/SET LOCAL/COMMIT transaction', async () => {
        const queryLog: string[] = [];
        const mockClient = {
            query: vi.fn(async (sql: string, params?: any[]) => {
                queryLog.push(sql.trim());
                if (sql.includes('SELECT') && sql.includes('sessions')) {
                    return { rows: [{ id: 'sess-1', user_id: params?.[1], status: 'ACTIVE', started_at: new Date() }], rowCount: 1 };
                }
                return { rows: [], rowCount: 1 };
            }),
            release: vi.fn()
        };

        const mockPool = {
            connect: vi.fn(async () => mockClient),
            query: vi.fn()
        };

        const repo = new PostgresSessionRepository(mockPool as any);
        const userId = randomUUID();
        const session = await repo.getSession(userId, 'sess-1');

        expect(session).not.toBeNull();
        expect(queryLog[0]).toBe('BEGIN');
        expect(queryLog[1]).toContain('set_config(\'app.current_user_id\'');
        expect(queryLog[2]).toContain('SELECT');
        expect(queryLog[3]).toBe('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('ConsentRepository executes inside BEGIN/SET LOCAL/COMMIT transaction', async () => {
        const queryLog: string[] = [];
        const mockClient = {
            query: vi.fn(async (sql: string, params?: any[]) => {
                queryLog.push(sql.trim());
                if (sql.includes('SELECT') && sql.includes('consents')) {
                    return { rows: [{ id: 'con-1', user_id: params?.[0], consent_type: 'EMERGENCY_ESCALATION', state: 'GRANTED' }], rowCount: 1 };
                }
                return { rows: [], rowCount: 1 };
            }),
            release: vi.fn()
        };

        const mockPool = {
            connect: vi.fn(async () => mockClient),
            query: vi.fn()
        };

        const repo = new PostgresConsentRepository(mockPool as any);
        const userId = randomUUID();
        const consent = await repo.getConsent(userId, 'EMERGENCY_ESCALATION');

        expect(consent).not.toBeNull();
        expect(consent?.state).toBe('GRANTED');
        expect(queryLog[0]).toBe('BEGIN');
        expect(queryLog[1]).toContain('set_config(\'app.current_user_id\'');
        expect(queryLog[2]).toContain('SELECT');
        expect(queryLog[3]).toBe('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('DENIES cross-tenant session reads under RLS isolation', async () => {
        const userA = randomUUID();
        const userB = randomUUID();
        const sessionId = randomUUID();
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
                if (sql.includes('SELECT') && sql.includes('sessions')) {
                    if (currentUserId === userA) {
                        return {
                            rows: [{ id: sessionId, user_id: userA, status: 'ACTIVE', started_at: new Date() }],
                            rowCount: 1
                        };
                    }
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

        const repo = new PostgresSessionRepository(mockPool as any);
        // User A reads session
        const sessA = await repo.getSession(userA, sessionId);
        expect(sessA).not.toBeNull();

        // User B cannot read User A's session
        const sessB = await repo.getSession(userB, sessionId);
        expect(sessB).toBeNull();
    });

    it('DENIES cross-tenant consent updates under RLS isolation', async () => {
        const userA = randomUUID();
        const userB = randomUUID();
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
                if (sql.includes('SELECT') && sql.includes('consents')) {
                    if (currentUserId === userA) {
                        return {
                            rows: [{ id: 'con-1', user_id: userA, consent_type: 'DATA_SHARING', state: 'GRANTED' }],
                            rowCount: 1
                        };
                    }
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

        const repo = new PostgresConsentRepository(mockPool as any);
        const consentA = await repo.getConsent(userA, 'DATA_SHARING');
        expect(consentA).not.toBeNull();

        const consentB = await repo.getConsent(userB, 'DATA_SHARING');
        expect(consentB).toBeNull();
    });
});
