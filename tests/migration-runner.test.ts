import { describe, it, expect, vi, beforeEach } from 'vitest';
import pg from 'pg';
import fs from 'fs/promises';

let onPoolEnd: (() => void) | null = null;
vi.mock('pg', () => {
    const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
    };
    class MockPool {
        connect = vi.fn().mockResolvedValue(mockClient);
        end = vi.fn().mockImplementation(() => {
            if (onPoolEnd) onPoolEnd();
        });
    }
    return {
        default: { Pool: MockPool },
        Pool: MockPool
    };
});

vi.mock('fs/promises', () => ({
    default: {
        readdir: vi.fn(),
        readFile: vi.fn(),
    }
}));

describe('Migration Runner', () => {
    let mockClient: any;
    
    beforeEach(async () => {
        vi.clearAllMocks();
        onPoolEnd = null;
        
        const pool = new pg.Pool();
        mockClient = await pool.connect();
        vi.clearAllMocks(); // clear the connect call
        
        process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
    });

    // Helper to dynamically import the script to execute it
    async function executeRunner() {
        vi.resetModules();
        let resolveDone: any;
        const donePromise = new Promise(r => resolveDone = r);
        onPoolEnd = () => resolveDone();
        
        await import('../../scripts/run-migrations.js' as any);
        await donePromise;
        onPoolEnd = null;
    }

    it('should acquire advisory lock before migrating and release it after', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([]);
        
        const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit: 1'); }) as any);

        await executeRunner();

        // Lock Acquisition
        expect(mockClient.query).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_lock($1)', [10001]);
        // Table Creation
        expect(mockClient.query).toHaveBeenNthCalledWith(2, expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations'));
        // Lock Release
        expect(mockClient.query).toHaveBeenLastCalledWith('SELECT pg_advisory_unlock($1)', [10001]);
        expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should execute migrations in deterministic order on a clean DB', async () => {
        vi.mocked(fs.readdir).mockResolvedValue(['002_add_pgvector.sql' as any, '001_initial_schema.sql' as any]);
        vi.mocked(fs.readFile).mockResolvedValue('SELECT 1;');
        
        // Mock that no migrations exist (clean DB)
        mockClient.query.mockResolvedValue({ rowCount: 0 });

        await executeRunner();

        // Check if 001 executed before 002
        const queryCalls = mockClient.query.mock.calls;
        
        const queryCallsStr = JSON.stringify(mockClient.query.mock.calls);
        const insert001Index = queryCallsStr.indexOf('001_initial_schema.sql');
        const insert002Index = queryCallsStr.indexOf('002_add_pgvector.sql');
        
        expect(insert001Index).toBeLessThan(insert002Index);
        expect(insert001Index).toBeGreaterThan(-1);
    });

    it('should skip already-current database migrations', async () => {
        vi.mocked(fs.readdir).mockResolvedValue(['001_initial_schema.sql' as any]);
        
        // Mock that migration 1 already exists
        mockClient.query.mockImplementation(async (query: string, values: any[]) => {
            if (query.includes('SELECT 1 FROM migrations WHERE version = $1')) {
                return { rowCount: 1 };
            }
            return { rowCount: 0 };
        });

        await executeRunner();

        const queryCalls = mockClient.query.mock.calls.map((c: any) => c[0]);
        const runMigrations = queryCalls.filter((q: string) => q === 'BEGIN' || q === 'COMMIT');
        
        expect(runMigrations.length).toBe(0); // No transaction should have run
    });

    it('should handle partially migrated databases safely', async () => {
        vi.mocked(fs.readdir).mockResolvedValue(['001_initial.sql' as any, '002_new.sql' as any]);
        vi.mocked(fs.readFile).mockResolvedValue('SELECT 2;');
        
        // Mock that 001 exists but 002 doesn't
        mockClient.query.mockImplementation(async (query: string, values: any[]) => {
            if (query.includes('SELECT 1 FROM migrations WHERE version = $1')) {
                return { rowCount: values[0] === 1 ? 1 : 0 };
            }
            return { rowCount: 0 };
        });

        await executeRunner();

        const insertCalls = mockClient.query.mock.calls.filter((c: any) => c[0].includes('INSERT INTO migrations'));
        expect(insertCalls.length).toBe(1); // Only 002 ran
        expect(insertCalls[0][1]).toEqual([2, '002_new.sql']);
    });

    it('should rollback transaction and release lock on failed migration', async () => {
        vi.mocked(fs.readdir).mockResolvedValue(['001_initial_schema.sql' as any]);
        vi.mocked(fs.readFile).mockResolvedValue('SELECT FAILED;');
        
        let resolveExit: any;
        const exitPromise = new Promise(r => resolveExit = r);
        const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { resolveExit(); return undefined as never; }) as any);

        mockClient.query.mockImplementation(async (query: string) => {
            if (query === 'SELECT FAILED;') throw new Error('SQL Error');
            return { rowCount: 0 };
        });

        executeRunner().catch(() => {});
        await exitPromise; // Wait until process.exit is called

        const queryCalls = mockClient.query.mock.calls.map((c: any) => c[0]);
        expect(queryCalls).toContain('BEGIN');
        expect(queryCalls).toContain('ROLLBACK');
        expect(queryCalls).toContain('SELECT pg_advisory_unlock($1)');
        expect(queryCalls).not.toContain('COMMIT');
    });
});
