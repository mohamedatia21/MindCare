export type MemoryClass = 
  | 'EPHEMERAL' 
  | 'SESSION' 
  | 'USER_PREFERENCE' 
  | 'PROGRESS' 
  | 'SENSITIVE' 
  | 'CRISIS';

export type ConsentState = 
  | 'NOT_REQUIRED' 
  | 'PENDING' 
  | 'GRANTED' 
  | 'DENIED' 
  | 'REVOKED';

export type EpistemicStatus = 
  | 'FACT' 
  | 'USER_REPORTED' 
  | 'INFERENCE' 
  | 'UNCERTAIN' 
  | 'SYSTEM_GENERATED';

export type MemoryStatus = 
  | 'ACTIVE' 
  | 'DELETED' 
  | 'EXPIRED' 
  | 'REVOKED';

export type RetentionPolicyType = 
  | 'SESSION_ONLY' 
  | 'SHORT_TERM' 
  | 'LONG_TERM_APPROVED' 
  | 'MANUAL_DELETE';

export type ActorRole = 
  | 'USER' 
  | 'CLINICAL_AGENT' 
  | 'PROFESSIONAL' 
  | 'ADMIN'
  | 'SYSTEM';

export interface Actor {
  id: string;
  role: ActorRole;
}

export interface MemoryObject {
  id: string;
  userId: string;
  memoryClass: MemoryClass;
  content: string; // The data payload
  epistemicStatus: EpistemicStatus;
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
  retentionPolicy: RetentionPolicyType;
  expiresAt?: Date;
  consentState: ConsentState;
  embedding?: number[]; // Vector embedding for pgvector
  source: string;
}

export interface ContextPackage {
  CURRENT_SESSION: MemoryObject[];
  USER_PREFERENCES: MemoryObject[];
  APPROVED_PROGRESS: MemoryObject[];
  RELEVANT_CONTEXT: MemoryObject[];
  SAFETY_CONTEXT: MemoryObject[];
}
