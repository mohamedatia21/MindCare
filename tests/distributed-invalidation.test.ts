import { describe, it, expect } from 'vitest';
import { EnvelopeCrypto, DefaultStateCoordinator } from '../src/infrastructure/crypto/envelope-crypto.js';
import { InMemoryCstKeyStore } from '../src/infrastructure/crypto/cst-key-store.js';
import { InMemoryInvalidationBus } from '../src/infrastructure/crypto/distributed-invalidation-bus.js';

import { StandardKmsProvider } from '../src/infrastructure/crypto/kms-provider.js';

describe('Multi-Instance Distributed Invalidation Bus Invariant', () => {
  it('broadcasts eviction events across cluster instances and zeroizes in-memory DEK caches', async () => {
    const testKmsKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const testPepper = 'test-audit-pepper-v1-explicit-secret';
    const sharedBus = new InMemoryInvalidationBus();
    const sharedCstStore = new InMemoryCstKeyStore(testPepper);
    const kmsProvider = new StandardKmsProvider(testKmsKey);
    const stateCoordinator = new DefaultStateCoordinator();

    // Node 1 & Node 2 in simulated cluster
    const node1Crypto = new EnvelopeCrypto(sharedCstStore, stateCoordinator, sharedBus, kmsProvider);
    const node2Crypto = new EnvelopeCrypto(sharedCstStore, stateCoordinator, sharedBus, kmsProvider);

    const userId = 'user-cluster-test';
    stateCoordinator.setUserActive(userId, true);

    const aad = { userId, memoryId: 'mem-cluster-1', memoryClass: 'SENSITIVE' };

    // Node 2 performs encryption/decryption -> Caches the key in Node 2's memory
    const payload = await node2Crypto.encrypt("Confidential cluster payload", aad);
    expect(node2Crypto.getCachedKey(userId)).not.toBeNull();

    // Node 1 receives a GDPR purge / revocation request and publishes EVICT_USER_KEYS to cluster
    await sharedBus.publish({
      action: 'EVICT_USER_KEYS',
      userId,
      timestamp: new Date()
    });

    // Assert Node 2 has zeroized and cleared its in-memory cache
    expect(node2Crypto.getCachedKey(userId)).toBeNull();
  });
});
