import { RuntimeState, SafetyState } from './types.js';
import { UnifiedInput } from './input/unified-input.js';
import { Result, ok, err } from './result.js';
import { SafetyError } from './errors.js';

export class StateMachine {
  private currentState: RuntimeState = 'NORMAL';

  public getState(): RuntimeState {
    return this.currentState;
  }

  public onNewInput(_input: UnifiedInput): Result<RuntimeState, SafetyError> {
    if (this.currentState === 'CRISIS_PROTOCOL') {
      return err(new SafetyError("CRISIS_PROTOCOL active. Cannot bypass without explicit safety review reset."));
    }
    // Dynamically evaluate each incoming turn afresh
    this.currentState = 'SAFETY_REVIEW';
    return ok(this.currentState);
  }


  // Transitions out of SAFETY_REVIEW depend explicitly on the Safety Decision
  public applySafetyDecision(safetyDecision: SafetyState): Result<RuntimeState, SafetyError> {
    switch (safetyDecision) {
      case 'SAFE':
        this.currentState = 'NORMAL'; // From here, it can route to SUPPORT/EXERCISE/PROGRESS
        break;
      case 'ELEVATED':
        this.currentState = 'ELEVATED';
        break;
      case 'CRISIS':
        this.currentState = 'CRISIS_PROTOCOL';
        break;
      default:
        // Fail safe on unknown
        this.currentState = 'CRISIS_PROTOCOL';
        break;
    }

    return ok(this.currentState);
  }

  public transitionToClinical(targetState: 'SUPPORT' | 'EXERCISE' | 'PROGRESS'): Result<RuntimeState, SafetyError> {
    if (this.currentState !== 'NORMAL' && this.currentState !== 'SUPPORT' && this.currentState !== 'EXERCISE' && this.currentState !== 'PROGRESS') {
      return err(new SafetyError("Clinical processing can only occur from the NORMAL state after a SAFE evaluation."));
    }
    this.currentState = targetState;
    return ok(this.currentState);
  }
}
