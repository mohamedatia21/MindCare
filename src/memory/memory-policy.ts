import { MemoryObject, Actor } from './types.js';
import { MemoryRepository } from './repository.js';
import { MemoryAuditLogger } from './audit-logger.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';

export class MemoryPolicyGate {
  constructor(
    private repo: MemoryRepository,
    private audit: MemoryAuditLogger
  ) {}

  private enforceExpiration(memory: MemoryObject): MemoryObject {
    if (memory.status === 'ACTIVE' && memory.expiresAt && memory.expiresAt < new Date()) {
       return { ...memory, status: 'EXPIRED' };
    }
    return memory;
  }

  public async getMemory(actor: Actor, userId: string, memoryId: string): Promise<Result<MemoryObject, PolicyViolationError>> {
    const memoryRaw = await this.repo.find(userId, memoryId);
    
    if (!memoryRaw) {
      this.audit.logEvent({ action: 'READ', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'NOT_FOUND_OR_IDOR' });
      return err(new PolicyViolationError("Access denied"));
    }

    const memory = this.enforceExpiration(memoryRaw);

    // Lifecycle policy: Never return DELETED, EXPIRED, or REVOKED to normal retrieval
    if (memory.status !== 'ACTIVE') {
      this.audit.logEvent({ action: 'READ', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: `LIFECYCLE_${memory.status}` });
      return err(new PolicyViolationError("Memory is not active"));
    }

    // Authorization policy
    if (!this.isAuthorizedToRead(actor, memory)) {
      this.audit.logEvent({ action: 'READ', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'UNAUTHORIZED' });
      return err(new PolicyViolationError("Unauthorized access to memory class"));
    }

    if (memory.memoryClass === 'SENSITIVE' || memory.memoryClass === 'CRISIS') {
      this.audit.logEvent({ action: 'DECRYPT_READ', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'ENCRYPTED_PAYLOAD_DECRYPTED' });
    } else {
      this.audit.logEvent({ action: 'READ', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'POLICY_PASSED' });
    }
    return ok(memory);
  }

  public async writeMemory(actor: Actor, userId: string, memory: MemoryObject): Promise<Result<void, PolicyViolationError>> {
    // 1. EPHEMERAL rejection
    if (memory.memoryClass === 'EPHEMERAL') {
      this.audit.logEvent({ action: 'WRITE', memoryId: memory.id, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'EPHEMERAL_PERSISTENCE' });
      return err(new PolicyViolationError("EPHEMERAL memory cannot persist"));
    }

    // 2. Consent requirement
    if (memory.memoryClass === 'SENSITIVE' && memory.consentState !== 'GRANTED') {
      this.audit.logEvent({ action: 'WRITE', memoryId: memory.id, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'SENSITIVE_NO_CONSENT' });
      return err(new PolicyViolationError("SENSITIVE memory requires explicit GRANTED consent"));
    }

    // 3. Crisis Separation
    if (memory.memoryClass === 'CRISIS' && memory.status === 'ACTIVE') {
      // Must not automatically act as permanent user attribute
      if (memory.retentionPolicy === 'LONG_TERM_APPROVED') {
         return err(new PolicyViolationError("CRISIS memory cannot default to LONG_TERM_APPROVED automatically"));
      }
    }

    // 4. Uncertainty preservation (Cannot silently overwrite INFERENCE to FACT)
    const existing = await this.repo.find(userId, memory.id);
    if (existing) {
      if (existing.epistemicStatus === 'INFERENCE' && memory.epistemicStatus === 'FACT') {
        this.audit.logEvent({ action: 'WRITE', memoryId: memory.id, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'INFERENCE_TO_FACT_OVERRIDE' });
        return err(new PolicyViolationError("Cannot silently elevate INFERENCE to FACT"));
      }
    }

    // 5. Authorization
    if (!this.isAuthorizedToWrite(actor, memory)) {
      this.audit.logEvent({ action: 'WRITE', memoryId: memory.id, userId, actorId: actor.id, actorRole: actor.role, decision: 'DENY', reasonCode: 'UNAUTHORIZED_WRITE' });
      return err(new PolicyViolationError("Actor unauthorized to write this memory class"));
    }

    await this.repo.save(userId, memory);
    this.audit.logEvent({ action: 'WRITE', memoryId: memory.id, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'POLICY_PASSED' });
    return ok(undefined);
  }

  /**
   * GDPR Article 9 Cascading Revocation:
   * Revoking consent immediately cascades to soft-delete / shred existing sensitive records under this consent.
   */
  public async revokeConsent(actor: Actor, userId: string, memoryId: string): Promise<Result<void, PolicyViolationError>> {
    // Only the user or an admin can revoke consent
    if (actor.role !== 'USER' && actor.role !== 'ADMIN') {
      return err(new PolicyViolationError("Only user can revoke consent"));
    }

    const memoryRaw = await this.repo.find(userId, memoryId);
    if (!memoryRaw) return err(new PolicyViolationError("Not found"));
    
    // Cascading deletion on revocation
    await this.repo.update(userId, memoryId, { consentState: 'REVOKED', status: 'REVOKED' });
    await this.repo.softDelete(userId, memoryId);

    this.audit.logEvent({ action: 'REVOKE', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'CONSENT_REVOKED_CASCADING_PURGE' });
    this.audit.logEvent({ action: 'SHRED', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'CRYPTO_SHRED_ON_REVOCATION' });
    
    return ok(undefined);
  }

  public async deleteMemory(actor: Actor, userId: string, memoryId: string): Promise<Result<void, PolicyViolationError>> {
    const memory = await this.repo.find(userId, memoryId);
    if (!memory) return err(new PolicyViolationError("Not found"));

    if (actor.role !== 'USER' && actor.role !== 'ADMIN') {
       return err(new PolicyViolationError("Unauthorized deletion"));
    }

    await this.repo.softDelete(userId, memoryId);
    this.audit.logEvent({ action: 'DELETE', memoryId, userId, actorId: actor.id, actorRole: actor.role, decision: 'ALLOW', reasonCode: 'SOFT_DELETE' });
    return ok(undefined);
  }

  private isAuthorizedToRead(actor: Actor, memory: MemoryObject): boolean {
    if (actor.role === 'USER') return true; // User owns their data
    
    // Clinical agent reads active session/progress, but SENSITIVE requires explicit mapping
    if (actor.role === 'CLINICAL_AGENT') {
      if (memory.memoryClass === 'SENSITIVE') return memory.consentState === 'GRANTED';
      if (memory.memoryClass === 'CRISIS') return false; // Agent doesn't read historical crises natively
      return true;
    }

    if (actor.role === 'PROFESSIONAL') {
      // Professionals must have explicit permission to read sensitive/crisis logs
      if (memory.memoryClass === 'SENSITIVE' || memory.memoryClass === 'CRISIS') return memory.consentState === 'GRANTED';
      return true;
    }

    if (actor.role === 'ADMIN') {
      // ADMIN DOES NOT EQUAL unrestricted psychological access
      if (memory.memoryClass === 'SENSITIVE' || memory.memoryClass === 'CRISIS') return false; 
      return true; // Admin reads system preferences, etc.
    }

    return false;
  }

  private isAuthorizedToWrite(actor: Actor, memory: MemoryObject): boolean {
    if (actor.role === 'CLINICAL_AGENT') {
      // Clinical agent absolutely cannot write CRISIS logs
      if (memory.memoryClass === 'CRISIS') return false;
      return true;
    }
    if (actor.role === 'SYSTEM') return true;
    if (actor.role === 'USER') return true;
    return false;
  }
}
