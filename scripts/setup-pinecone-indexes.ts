import { Pinecone } from '@pinecone-database/pinecone';
import 'dotenv/config';

async function setupIndexes() {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        console.error('PINECONE_API_KEY is not configured in the environment.');
        process.exit(1);
    }

    const pinecone = new Pinecone({ apiKey });
    
    const knowledgeIndex = process.env.PINECONE_INDEX_KNOWLEDGE || 'mindcare-knowledge';
    const memoryIndex = process.env.PINECONE_INDEX_MEMORY || 'mindcare-memories';
    
    const dimension = 1536;

    try {
        const { indexes } = await pinecone.listIndexes();
        const existingNames = indexes?.map(i => i.name) || [];

        // 1. Setup Knowledge Index (Cosine)
        if (!existingNames.includes(knowledgeIndex)) {
            console.log(`Creating knowledge index: ${knowledgeIndex} (dimension: ${dimension}, metric: cosine)`);
            await pinecone.createIndex({
                name: knowledgeIndex,
                dimension: dimension,
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1' // Use standard default or allow override via env
                    }
                }
            });
            console.log(`Created knowledge index: ${knowledgeIndex}`);
        } else {
            console.log(`Knowledge index '${knowledgeIndex}' already exists. Validating...`);
            const meta = await pinecone.describeIndex(knowledgeIndex);
            if (meta.dimension !== dimension || meta.metric !== 'cosine') {
                console.error(`ERROR: Knowledge index '${knowledgeIndex}' has incorrect configuration.`);
                console.error(`Expected dimension: ${dimension}, metric: cosine`);
                console.error(`Actual dimension: ${meta.dimension}, metric: ${meta.metric}`);
                process.exit(1);
            }
            console.log(`Knowledge index '${knowledgeIndex}' validation passed.`);
        }

        // 2. Setup Memory Index (Euclidean)
        if (!existingNames.includes(memoryIndex)) {
            console.log(`Creating memory index: ${memoryIndex} (dimension: ${dimension}, metric: euclidean)`);
            await pinecone.createIndex({
                name: memoryIndex,
                dimension: dimension,
                metric: 'euclidean',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            console.log(`Created memory index: ${memoryIndex}`);
        } else {
            console.log(`Memory index '${memoryIndex}' already exists. Validating...`);
            const meta = await pinecone.describeIndex(memoryIndex);
            if (meta.dimension !== dimension || meta.metric !== 'euclidean') {
                console.error(`ERROR: Memory index '${memoryIndex}' has incorrect configuration.`);
                console.error(`Expected dimension: ${dimension}, metric: euclidean`);
                console.error(`Actual dimension: ${meta.dimension}, metric: ${meta.metric}`);
                process.exit(1);
            }
            console.log(`Memory index '${memoryIndex}' validation passed.`);
        }

        console.log('Pinecone index setup complete.');
    } catch (error: any) {
        console.error('Failed to setup Pinecone indexes:', error.message);
        process.exit(1);
    }
}

setupIndexes();
