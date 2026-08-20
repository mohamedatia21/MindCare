import { SafetyClassification, AssessmentContext, SafetyAssessment } from './types.js';

export class ContextAwareAssessor {
  public evaluate(classification: SafetyClassification, context?: AssessmentContext): SafetyAssessment {
    let finalState = classification.state;
    let escalation = classification.requiresEscalation;

    if (context) {
      // Recent explicit signals override stale contextual inferences
      if (context.stale && context.reliability === 'INFERENCE') {
        // Do not upgrade current safe state based on stale inferences
      } else if (context.priorRiskLevel === 'ELEVATED' && classification.state === 'SAFE') {
        // Caution: user was recently elevated, require higher confidence to downgrade
        if (classification.confidence < 0.95) {
          finalState = 'ELEVATED';
          escalation = false;
        }
      }
    }

    return {
      state: finalState,
      confidence: classification.confidence,
      reasonCode: 'L3_CONTEXT_EVALUATED',
      requiresEscalation: escalation
    };
  }
}
