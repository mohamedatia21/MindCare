import { UnifiedInput } from './input/unified-input.js';
export type SafetyState = 'SAFE' | 'ELEVATED' | 'CRISIS';

export type RuntimeState = 
  | 'NORMAL' 
  | 'SAFETY_REVIEW' 
  | 'SUPPORT' 
  | 'EXERCISE' 
  | 'PROGRESS' 
  | 'ELEVATED' 
  | 'CRISIS_PROTOCOL';

export type ClinicalMode = 'therapy-mode' | 'psychagent' | 'cognitive-toolkit' | 'unclear';

export type MemoryClass = 
  | 'EPHEMERAL' 
  | 'SESSION' 
  | 'USER-PREFERENCE' 
  | 'PROGRESS' 
  | 'SENSITIVE' 
  | 'CRISIS';

export interface UserInput {
  sessionId: string;
  userId: string;
  content: string;
  timestamp: Date;
  metadata?: UnifiedInput['metadata'];
}

export * from './input/unified-input.js';
