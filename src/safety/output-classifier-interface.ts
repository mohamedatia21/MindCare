import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';

export interface OutputSafetyClassification {
  safe: boolean;
  confidence: number;
  blockedReason?: string;
}

export interface OutputSafetyClassifier {
  classify(outputContent: string): Promise<Result<OutputSafetyClassification, SafetyError>>;
}

export class MockOutputSafetyClassifier implements OutputSafetyClassifier {
  private mockScenario: string = 'SAFE';

  public setMockScenario(scenario: string) {
    this.mockScenario = scenario;
  }

  classify(_outputContent: string): Promise<Result<OutputSafetyClassification, SafetyError>> {
    // Prevent infinite recursion in tests when checking safe fallback text
    if (_outputContent === "Internal safety check failed." || _outputContent === "This response was flagged by secondary safety systems.") {
      return Promise.resolve(ok({ safe: true, confidence: 1.0 }));
    }

    if (this.mockScenario === 'TIMEOUT') return Promise.resolve(err(new SafetyError("Classifier timeout")));
    if (this.mockScenario === 'ERROR') return Promise.resolve(err(new SafetyError("Classifier error")));
    if (this.mockScenario === 'MALFORMED_RESPONSE') return Promise.resolve(ok({ safe: true } as unknown as OutputSafetyClassification)); // missing confidence
    
    if (this.mockScenario === 'UNSAFE') return Promise.resolve(ok({ safe: false, confidence: 0.99, blockedReason: 'SECONDARY_CLASSIFIER_UNSAFE' }));
    if (this.mockScenario === 'UNCERTAIN') return Promise.resolve(ok({ safe: false, confidence: 0.4, blockedReason: 'SECONDARY_CLASSIFIER_UNCERTAIN' })); // Low confidence must fail safe
    
    return Promise.resolve(ok({ safe: true, confidence: 0.95 }));
  }
}
