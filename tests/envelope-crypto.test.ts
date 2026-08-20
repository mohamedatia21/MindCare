import { describe, it, expect } from 'vitest';
import { EnvelopeCrypto, DefaultStateCoordinator } from '../src/infrastructure/crypto/envelope-crypto.js';
import { InMemoryCstKeyStore } from '../src/infrastructure/crypto/cst-key-store.js';
import { StandardKmsProvider } from '../src/infrastructure/crypto/kms-provider.js';
import crypto from 'crypto';

describe('EnvelopeCrypto Architecture & Critical Security Invariants', () => {
  const testKmsKey = crypto.randomBytes(32).toString('hex');
  const testPepper = 'test-suite-secure-audit-pepper-v1-key-32bytes';

  const kmsProvider = new StandardKmsProvider(testKmsKey);
  const cstStore = new InMemoryCstKeyStore(testPepper);
  const stateCoordinator = new DefaultStateCoordinator();
  const cryptoEngine = new EnvelopeCrypto(cstStore, stateCoordinator, undefined, kmsProvider);

  it('CRITICAL: EncryptedPayload contains ZERO key material and cannot be decrypted without KMS + CST', async () => {
    stateCoordinator.setUserActive('user-zero-key-test', true);
    const plaintext = "Highly sensitive psychological trauma disclosure";
    const aad = { userId: 'user-zero-key-test', memoryId: 'mem-zero-1', memoryClass: 'SENSITIVE' };

    const payload = await cryptoEngine.encrypt(plaintext, aad);

    // Assert payload fields strictly contain only ciphertext, IV, authTag, and version
    const payloadKeys = Object.keys(payload);
    expect(payloadKeys).toEqual(['iv', 'ciphertext', 'authTag', 'keyVersion']);
    expect((payload as any).wrappedDek).toBeUndefined();
    expect((payload as any).effectiveKey).toBeUndefined();
    expect((payload as any).key).toBeUndefined();

    // Verify that an attacker with ONLY the payload cannot reconstruct the plaintext without CST
    const attackerCstStore = new InMemoryCstKeyStore(testPepper); // Empty CST store
    const attackerEngine = new EnvelopeCrypto(attackerCstStore, stateCoordinator, undefined, kmsProvider);
    
    // Attacker without Alice's CST cannot decrypt
    await expect(attackerEngine.decrypt(payload, aad)).rejects.toThrow();
  });

  it('generates distinct IVs and non-deterministic ciphertexts for identical plaintext', async () => {
    stateCoordinator.setUserActive('user-1', true);
    const plaintext = "Patient suffers from deep abandonment fear.";
    const aad = { userId: 'user-1', memoryId: 'mem-101', memoryClass: 'SENSITIVE' };

    const payload1 = await cryptoEngine.encrypt(plaintext, aad);
    const payload2 = await cryptoEngine.encrypt(plaintext, aad);

    // Cryptographic Invariant: Zero Deterministic GCM
    expect(payload1.iv).not.toEqual(payload2.iv);
    expect(payload1.ciphertext).not.toEqual(payload2.ciphertext);
    expect(payload1.authTag).not.toEqual(payload2.authTag);

    // Both decrypt back accurately
    const dec1 = await cryptoEngine.decrypt(payload1, aad);
    const dec2 = await cryptoEngine.decrypt(payload2, aad);
    expect(dec1).toEqual(plaintext);
    expect(dec2).toEqual(plaintext);
  });

  it('rejects decryption if AAD is tampered or swapped between patients (Ciphertext Splicing Defense)', async () => {
    stateCoordinator.setUserActive('user-1', true);
    stateCoordinator.setUserActive('user-2', true);

    const plaintext = "Patient 1 private schema note";
    const aadUser1 = { userId: 'user-1', memoryId: 'mem-101', memoryClass: 'SENSITIVE' };
    const payload = await cryptoEngine.encrypt(plaintext, aadUser1);

    // Attempt to decrypt under User 2's AAD context
    const tamperedAad = { userId: 'user-2', memoryId: 'mem-101', memoryClass: 'SENSITIVE' };

    await expect(cryptoEngine.decrypt(payload, tamperedAad)).rejects.toThrow(/AuthenticationFailure/);
  });

  it('rejects decryption if ciphertext or auth tag is corrupted by a single bit', async () => {
    stateCoordinator.setUserActive('user-1', true);
    const plaintext = "Confidential clinical data";
    const aad = { userId: 'user-1', memoryId: 'mem-102', memoryClass: 'SENSITIVE' };
    const payload = await cryptoEngine.encrypt(plaintext, aad);

    // Corrupt ciphertext
    const corruptedCiphertext = Buffer.from(payload.ciphertext, 'base64');
    corruptedCiphertext[0] = (corruptedCiphertext[0] ?? 0) ^ 1; // Flip 1 bit

    const corruptedPayload = {
      ...payload,
      ciphertext: corruptedCiphertext.toString('base64')
    };

    await expect(cryptoEngine.decrypt(corruptedPayload, aad)).rejects.toThrow(/AuthenticationFailure/);
  });

  it('throws a fatal configuration error if mandatory secrets are missing from environment', () => {
    const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;
    const originalPepper = process.env.AUDIT_PURGE_PEPPER;

    delete process.env.ENCRYPTION_MASTER_KEY;
    delete process.env.AUDIT_PURGE_PEPPER;

    expect(() => new StandardKmsProvider()).toThrow(/FATAL_CONFIG_ERROR: ENCRYPTION_MASTER_KEY is mandatory/);
    expect(() => new InMemoryCstKeyStore()).toThrow(/FATAL_CONFIG_ERROR: AUDIT_PURGE_PEPPER is mandatory/);

    if (originalMasterKey) process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
    if (originalPepper) process.env.AUDIT_PURGE_PEPPER = originalPepper;
  });
});
