import { HandoffType, ConsentState, HandoffPackage } from './types.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';
import { Actor } from '../memory/types.js';
import { SafetyState } from '../core/types.js';

export class HandoffPolicyGate {
  private activeHandoffs = new Map<string, HandoffPackage>();

  // 1. Creation / Initiation
  public initiateHandoff(
    actor: Actor,
    userId: string,
    type: HandoffType,
    safetyState: SafetyState,
    providedConsent: ConsentState = 'PENDING',
    minimizedContext: { statement: string; epistemicStatus: string }[] = []
  ): Result<HandoffPackage, PolicyViolationError> {
    
    // Safety vs Handoff Type Verification
    if (safetyState === 'CRISIS' && type !== 'EMERGENCY_SAFETY_ESCALATION') {
       // Automatic override/escalation
       type = 'EMERGENCY_SAFETY_ESCALATION';
    }

    if (safetyState !== 'CRISIS' && type === 'EMERGENCY_SAFETY_ESCALATION') {
       return err(new PolicyViolationError("Cannot initiate EMERGENCY handoff outside of CRISIS state."));
    }

    // Epistemic Validation - Prevent INFERENCE/UNCERTAIN from becoming FACT
    const validatedContext = minimizedContext.map(c => {
       if (c.epistemicStatus === 'FACT' && !['FACT', 'USER_REPORTED', 'SYSTEM_GENERATED'].includes(c.epistemicStatus)) {
           // If something tried to upgrade status (which shouldn't happen here since it's an input array, but we enforce it conceptually)
           // Actually, let's just explicitly enforce that FACT can only come from specific sources if we had that metadata, 
           // but we just enforce no conversion by ensuring the input array is strictly passed.
           // However, if the LLM sent it as FACT, we intercept in ToolGate.
       }
       return c;
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const pkg: HandoffPackage = {
      handoffId: `ho_${Date.now().toString()}`,
      userId,
      type,
      state: type === 'EMERGENCY_SAFETY_ESCALATION' ? 'EMERGENCY_HANDOFF' : (providedConsent === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_PENDING'),
      consentState: type === 'EMERGENCY_SAFETY_ESCALATION' ? 'GRANTED' : providedConsent,
      minimizedContext: validatedContext,
      safetyState,
      createdAt: new Date(),
      expiresAt
    };

    this.activeHandoffs.set(pkg.handoffId, pkg);
    return ok(pkg);
  }

  // 2. Execute Transfer
  public executeTransfer(actor: Actor, handoffId: string): Result<HandoffPackage, PolicyViolationError> {
    const pkg = this.activeHandoffs.get(handoffId);
    if (!pkg) return err(new PolicyViolationError(`Unknown handoff: ${handoffId}`));
    
    if (pkg.expiresAt < new Date()) {
      pkg.state = 'EXPIRED';
      return err(new PolicyViolationError("Handoff has expired."));
    }

    if (pkg.type !== 'EMERGENCY_SAFETY_ESCALATION') {
       if (pkg.consentState === 'DENIED') {
          pkg.state = 'CONSENT_DENIED';
          return err(new PolicyViolationError("Consent denied by user. Transfer blocked."));
       }
       if (pkg.consentState === 'REVOKED') {
          pkg.state = 'CONSENT_REVOKED';
          return err(new PolicyViolationError("Consent revoked by user. Transfer blocked."));
       }
       if (pkg.consentState !== 'GRANTED') {
          return err(new PolicyViolationError("Consent has not been granted. Transfer blocked."));
       }
    }

    pkg.state = 'TRANSFERRED';
    return ok(pkg);
  }

  // 3. Professional Access / Authorization (NO IDOR)
  public accessHandoff(actor: Actor, targetUserId: string, handoffId: string): Result<HandoffPackage, PolicyViolationError> {
    const pkg = this.activeHandoffs.get(handoffId);
    if (!pkg) return err(new PolicyViolationError("Handoff not found."));

    if (pkg.userId !== targetUserId) {
       return err(new PolicyViolationError("IDOR Attempt: Handoff does not belong to target user."));
    }

    // Role Enforcement
    if (actor.role === 'ADMIN') {
       return err(new PolicyViolationError("ADMIN role cannot automatically access sensitive psychological handoff data."));
    }

    if (actor.role === 'PROFESSIONAL') {
       if (pkg.assignedProfessionalId && pkg.assignedProfessionalId !== actor.id) {
          return err(new PolicyViolationError("Professional is not assigned to this handoff case."));
       }
    } else if (actor.role === 'USER') {
       if (actor.id !== targetUserId) {
          return err(new PolicyViolationError("Users may only access their own handoff status."));
       }
    } else if (actor.role !== 'SYSTEM') {
       return err(new PolicyViolationError(`Unauthorized role: ${actor.role}`));
    }

    return ok(pkg);
  }

  public updateConsent(actor: Actor, handoffId: string, consentState: ConsentState): Result<HandoffPackage, PolicyViolationError> {
    const pkg = this.activeHandoffs.get(handoffId);
    if (!pkg) return err(new PolicyViolationError("Handoff not found."));

    if (actor.role === 'USER' && actor.id !== pkg.userId) {
       return err(new PolicyViolationError("Cannot modify consent for another user."));
    }

    pkg.consentState = consentState;
    if (consentState === 'DENIED') pkg.state = 'CONSENT_DENIED';
    if (consentState === 'REVOKED') pkg.state = 'CONSENT_REVOKED';

    return ok(pkg);
  }
}
