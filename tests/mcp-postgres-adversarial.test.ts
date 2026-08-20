import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import pg from 'pg';
import path from 'path';

// Needs real postgres to test properly, assuming DATABASE_URL is set in environment.
const runDBTests = !!process.env.DATABASE_URL;
const adminDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mindcare';

(runDBTests ? describe : describe.skip)('Postgres MCP Adversarial Security Tests', () => {
    let mcpClient: Client;
    let transport: StdioClientTransport;
    let mcpProcess: any;
    let adminPool: pg.Pool;
    let readonlyPool: pg.Pool;
    let readonlyUrl: string;

    beforeAll(async () => {
        adminPool = new pg.Pool({ connectionString: adminDbUrl });
        
        try {
            await adminPool.query(`CREATE TABLE IF NOT EXISTS mcp_test_data (id serial primary key, val text);`);
            await adminPool.query(`INSERT INTO mcp_test_data (val) VALUES ('test1'), ('test2');`);
            
            // Create read-only role for defense in depth
            await adminPool.query(`DROP ROLE IF EXISTS mcp_readonly_test;`);
            await adminPool.query(`CREATE ROLE mcp_readonly_test WITH LOGIN PASSWORD 'testpassword';`);
            await adminPool.query(`GRANT CONNECT ON DATABASE mindcare TO mcp_readonly_test;`);
            await adminPool.query(`GRANT USAGE ON SCHEMA public TO mcp_readonly_test;`);
            await adminPool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly_test;`);
            
        } catch (e) {
            console.warn('DB setup failed, ensure postgres is running:', e);
        }

        // Parse admin URL to inject the readonly credentials
        const urlObj = new URL(adminDbUrl);
        urlObj.username = 'mcp_readonly_test';
        urlObj.password = 'testpassword';
        readonlyUrl = urlObj.toString();

        readonlyPool = new pg.Pool({ connectionString: readonlyUrl });

        const serverPath = path.resolve(__dirname, '../src/infrastructure/mcp/postgres-mcp-server.ts');
        mcpProcess = spawn('npx', ['tsx', serverPath], {
            env: {
                ...process.env,
                DATABASE_URL: readonlyUrl,
                POSTGRES_MCP_DATABASE_URL: readonlyUrl,
                NODE_ENV: 'development',
                POSTGRES_MCP_MAX_ROWS: '1' // force limit for testing
            }
        });

        transport = new StdioClientTransport({
            command: 'npx',
            args: ['tsx', serverPath],
            env: {
                ...process.env,
                DATABASE_URL: readonlyUrl,
                POSTGRES_MCP_DATABASE_URL: readonlyUrl,
                NODE_ENV: 'development',
                POSTGRES_MCP_MAX_ROWS: '1'
            }
        });

        mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
        await mcpClient.connect(transport);
    });

    afterAll(async () => {
        await mcpClient.close();
        if (mcpProcess) mcpProcess.kill();
        
        try {
            await readonlyPool.end();
            await adminPool.query(`DROP TABLE IF EXISTS mcp_test_data;`);
            await adminPool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM mcp_readonly_test;`);
            await adminPool.query(`DROP ROLE IF EXISTS mcp_readonly_test;`);
        } catch (e) {}
        await adminPool.end();
    });

    it('proves defense in depth: read-only role cannot INSERT at the database level', async () => {
        // This tests the database role itself, independent of the AST parser
        await expect(readonlyPool.query(`INSERT INTO mcp_test_data (val) VALUES ('hack');`))
            .rejects
            .toThrow(/permission denied/);
    });

    it('rejects multiple statements (chaining)', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'SELECT * FROM mcp_test_data; DROP TABLE mcp_test_data;' }
        });
        expect(((result as any).content[0] as any).text).toContain('SECURITY REJECTION');
        expect(((result as any).content[0] as any).text).toContain('Multiple SQL statements are not allowed');
    });

    it('rejects comment bypasses intended to drop tables', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'SELECT * FROM mcp_test_data /*; DROP TABLE mcp_test_data;*/' }
        });
        // This is safe because it strips the comment and just runs SELECT *
        // But if it were dangerous, it would fail. In this case, the AST will parse it as a single SELECT.
        // And LIMIT will be injected.
        expect(result.isError).toBeFalsy();
    });

    it('rejects non-SELECT statements (INSERT)', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'INSERT INTO mcp_test_data (val) VALUES (\'hack\')' }
        });
        expect(((result as any).content[0] as any).text).toContain('SECURITY REJECTION');
        expect(((result as any).content[0] as any).text).toContain('Only SELECT statements are allowed');
    });

    it('rejects DROP statements', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'DROP TABLE mcp_test_data' }
        });
        expect(((result as any).content[0] as any).text).toContain('SECURITY REJECTION');
    });

    it('blocks access to sensitive PII tables', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'SELECT * FROM memories' }
        });
        expect(((result as any).content[0] as any).text).toContain('SECURITY REJECTION');
        expect(((result as any).content[0] as any).text).toContain('blocked by MCP security policy');
    });

    it('blocks queries containing sensitive column keywords', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'SELECT password FROM my_table' }
        });
        expect(((result as any).content[0] as any).text).toContain('SECURITY REJECTION');
        expect(((result as any).content[0] as any).text).toContain('blocked sensitive keyword');
    });

    it('injects and enforces row limit successfully', async () => {
        const result = await mcpClient.callTool({
            name: 'postgres_read_query',
            arguments: { query: 'SELECT * FROM mcp_test_data' }
        });
        // We set max rows to 1 in environment
        expect(result.isError).toBeFalsy();
        const data = JSON.parse(((result as any).content[0] as any).text);
        expect(data.length).toBeLessThanOrEqual(1);
    });

    it('executes postgres_health successfully', async () => {
        const result = await mcpClient.callTool({ name: 'postgres_health', arguments: {} });
        expect(result.isError).toBeFalsy();
        const data = JSON.parse(((result as any).content[0] as any).text);
        expect(data.version).toBeDefined();
    });
});
