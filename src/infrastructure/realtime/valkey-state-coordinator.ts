import Redis from 'ioredis';
import crypto from 'crypto';
import { StateCoordinator } from '../../infrastructure/crypto/envelope-crypto.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { MemoryRepository } from '../../memory/repository.js';

export class ValkeyStateCoordinator implements StateCoordinator {
    private logger = new RuntimeLogger();

    constructor(
        private redis: Redis,
        private dbRepository: MemoryRepository // Needed for fallback
    ) {}

    /**
     * Active Guard check using Valkey with Fail-Closed behavior.
     */
    async isUserActiveAndConsented(userId: string): Promise<boolean> {
        let valkeyStatus: string | null = null;
        let attempts = 0;
        let success = false;

        while (attempts < 3 && !success) {
            try {
                // 1. Check Valkey
                // Throws immediately if connection is down/timeout
                valkeyStatus = await this.redis.get(`active_user:${userId}`);
                success = true;
            } catch (err: any) {
                attempts++;
                if (attempts >= 3) {
                    // 2. Valkey Connection Error / Timeout -> Immediate Fail-Closed
                    this.logger.error(`Valkey connection failed during ActiveGuard check for ${userId}: ${err.message}`, { requestId: 'guard', timestamp: new Date() });
                    return false; // NO database fallback. Security critical.
                }
                const backoff = Math.pow(2, attempts) * 50 + Math.random() * 50;
                await new Promise(r => setTimeout(r, backoff));
            }
        }

        // 1. Valkey is UP, but key is missing (True Cache Miss)
        if (valkeyStatus === null) {
            if (process.env.ENABLE_LEGACY_CUTOVER_FALLBACK === 'true') {
                // Transient Cutover Logic (Temporary Feature Flag)
                // We check if the user has active consent in the DB.
                // In MindCare, active means having active consent (we can just check DB).
                try {
                    // Quick DB check to see if we have ANY non-revoked memories or consent.
                    // This is a proxy for "is active" in this demo implementation since we don't have a Users table.
                    const memories = await this.dbRepository.findMany(userId);
                    const isActive = memories.some(m => m.consentState === 'GRANTED');
                    
                    if (isActive) {
                        // Lazy load into Valkey
                        await this.redis.set(`active_user:${userId}`, 'ACTIVE', 'EX', 3600);
                        return true;
                    }
                    return false;
                } catch (dbErr) {
                    return false;
                }
            } else {
                // Cutover complete. Valkey is the sole source of truth.
                return false;
            }
        }

        return valkeyStatus === 'ACTIVE';
    }

    /**
     * Executes a critical operation protected by a distributed lock.
     */
    async withLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
        const lockId = crypto.randomUUID();
        const lockKey = `lock:guard:${userId}`;
        
        const acquired = await this.redis.set(lockKey, lockId, 'PX', 10000, 'NX');
        if (!acquired) {
            throw new Error(`Lock acquisition failed for ${userId}: Concurrent operation in progress`);
        }

        try {
            return await operation();
        } finally {
            // Atomic Release via Lua Script
            const luaScript = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end`;
            await this.redis.eval(luaScript, 1, lockKey, lockId);
        }
    }

    async setUserActive(userId: string, active: boolean) {
        if (active) {
            await this.redis.set(`active_user:${userId}`, 'ACTIVE', 'EX', 3600);
        } else {
            await this.redis.del(`active_user:${userId}`);
        }
    }
}
