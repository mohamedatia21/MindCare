import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MigrationRunner {
    private logger = new RuntimeLogger();

    constructor(private pool: pg.Pool) {}

    async runMigrations(): Promise<void> {
        this.logger.info('MigrationStarted', { requestId: 'migration', timestamp: new Date() });
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                CREATE TABLE IF NOT EXISTS migrations (
                    version INTEGER PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            const migrationsDir = path.join(__dirname, 'migrations');
            let files: string[] = [];
            try {
                files = await fs.readdir(migrationsDir);
            } catch (err) {
                this.logger.info('MigrationNoDirectory', { requestId: 'migration', timestamp: new Date() });
                await client.query('ROLLBACK');
                return;
            }

            const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

            for (const file of sqlFiles) {
                const versionMatch = file.match(/^(\d+)_/);
                if (!versionMatch || !versionMatch[1]) continue;
                const version = parseInt(versionMatch[1], 10);

                const { rows } = await client.query('SELECT version FROM migrations WHERE version = $1', [version]);
                if (rows.length === 0) {
                    this.logger.info('MigrationApplying', { requestId: 'migration', timestamp: new Date() });
                    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
                    await client.query(sql);
                    await client.query('INSERT INTO migrations (version, name) VALUES ($1, $2)', [version, file]);
                    this.logger.info('MigrationApplied', { requestId: 'migration', timestamp: new Date() });
                }
            }

            await client.query('COMMIT');
            this.logger.info('MigrationCompleted', { requestId: 'migration', timestamp: new Date() });
        } catch (error: any) {
            await client.query('ROLLBACK');
            this.logger.error('MigrationFailed', { requestId: 'migration', error: error.message, timestamp: new Date() });
            throw error;
        } finally {
            client.release();
        }
    }
}
