import { Pinecone } from '@pinecone-database/pinecone';

let pineconeInstance: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
    if (pineconeInstance) {
        return pineconeInstance;
    }

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        throw new Error('PINECONE_API_KEY is not configured in the environment.');
    }

    // Initialize the Pinecone client
    // Note: We deliberately do NOT log the API key or index configurations here for security.
    pineconeInstance = new Pinecone({
        apiKey
    });

    return pineconeInstance;
}
