import { SafetyState } from '../core/types.js';

export type SignalCategory = 
  | 'direct_self_harm' 
  | 'suicide_related' 
  | 'immediate_danger' 
  | 'severe_distress' 
  | 'harm_to_others' 
  | 'inability_to_stay_safe' 
  | 'emergency_seeking' 
  | 'ambiguous_distress'
  | 'prompt_injection'
  | 'none';

export type SeverityHint = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';

export interface SafetySignals {
  categories: SignalCategory[];
  matchedRules: string[]; // Rule IDs, not raw text
  severityHint: SeverityHint;
  requiresFurtherAssessment: boolean;
}

export interface SafetyClassification {
  state: SafetyState;
  confidence: number;
  signalCategories: SignalCategory[];
  requiresEscalation: boolean;
}

export type ContextReliability = 'USER_REPORTED' | 'FACT' | 'INFERENCE' | 'UNCERTAIN';

export interface AssessmentContext {
  priorRiskLevel?: SafetyState;
  recentExplicitSignals?: SignalCategory[];
  reliability: ContextReliability;
  stale: boolean;
}

export interface CrisisResource {
  country: string;
  region?: string;
  resourceType: string;
  displayName: string;
  contactMethod: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'EXPIRED' | 'UNAVAILABLE';
  sourceUrl?: string;
  verificationOwner?: string;
  nextReviewAt?: Date;
  lastVerifiedAt: Date;
  source: string;
  availability: string;
}

export interface SafetyAssessment {
  state: SafetyState;
  confidence: number;
  reasonCode: string;
  requiresEscalation: boolean;
}
