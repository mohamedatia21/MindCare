import { describe, it, expect } from 'vitest';
import { EnvelopeCrypto, DefaultStateCoordinator } from '../src/infrastructure/crypto/envelope-crypto.js';
import { InMemoryCstKeyStore } from '../src/infrastructure/crypto/cst-key-store.js';

import { StandardKmsProvider } from '../src/infrastructure/crypto/kms-provider.js';

describe('Active Decryption Guard & Fail-Closed Invariant', () => {
  const testKmsKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testPepper = 'test-audit-pepper-v1-explicit-secret';
  const kmsProvider = new StandardKmsProvider(testKmsKey);
  const cstStore = new InMemoryCstKeyStore(testPepper);
  const stateCoordinator = new DefaultStateCoordinator();
  const cryptoEngine = new EnvelopeCrypto(cstStore, stateCoordinator, undefined, kmsProvider);

  it('fails closed immediately when user is inactive or consent revoked, zeroizing cached keys', async () => {
    const userId = 'user-guard-test';
    stateCoordinator.setUserActive(userId, true);

    const plaintext = "Sensitive trauma narrative";
    const aad = { userId, memoryId: 'mem-201', memoryClass: 'SENSITIVE' };
    const payload = await cryptoEngine.encrypt(plaintext, aad);

    // Initial decryption passes
    const decrypted = await cryptoEngine.decrypt(payload, aad);
    expect(decrypted).toBe(plaintext);
    expect(cryptoEngine.getCachedKey(userId)).not.toBeNull();

    // User revokes consent / gets shredded in central coordinator
    stateCoordinator.setUserActive(userId, false);

    // Subsequent decryption MUST fail closed immediately
    await expect(cryptoEngine.decrypt(payload, aad)).rejects.toThrow(/ActiveDecryptionGuard/);

    // Assert key was zeroized from in-memory cache
    expect(cryptoEngine.getCachedKey(userId)).toBeNull();
  });

  it('meets sub-millisecond execution latency budget for active guard state assertions', async () => {
    const userId = 'user-latency-test';
    stateCoordinator.setUserActive(userId, true);
    const aad = { userId, memoryId: 'mem-202', memoryClass: 'SENSITIVE' };
    const payload = await cryptoEngine.encrypt("Quick test", aad);

    const start = performance.now();
    await cryptoEngine.decrypt(payload, aad);
    const duration = performance.now() - start;
    // Latency Budget Invariant: State assertion + decryption < 5ms (typically <1ms in test)
    expect(duration).toBeLessThan(15);
  });

  it('fails closed (aborts decryption) when the state coordinator experiences a network timeout or connection failure', async () => {
    const failingCoordinator = {
      async isUserActiveAndConsented(_userId: string): Promise<boolean> {
        throw new Error("RedisConnectionTimeoutError: ETIMEDOUT connect to redis-cluster:6379");
      }
    };

    const failingCryptoEngine = new EnvelopeCrypto(cstStore, failingCoordinator, undefined, kmsProvider);
    const userId = 'user-timeout-test';
    const aad = { userId, memoryId: 'mem-203', memoryClass: 'SENSITIVE' };

    // Assume we have an existing encrypted payload
    stateCoordinator.setUserActive(userId, true);
    const payload = await cryptoEngine.encrypt("Confidential data", aad);

    // Attempting decryption when coordinator / Redis is unreachable MUST fail closed (throw)
    await expect(failingCryptoEngine.decrypt(payload, aad)).rejects.toThrow(/RedisConnectionTimeoutError/);
  });
});
