import { UnifiedInput } from '../core/input/unified-input.js';
import { Result } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { SafetyClassification, SafetySignals } from './types.js';

export interface StructuredSafetyClassifier {
  // Must return strictly validated schema output. Malformed = err()
  classify(input: UnifiedInput, l1Signals: SafetySignals): Promise<Result<SafetyClassification, SafetyError>>;
}

export class MockSafetyClassifier implements StructuredSafetyClassifier {
  classify(_input: UnifiedInput, _l1Signals: SafetySignals): Promise<Result<SafetyClassification, SafetyError>> {
    // This is a stub for Phase 4B to prove architecture without an LLM
    // A real implementation would parse JSON and validate schema exactly
    return Promise.resolve({
      ok: true,
      value: {
        state: 'SAFE',
        confidence: 0.9,
        signalCategories: [],
        requiresEscalation: false
      }
    });
  }
}
