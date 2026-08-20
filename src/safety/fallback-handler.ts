import { SafetyAssessment } from './types.js';

export class ConservativeFallback {
  // Fails safe whenever uncertainty or systemic errors occur without locking down the conversation
  public failSafe(reasonCode: string): SafetyAssessment {
    return {
      state: 'SAFE',
      confidence: 0.8,
      reasonCode: `L4_FAILSAFE_${reasonCode}`,
      requiresEscalation: false
    };
  }
}

