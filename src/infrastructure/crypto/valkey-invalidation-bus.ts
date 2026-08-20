import Redis from 'ioredis';
import { DistributedInvalidationBus, InvalidationEvent } from './distributed-invalidation-bus.js';

const CHANNEL = 'mindcare:invalidation';

/**
 * Valkey (Redis) Pub/Sub implementation of the DistributedInvalidationBus.
 * Replaces InMemoryInvalidationBus for multi-pod horizontal scaling.
 */
export class ValkeyInvalidationBus implements DistributedInvalidationBus {
    private publisher: Redis;
    private subscriber: Redis;

    constructor(redisUrl: string = process.env.VALKEY_URL || process.env.REDIS_URL || 'redis://localhost:6379') {
        this.publisher = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);
    }

    async publish(event: InvalidationEvent): Promise<void> {
        await this.publisher.publish(CHANNEL, JSON.stringify(event));
    }

    subscribe(handler: (event: InvalidationEvent) => void): void {
        this.subscriber.subscribe(CHANNEL).catch((err) => {
            console.error('ValkeyInvalidationBus: Failed to subscribe', err);
        });
        this.subscriber.on('message', (_channel: string, message: string) => {
            try {
                const event = JSON.parse(message) as InvalidationEvent;
                handler(event);
            } catch {
                // Ignore malformed messages
            }
        });
    }

    async close(): Promise<void> {
        await this.subscriber.unsubscribe(CHANNEL);
        this.subscriber.disconnect();
        this.publisher.disconnect();
    }
}
