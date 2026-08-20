import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '../src/infrastructure/database/migrations');
// Advisory lock ID to prevent concurrent migration executions
const MIGRATION_LOCK_ID = 10001;

async function runMigrations() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL environment variable is required.');
        process.exit(1);
    }

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
        console.log('Acquiring migration lock...');
        // Acquire an exclusive session-level advisory lock
        await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
        console.log('Migration lock acquired. Proceeding...');

        // Ensure migrations table exists (just in case 001 hasn't run)
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Read all SQL files and sort deterministically
        const files = await fs.readdir(MIGRATIONS_DIR);
        const sqlFiles = files
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b));

        const appliedVersions = new Set<number>();
        for (const file of sqlFiles) {
            const versionMatch = file.match(/^(\d+)_/);
            if (!versionMatch) {
                throw new Error(`Invalid migration file format: ${file}. Must start with '<version>_'`);
            }

            const version = parseInt(versionMatch[1] ?? '0', 10);
            if (appliedVersions.has(version)) {
                throw new Error(`Duplicate migration version detected in filesystem: ${version} (${file})`);
            }
            appliedVersions.add(version);

            // Check if already applied
            const { rowCount } = await client.query('SELECT 1 FROM migrations WHERE version = $1', [version]);
            if (rowCount && rowCount > 0) {
                console.log(`Migration ${file} already applied. Skipping.`);
                continue;
            }

            console.log(`Applying migration: ${file}...`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = await fs.readFile(filePath, 'utf-8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO migrations (version, name) VALUES ($1, $2)', [version, file]);
                await client.query('COMMIT');
                console.log(`Successfully applied ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Failed to apply migration ${file}:`, err);
                throw err;
            }
        }
        console.log('All migrations applied successfully.');
    } catch (err) {
        console.error('Migration execution failed:', err);
        process.exit(1);
    } finally {
        console.log('Releasing migration lock...');
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
        client.release();
        await pool.end();
    }
}

runMigrations();
