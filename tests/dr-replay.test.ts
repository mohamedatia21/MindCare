import { describe, it, expect } from 'vitest';
import { EnvelopeCrypto, DefaultStateCoordinator } from '../src/infrastructure/crypto/envelope-crypto.js';
import { InMemoryCstKeyStore, PurgeTombstone } from '../src/infrastructure/crypto/cst-key-store.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryObject } from '../src/memory/types.js';

import { StandardKmsProvider } from '../src/infrastructure/crypto/kms-provider.js';

describe('Disaster Recovery Replay & External Immutable Purge Log', () => {
  it('automatically re-shreds restored database records by matching live external audit tombstones', async () => {
    const testKmsKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const testPepper = 'test-audit-pepper-v1-explicit-secret';
    const kmsProvider = new StandardKmsProvider(testKmsKey);
    const cstStore = new InMemoryCstKeyStore(testPepper);
    const stateCoordinator = new DefaultStateCoordinator();
    const cryptoEngine = new EnvelopeCrypto(cstStore, stateCoordinator, undefined, kmsProvider);
    const repo = new InMemoryMemoryRepository();

    const externalLiveAuditLog: PurgeTombstone[] = [];

    // 1. User A creates sensitive memories
    const userA = 'patient-alice';
    stateCoordinator.setUserActive(userA, true);

    const aad = { userId: userA, memoryId: 'mem-alice-1', memoryClass: 'SENSITIVE' };
    const encrypted = await cryptoEngine.encrypt("Alice's deeply private childhood trauma", aad);

    const memoryRecord: MemoryObject = {
      id: 'mem-alice-1',
      userId: userA,
      memoryClass: 'SENSITIVE',
      content: JSON.stringify(encrypted),
      epistemicStatus: 'FACT',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionPolicy: 'LONG_TERM_APPROVED',
      consentState: 'GRANTED',
      source: 'THERAPY_SESSION'
    };

    await repo.save(userA, memoryRecord);

    // 2. Snapshot taken (simulating an immutable cloud backup)
    const backupSnapshot = JSON.parse(JSON.stringify(await repo.findMany(userA)));

    // 3. User A exercises GDPR Right to be Forgotten
    // - CST shredded
    // - Tombstone written to external live audit log
    const tombstone = await cstStore.shredCst(userA);
    externalLiveAuditLog.push(tombstone);
    stateCoordinator.setUserActive(userA, false);
    await repo.purgeAllUserData(userA);

    expect(await repo.find(userA, 'mem-alice-1')).toBeNull();

    // 4. Disaster Recovery scenario: 6 months later, DB is restored from backupSnapshot
    for (const record of backupSnapshot) {
      await repo.save(userA, record);
    }
    expect(await repo.find(userA, 'mem-alice-1')).not.toBeNull();

    // 5. DR Replay Script runs on restored DB
    const restoredUsers = [userA]; // candidate users in restored DB
    for (const candidate of restoredUsers) {
      for (const tomb of externalLiveAuditLog) {
        if (cstStore.matchTombstone(candidate, tomb)) {
          // Re-shred immediately
          await repo.purgeAllUserData(candidate);
          await cstStore.shredCst(candidate);
          stateCoordinator.setUserActive(candidate, false);
        }
      }
    }

    // 6. Assert restored data was re-purged and cannot be read
    expect(await repo.find(userA, 'mem-alice-1')).toBeNull();
    const restoredRecord = backupSnapshot[0];
    const payload = JSON.parse(restoredRecord.content);
    await expect(cryptoEngine.decrypt(payload, aad)).rejects.toThrow();
  });
});
