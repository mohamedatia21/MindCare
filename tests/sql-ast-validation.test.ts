import { describe, it, expect } from 'vitest';
import { validateAndTransformQuery } from '../src/infrastructure/mcp/postgres-mcp-server.js';

describe('Postgres MCP AST SQL Validation', () => {

    it('allows basic SELECT queries and injects LIMIT', () => {
        const result = validateAndTransformQuery('SELECT id, topic FROM knowledge_chunks');
        expect(result).toMatch(/LIMIT \(100\)/i);
    });

    it('allows JOINs on safe tables', () => {
        const result = validateAndTransformQuery('SELECT * FROM knowledge_chunks k JOIN migrations m ON k.id = m.id');
        expect(result).toMatch(/LIMIT \(100\)/i);
    });

    it('rejects multiple statements', () => {
        expect(() => validateAndTransformQuery('SELECT * FROM knowledge_chunks; SELECT * FROM migrations;'))
            .toThrow(/Multiple SQL statements are not allowed/);
    });

    it('rejects DROP TABLE bypass via comments', () => {
        // Even with a comment, the AST parser either sees two statements or fails.
        // It should reject DROP.
        expect(() => validateAndTransformQuery('SELECT * FROM knowledge_chunks /*; DROP TABLE knowledge_chunks;*/'))
            .not.toThrow(); // In this case, the AST strips comments, so it's a safe SELECT * !
        
        expect(() => validateAndTransformQuery('SELECT * FROM knowledge_chunks; DROP TABLE knowledge_chunks;'))
            .toThrow(/Multiple SQL statements/);
    });

    it('rejects non-SELECT statements like INSERT', () => {
        expect(() => validateAndTransformQuery('INSERT INTO migrations (version) VALUES (1)'))
            .toThrow(/Only SELECT statements are allowed/);
    });

    it('rejects non-SELECT statements like UPDATE', () => {
        expect(() => validateAndTransformQuery('UPDATE migrations SET version = 2'))
            .toThrow(/Only SELECT statements are allowed/);
    });

    it('blocks access to sensitive PII tables', () => {
        expect(() => validateAndTransformQuery('SELECT * FROM memories'))
            .toThrow(/blocked by MCP security policy/);
        
        expect(() => validateAndTransformQuery('SELECT * FROM sessions'))
            .toThrow(/blocked by MCP security policy/);

        expect(() => validateAndTransformQuery('SELECT * FROM users'))
            .toThrow(/blocked by MCP security policy/);

        expect(() => validateAndTransformQuery('SELECT * FROM consents'))
            .toThrow(/blocked by MCP security policy/);
    });

    it('blocks access via JOIN to sensitive PII tables', () => {
        expect(() => validateAndTransformQuery('SELECT * FROM knowledge_chunks k JOIN sessions s ON k.id = s.id'))
            .toThrow(/blocked by MCP security policy/);
    });

    it('blocks sensitive column names even in safe tables', () => {
        expect(() => validateAndTransformQuery('SELECT password FROM dummy_table'))
            .toThrow(/sensitive keyword: 'password'/);
        
        expect(() => validateAndTransformQuery('SELECT secret_key FROM dummy_table'))
            .toThrow(/sensitive keyword: 'secret'/);
            
        expect(() => validateAndTransformQuery('SELECT token FROM dummy_table'))
            .toThrow(/sensitive keyword: 'token'/);
    });
});
