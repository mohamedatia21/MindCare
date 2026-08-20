import { QdrantClient } from '@qdrant/js-client-rest';

let qdrantInstance: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
    if (qdrantInstance) {
        return qdrantInstance;
    }

    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url) {
        throw new Error('QDRANT_URL is not configured in the environment.');
    }

    qdrantInstance = new QdrantClient({
        url,
        ...(apiKey ? { apiKey } : {})
    });

    return qdrantInstance;
}
