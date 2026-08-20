import pg from 'pg';
import { PineconeKnowledgeStore } from '../src/infrastructure/vector/pinecone-knowledge-store.js';
import { PineconeMemoryStore } from '../src/infrastructure/vector/pinecone-memory-store.js';
import 'dotenv/config';

async function hasEmbeddingColumn(client: pg.Client, table: string): Promise<boolean> {
    const { rows } = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'embedding'
    `, [table]);
    return rows.length > 0;
}

async function migrate() {
    console.log('Starting Vector Migration (PostgreSQL -> Pinecone)...');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL is not configured.');
        process.exit(1);
    }

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        console.error('PINECONE_API_KEY is not configured. Migration requires Pinecone access.');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();

    try {
        // 1. Migrate Knowledge Chunks
        console.log('\n--- Migrating Knowledge Chunks ---');
        const hasKnowledgeEmbedding = await hasEmbeddingColumn(client, 'knowledge_chunks');
        if (!hasKnowledgeEmbedding) {
            console.log('0 vectors migrated — source table knowledge_chunks contains no embeddings (column absent).');
        } else {
            const knowledgeStore = new PineconeKnowledgeStore();
            const { rows: chunks } = await client.query(`SELECT * FROM knowledge_chunks WHERE embedding IS NOT NULL`);
            
            if (chunks.length === 0) {
                console.log('0 vectors migrated — source table knowledge_chunks contains no embeddings (0 rows).');
            } else {
                console.log(`Found ${chunks.length} knowledge chunks to migrate.`);
                let successCount = 0;
                let failCount = 0;
                
                const batchSize = 50;
                for (let i = 0; i < chunks.length; i += batchSize) {
                    const batch = chunks.slice(i, i + batchSize);
                    const records = batch.map(row => ({
                        id: row.id,
                        vector: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
                        metadata: {
                            id: row.id,
                            text: row.text,
                            pdf_page: row.pdf_page,
                            topic: row.topic,
                            section: row.section,
                            source_document: row.source_document,
                            source_type: row.source_type || 'internal_book',
                            book_title: row.book_title,
                            author: row.author,
                            edition: row.edition,
                            chapter: row.chapter
                        }
                    }));

                    try {
                        await knowledgeStore.batchUpsert(records);
                        successCount += records.length;
                        console.log(`Upserted ${successCount}/${chunks.length} knowledge vectors...`);
                    } catch (err: any) {
                        failCount += records.length;
                        console.error(`Failed to upsert batch starting at offset ${i}:`, err.message);
                    }
                }
                console.log(`Knowledge migration complete: ${successCount} successful, ${failCount} failed.`);
            }
        }

        // 2. Migrate Memories
        console.log('\n--- Migrating Memories ---');
        const hasMemoryEmbedding = await hasEmbeddingColumn(client, 'memories');
        if (!hasMemoryEmbedding) {
            console.log('0 vectors migrated — source table memories contains no embeddings (column absent).');
        } else {
            const memoryStore = new PineconeMemoryStore();
            const { rows: memories } = await client.query(`SELECT * FROM memories WHERE embedding IS NOT NULL`);
            
            if (memories.length === 0) {
                console.log('0 vectors migrated — source table memories contains no embeddings (0 rows).');
            } else {
                console.log(`Found ${memories.length} memories to migrate.`);
                let successCount = 0;
                let failCount = 0;
                
                const batchSize = 50;
                for (let i = 0; i < memories.length; i += batchSize) {
                    const batch = memories.slice(i, i + batchSize);
                    const records = batch.map(row => ({
                        id: row.id,
                        vector: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
                        metadata: {
                            id: row.id,
                            user_id: row.user_id,
                            memory_class: row.memory_class,
                            epistemic_status: row.epistemic_status
                        }
                    }));

                    try {
                        await memoryStore.batchUpsert(records);
                        successCount += records.length;
                        console.log(`Upserted ${successCount}/${memories.length} memory vectors...`);
                    } catch (err: any) {
                        failCount += records.length;
                        console.error(`Failed to upsert batch starting at offset ${i}:`, err.message);
                    }
                }
                console.log(`Memory migration complete: ${successCount} successful, ${failCount} failed.`);
            }
        }
    } finally {
        await client.end();
    }
}

migrate().catch(err => {
    console.error('Migration failed with fatal error:', err.message);
    process.exit(1);
});
