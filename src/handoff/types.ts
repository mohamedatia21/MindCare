import { SafetyState } from '../core/types.js';

export type HandoffType = 'EMERGENCY_SAFETY_ESCALATION' | 'USER_REQUESTED_CONSULTATION' | 'RECOMMENDED_SUPPORT';
export type ConsentState = 'PENDING' | 'GRANTED' | 'DENIED' | 'REVOKED';

export type HandoffState = 
  | 'NOT_REQUESTED'
  | 'RECOMMENDED'
  | 'USER_REQUESTED'
  | 'CONSENT_PENDING'
  | 'CONSENT_GRANTED'
  | 'PACKAGE_CREATED'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'CONSENT_DENIED'
  | 'CONSENT_REVOKED'
  | 'TRANSFER_FAILED'
  | 'EXPIRED'
  | 'EMERGENCY_HANDOFF';

export interface HandoffPackage {
  handoffId: string;
  userId: string;
  type: HandoffType;
  state: HandoffState;
  consentState: ConsentState;
  minimizedContext: { statement: string; epistemicStatus: string }[];
  safetyState: SafetyState;
  createdAt: Date;
  expiresAt: Date;
  assignedProfessionalId?: string;
}
