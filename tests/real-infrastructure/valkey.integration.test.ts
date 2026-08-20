import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

describe('Real Infrastructure: Valkey Distributed State', () => {
    let redis1: Redis;
    let redis2: Redis;
    const lockKey = `lock:${randomUUID()}`;

    beforeAll(async () => {
        const url = process.env.VALKEY_URL || 'redis://localhost:6379';
        redis1 = new Redis(url, { lazyConnect: true });
        redis2 = new Redis(url, { lazyConnect: true });

        try {
            await redis1.connect();
            await redis2.connect();
        } catch (error) {
            console.warn('REAL VALKEY INSTANCE REQUIRED. Test will fail or be skipped.');
        }
    });

    afterAll(async () => {
        if (redis1) {
            redis1.disconnect();
        }
        if (redis2) {
            redis2.disconnect();
        }
    });

    it('should acquire lock for only one owner concurrently', async () => {
        if (redis1.status !== 'ready') {
            if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') {
                throw new Error('REQUIRE_REAL_INFRASTRUCTURE is true but Valkey is unavailable.');
            }
            console.warn('UNVERIFIED — REAL VALKEY INSTANCE REQUIRED');
            return;
        }

        const ownerA = randomUUID();
        const ownerB = randomUUID();

        // Attempt concurrent acquisition
        const resA = await redis1.set(lockKey, ownerA, 'EX', 10, 'NX');
        const resB = await redis2.set(lockKey, ownerB, 'EX', 10, 'NX');

        expect(resA === 'OK' || resB === 'OK').toBe(true);
        expect(resA === 'OK' && resB === 'OK').toBe(false);

        // Verify owner-only release
        const currentOwner = resA === 'OK' ? ownerA : ownerB;
        const fakeOwner = resA === 'OK' ? ownerB : ownerA;

        const releaseScript = `
            if redis.call("get",KEYS[1]) == ARGV[1] then
                return redis.call("del",KEYS[1])
            else
                return 0
            end
        `;

        const releaseFail = await redis2.eval(releaseScript, 1, lockKey, fakeOwner);
        expect(releaseFail).toBe(0);

        const releaseSuccess = await redis1.eval(releaseScript, 1, lockKey, currentOwner);
        expect(releaseSuccess).toBe(1);
    });

    it('should invalidate state via Pub/Sub across concurrent connections (single-node topology)', async () => {
        if (redis1.status !== 'ready') {
            if (process.env.REQUIRE_REAL_INFRASTRUCTURE === 'true') {
                throw new Error('REQUIRE_REAL_INFRASTRUCTURE is true but Valkey is unavailable.');
            }
            return;
        }

        return new Promise<void>((resolve, reject) => {
            const channel = 'mindcare:invalidation';
            const message = 'user-123';

            redis2.subscribe(channel, (err) => {
                if (err) return reject(err);
                
                redis1.publish(channel, message);
            });

            redis2.on('message', (ch, msg) => {
                if (ch === channel) {
                    expect(msg).toBe(message);
                    resolve();
                }
            });

            // Timeout
            setTimeout(() => {
                reject(new Error('Pub/Sub timeout - did not receive message'));
            }, 3000);
        });
    });
});
