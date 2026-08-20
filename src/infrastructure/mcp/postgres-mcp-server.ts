import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pg from 'pg';
import { parse, toSql } from 'pgsql-ast-parser';
import { z } from 'zod';

const { Pool } = pg;

// 1. Environment Isolation Guard
const env = process.env.NODE_ENV || 'development';
const dbUrl = process.env.POSTGRES_MCP_DATABASE_URL || process.env.DATABASE_URL;

const isStandalone = process.argv[1]?.includes('postgres-mcp-server');

if (isStandalone) {
    if (!dbUrl) {
        console.error('Missing POSTGRES_MCP_DATABASE_URL (or DATABASE_URL fallback).');
        process.exit(1);
    }

    const isLikelyProdUrl = dbUrl.includes('.com') || dbUrl.includes('rds.amazonaws.com') || dbUrl.includes('azure.com');
    if (env === 'development' && isLikelyProdUrl) {
        console.error('SECURITY GUARD: Refusing to connect development MCP server to production-like database URL.');
        process.exit(1);
    }

    if (env === 'production') {
        if (!process.env.POSTGRES_MCP_DATABASE_URL) {
            console.error('SECURITY GUARD: Production requires POSTGRES_MCP_DATABASE_URL to be explicitly set (must use a read-only role).');
            process.exit(1);
        }
    }
}

const pool = dbUrl ? new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5
}) : (null as any);

if (pool) {
    // Enforce statement timeout at the connection level
    pool.on('connect', (client: any) => {
        client.query('SET statement_timeout = 5000').catch((err: any) => {
            console.error('Failed to set statement_timeout', err);
        });
    });
}

const server = new McpServer({
    name: 'MindCare Postgres MCP',
    version: '1.0.0'
});

const MAX_ROWS = parseInt(process.env.POSTGRES_MCP_MAX_ROWS || '100', 10);
const PII_TABLES = ['users', 'sessions', 'memories', 'consents'];
const SENSITIVE_WORDS = ['password', 'secret', 'token', 'pii', 'key'];

/**
 * Validates and safely transforms a read-only query.
 */
export function validateAndTransformQuery(sql: string): string {
    let ast;
    try {
        ast = parse(sql);
    } catch (e: any) {
        throw new Error(`Failed to parse SQL: ${e.message}`);
    }

    if (!Array.isArray(ast)) {
        throw new Error('Invalid SQL AST structure.');
    }

    if (ast.length > 1) {
        throw new Error('Multiple SQL statements are not allowed.');
    }

    const statement = ast[0];
    if (!statement) {
        throw new Error('No SQL statement found.');
    }
    if (statement.type !== 'select') {
        throw new Error(`Only SELECT statements are allowed. Found: ${statement.type}`);
    }

    const rebuiltSql = toSql.statement(statement);
    const lowerRebuilt = rebuiltSql.toLowerCase();

    // Check for PII tables
    for (const table of PII_TABLES) {
        // Simple heuristic: if the table name appears as a whole word
        const regex = new RegExp(`\\b${table}\\b`, 'i');
        if (regex.test(rebuiltSql)) {
            throw new Error(`Access to sensitive table '${table}' is blocked by MCP security policy.`);
        }
    }

    // Check for sensitive column words
    for (const word of SENSITIVE_WORDS) {
        if (lowerRebuilt.includes(word)) {
            throw new Error(`Query contains blocked sensitive keyword: '${word}'.`);
        }
    }

    // Force limit
    if (statement) {
        statement.limit = { limit: { type: 'integer', value: MAX_ROWS } };
        return toSql.statement(statement);
    }
    
    return lowerRebuilt;
}


server.tool(
    'postgres_health',
    'Get Postgres connection health and version.',
    {},
    async () => {
        try {
            const { rows } = await pool.query('SELECT version(), current_database()');
            return {
                content: [{ type: 'text', text: JSON.stringify(rows[0], null, 2) }]
            };
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Connection failed: ${e.message}` }]
            };
        }
    }
);

server.tool(
    'postgres_list_schemas',
    'List all schemas in the database.',
    {},
    async () => {
        const { rows } = await pool.query('SELECT schema_name FROM information_schema.schemata');
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
);

server.tool(
    'postgres_list_tables',
    'List all tables in a specific schema (defaults to public).',
    {
        schema: z.string().optional().describe('The schema name, defaults to public')
    },
    async ({ schema }) => {
        const targetSchema = schema || 'public';
        const { rows } = await pool.query(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
            [targetSchema]
        );
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
);

server.tool(
    'postgres_describe_table',
    'Describe the columns of a table.',
    {
        table: z.string().describe('The table name to describe')
    },
    async ({ table }) => {
        const { rows } = await pool.query(
            'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1',
            [table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
);

server.tool(
    'postgres_list_indexes',
    'List indexes for a specific table.',
    {
        table: z.string().describe('The table name')
    },
    async ({ table }) => {
        const { rows } = await pool.query(
            'SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1',
            [table]
        );
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
);

server.tool(
    'postgres_list_constraints',
    'List constraints for a specific table.',
    {
        table: z.string().describe('The table name')
    },
    async ({ table }) => {
        const { rows } = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname = $1
        `, [table]);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
);

server.tool(
    'postgres_migration_status',
    'Inspect the status of database migrations.',
    {},
    async () => {
        try {
            const { rows } = await pool.query('SELECT version, name, applied_at FROM migrations ORDER BY version DESC LIMIT 20');
            return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
        } catch (e: any) {
            return { isError: true, content: [{ type: 'text', text: `Could not read migrations: ${e.message}` }] };
        }
    }
);

server.tool(
    'postgres_read_query',
    'Execute a READ-ONLY SQL query. Only single SELECT statements are allowed. Limited to max rows. Blocked for sensitive tables.',
    {
        query: z.string().describe('The SELECT query to execute')
    },
    async ({ query }) => {
        let safeQuery: string;
        try {
            safeQuery = validateAndTransformQuery(query);
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `SECURITY REJECTION: ${e.message}` }]
            };
        }

        try {
            const { rows } = await pool.query(safeQuery);
            return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Query execution failed: ${e.message}` }]
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MindCare Postgres MCP server running on stdio');
}

if (isStandalone) {
    main().catch(err => {
        console.error('MCP Server crash:', err);
        process.exit(1);
    });
}
