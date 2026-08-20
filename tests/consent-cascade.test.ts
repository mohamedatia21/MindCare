import { describe, it, expect } from 'vitest';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { InMemoryMemoryRepository } from '../src/memory/repository.js';
import { MemoryAuditLogger } from '../src/memory/audit-logger.js';
import { MemoryObject, Actor } from '../src/memory/types.js';

describe('GDPR Article 9 Cascading Consent Revocation & Audit Trail', () => {
  it('cascades consent revocation to immediately soft-delete and shred sensitive schema memories', async () => {
    const repo = new InMemoryMemoryRepository();
    const audit = new MemoryAuditLogger();
    const policyGate = new MemoryPolicyGate(repo, audit);

    const userActor: Actor = { id: 'patient-bob', role: 'USER' };
    const memoryId = 'mem-bob-abandonment';

    const memory: MemoryObject = {
      id: memoryId,
      userId: 'patient-bob',
      memoryClass: 'SENSITIVE',
      content: 'Abandonment schema identified in early childhood',
      epistemicStatus: 'FACT',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionPolicy: 'LONG_TERM_APPROVED',
      consentState: 'GRANTED',
      source: 'SCHEMA_EXPERT'
    };

    // 1. Write sensitive memory with GRANTED consent
    const writeRes = await policyGate.writeMemory(userActor, 'patient-bob', memory);
    expect(writeRes.ok).toBe(true);

    // 2. Read sensitive memory -> Verifies DECRYPT_READ audit log
    const readRes = await policyGate.getMemory(userActor, 'patient-bob', memoryId);
    expect(readRes.ok).toBe(true);

    const decryptReadLog = audit.getLogs().find(l => l.action === 'DECRYPT_READ');
    expect(decryptReadLog).toBeDefined();
    expect(decryptReadLog?.reasonCode).toBe('ENCRYPTED_PAYLOAD_DECRYPTED');

    // 3. Revoke consent -> Must cascade to soft-delete / shred
    const revokeRes = await policyGate.revokeConsent(userActor, 'patient-bob', memoryId);
    expect(revokeRes.ok).toBe(true);

    // Assert cascading soft-delete happened
    const postRevokeMem = await repo.find('patient-bob', memoryId);
    expect(postRevokeMem?.status).toBe('DELETED');
    expect(postRevokeMem?.consentState).toBe('REVOKED');

    // Assert audit trail captured both REVOKE and SHRED
    const revokeLog = audit.getLogs().find(l => l.action === 'REVOKE');
    const shredLog = audit.getLogs().find(l => l.action === 'SHRED');

    expect(revokeLog).toBeDefined();
    expect(shredLog).toBeDefined();
    expect(shredLog?.reasonCode).toBe('CRYPTO_SHRED_ON_REVOCATION');

    // 4. Future reads are blocked
    const blockedRead = await policyGate.getMemory(userActor, 'patient-bob', memoryId);
    expect(blockedRead.ok).toBe(false);
  });
});
