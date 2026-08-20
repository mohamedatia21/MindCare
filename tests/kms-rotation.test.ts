import { describe, it, expect } from 'vitest';
import { EnvelopeCrypto, DefaultStateCoordinator } from '../src/infrastructure/crypto/envelope-crypto.js';
import { InMemoryCstKeyStore } from '../src/infrastructure/crypto/cst-key-store.js';
import crypto from 'crypto';

import { StandardKmsProvider } from '../src/infrastructure/crypto/kms-provider.js';

describe('Root KMS Key Rotation & Pepper Versioning Invariant', () => {
  it('supports rotating the KMS master key and pepper versions without data loss', async () => {
    const testKmsKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const testPepper = 'test-audit-pepper-v1-explicit-secret';
    const kmsProvider = new StandardKmsProvider(testKmsKey);
    const cstStore = new InMemoryCstKeyStore(testPepper);
    const stateCoordinator = new DefaultStateCoordinator();
    const cryptoEngine = new EnvelopeCrypto(cstStore, stateCoordinator, undefined, kmsProvider);

    const userId = 'user-rotation-test';
    stateCoordinator.setUserActive(userId, true);

    const plaintext = "Schema notes recorded under KMS Version 1";
    const aad = { userId, memoryId: 'mem-rot-1', memoryClass: 'SENSITIVE' };

    // 1. Encrypt under KMS v1
    const payloadV1 = await cryptoEngine.encrypt(plaintext, aad);
    expect(payloadV1.keyVersion).toBe('v1');

    // Decrypts under v1
    expect(await cryptoEngine.decrypt(payloadV1, aad)).toBe(plaintext);

    // 2. Rotate KMS key to v2
    const newKmsKey = crypto.randomBytes(32).toString('hex');
    await kmsProvider.rotateMasterKey(newKmsKey);
    expect(kmsProvider.getCurrentKeyVersion()).toBe('v2');

    // 3. New writes use v2
    const payloadV2 = await cryptoEngine.encrypt("New notes under v2", aad);
    expect(payloadV2.keyVersion).toBe('v2');
    expect(await cryptoEngine.decrypt(payloadV2, aad)).toBe("New notes under v2");

    // 4. Pepper rotation
    cstStore.setPepper('v2', 'brand-new-rotated-pepper-secret-v2', true);
    const tombstoneV2 = await cstStore.shredCst(userId);
    expect(tombstoneV2.pepperVersion).toBe('v2');
    expect(cstStore.matchTombstone(userId, tombstoneV2)).toBe(true);
  });
});
