import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { SafetyAssessment, AssessmentContext } from './types.js';
import { DeterministicDetector } from './deterministic-detector.js';
import { StructuredSafetyClassifier } from './classifier-interface.js';
import { ContextAwareAssessor } from './context-assessment.js';
import { ConservativeFallback } from './fallback-handler.js';

export interface SafetyPipelineInterface {
  evaluate(input: UnifiedInput, context?: AssessmentContext): Promise<Result<SafetyAssessment, SafetyError>>;
}

export class ProductionSafetyPipeline implements SafetyPipelineInterface {
  constructor(
    private l1Detector: DeterministicDetector,
    private l2Classifier: StructuredSafetyClassifier,
    private l3Context: ContextAwareAssessor,
    private l4Fallback: ConservativeFallback
  ) {}

  async evaluate(input: UnifiedInput, context?: AssessmentContext): Promise<Result<SafetyAssessment, SafetyError>> {
    try {
      // LAYER 1: Deterministic Detection
      const l1Signals = this.l1Detector.scan(input);
      if (l1Signals.severityHint === 'CRITICAL') {
        return ok({
          state: 'CRISIS',
          confidence: 1.0,
          reasonCode: 'L1_CRITICAL_MATCH',
          requiresEscalation: true
        });
      }

      // LAYER 2: Structured Classifier
      const l2Result = await this.l2Classifier.classify(input, l1Signals);
      if (!l2Result.ok) {
        // Malformed output, timeout, or model failure -> Fail Safe
        return ok(this.l4Fallback.failSafe('L2_CLASSIFIER_FAILED'));
      }

      // LAYER 3: Context-Aware Assessment
      const finalAssessment = this.l3Context.evaluate(l2Result.value, context);

      // Enforce fail-safe on uncertain outcomes
      if (finalAssessment.confidence < 0.7 && finalAssessment.state === 'SAFE') {
         return ok(this.l4Fallback.failSafe('LOW_CONFIDENCE'));
      }

      return ok(finalAssessment);

    } catch {
      // Absolute boundary: Any exception results in fail safe
      return ok(this.l4Fallback.failSafe('PIPELINE_EXCEPTION'));
    }
  }
}
