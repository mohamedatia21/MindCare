import crypto from 'crypto';
import { CstKeyStore } from './cst-key-store.js';
import { DistributedInvalidationBus, InvalidationEvent } from './distributed-invalidation-bus.js';
import { KmsProvider, StandardKmsProvider } from './kms-provider.js';

export interface EncryptedPayload {
  iv: string; // Base64 96-bit random IV
  ciphertext: string; // Base64 ciphertext
  authTag: string; // Base64 128-bit authentication tag
  keyVersion: string; // KMS Key Version identifier
}

export interface AADContext {
  userId: string;
  memoryId: string;
  memoryClass: string;
}

export interface StateCoordinator {
  isUserActiveAndConsented(userId: string): Promise<boolean>;
}

export class DefaultStateCoordinator implements StateCoordinator {
  private activeUsers = new Set<string>();

  setUserActive(userId: string, active: boolean) {
    if (active) this.activeUsers.add(userId);
    else this.activeUsers.delete(userId);
  }

  async isUserActiveAndConsented(userId: string): Promise<boolean> {
    return this.activeUsers.has(userId);
  }
}

export class EnvelopeCrypto {
  private keyCache: Map<string, { dek: Buffer; expiresAt: number }> = new Map();
  private kmsProvider: KmsProvider;

  constructor(
    private cstStore: CstKeyStore,
    private stateCoordinator: StateCoordinator,
    private invalidationBus?: DistributedInvalidationBus,
    kmsProvider?: KmsProvider
  ) {
    this.kmsProvider = kmsProvider || new StandardKmsProvider();

    if (this.invalidationBus) {
      this.invalidationBus.subscribe((event: InvalidationEvent) => {
        if (event.action === 'EVICT_USER_KEYS') {
          this.evictAndZeroize(event.userId);
        }
      });
    }
  }

  public getKmsProvider(): KmsProvider {
    return this.kmsProvider;
  }

  public evictAndZeroize(userId: string): void {
    const cached = this.keyCache.get(userId);
    if (cached) {
      cached.dek.fill(0);
      this.keyCache.delete(userId);
    }
  }

  public getCachedKey(userId: string): Buffer | null {
    const cached = this.keyCache.get(userId);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.evictAndZeroize(userId);
      return null;
    }
    return cached.dek;
  }

  /**
   * Derives the effective 256-bit encryption key on-the-fly by combining:
   * 1. KMS Context-Derived Key: KMS.deriveKey({ userId, tenantId, purpose })
   * 2. User Cryptographic Shredding Token (CST) from CstKeyStore
   * Output is derived via HKDF-SHA256 and NEVER stored with ciphertext on disk.
   */
  private async deriveEffectiveKey(userId: string, tenantId: string = 'default'): Promise<{ effectiveKey: Buffer; keyVersion: string }> {
    const cached = this.getCachedKey(userId);
    if (cached) {
      return { effectiveKey: cached, keyVersion: this.kmsProvider.getCurrentKeyVersion() };
    }

    const cst = await this.cstStore.getCst(userId) || await this.cstStore.getOrCreateCst(userId);
    if (!cst) {
      throw new Error(`CSTNotFoundError: CST not found or shredded for user ${userId}`);
    }

    const kmsResult = await this.kmsProvider.deriveKey({
      userId,
      tenantId,
      purpose: 'clinical-memory-v1'
    });

    const effectiveKeyRaw = crypto.hkdfSync(
      'sha256',
      kmsResult.key,
      cst,
      Buffer.from(`MindCare-Clinical-${userId}`),
      32
    );

    const keyBuffer = Buffer.from(effectiveKeyRaw);

    // Ephemeral in-memory caching with 60-second TTL (voice latency optimization)
    this.keyCache.set(userId, {
      dek: keyBuffer,
      expiresAt: Date.now() + 60 * 1000
    });

    return { effectiveKey: keyBuffer, keyVersion: kmsResult.keyVersion };
  }

  /**
   * Encrypts plaintext using AES-256-GCM, random 96-bit IV, and mandatory AAD binding.
   * STRICT SECURITY INVARIANT: Zero key material is stored in the resulting EncryptedPayload.
   */
  async encrypt(plaintext: string, aad: AADContext, tenantId: string = 'default'): Promise<EncryptedPayload> {
    const { effectiveKey, keyVersion } = await this.deriveEffectiveKey(aad.userId, tenantId);

    const iv = crypto.randomBytes(12); // Pure random 96-bit IV (Zero deterministic GCM)
    const cipher = crypto.createCipheriv('aes-256-gcm', effectiveKey, iv);

    const aadBuffer = Buffer.from(JSON.stringify(aad));
    cipher.setAAD(aadBuffer);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion
    };
  }

  /**
   * Decrypts ciphertext on-the-fly using AES-256-GCM with Active Decryption Guard.
   */
  async decrypt(payload: EncryptedPayload, aad: AADContext, tenantId: string = 'default'): Promise<string> {
    // 1. ACTIVE DECRYPTION GUARD (Zero-Trust Latency Check)
    const isActive = await this.stateCoordinator.isUserActiveAndConsented(aad.userId);
    if (!isActive) {
      this.evictAndZeroize(aad.userId);
      throw new Error(`ActiveDecryptionGuard: User ${aad.userId} is shredded, revoked, or inactive (Fail-Closed)`);
    }

    const { effectiveKey } = await this.deriveEffectiveKey(aad.userId, tenantId);

    const iv = Buffer.from(payload.iv, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', effectiveKey, iv);

    const aadBuffer = Buffer.from(JSON.stringify(aad));
    decipher.setAAD(aadBuffer);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err: any) {
      throw new Error(`AuthenticationFailure: Ciphertext or AAD tampered or incorrect key: ${err.message}`);
    }
  }
}
