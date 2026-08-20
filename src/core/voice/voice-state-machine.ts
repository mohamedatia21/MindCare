export type VoiceState = 
  | 'IDLE' 
  | 'LISTENING' 
  | 'TRANSCRIBING' 
  | 'THINKING' 
  | 'SPEAKING' 
  | 'INTERRUPTED' 
  | 'ERROR';

export class VoiceStateMachine {
  private currentState: VoiceState = 'IDLE';

  public getState(): VoiceState {
    return this.currentState;
  }

  public transition(newState: VoiceState): boolean {
    // Deterministic state transitions
    const validTransitions: Record<VoiceState, VoiceState[]> = {
      'IDLE': ['LISTENING', 'TRANSCRIBING', 'THINKING', 'ERROR'],
      'LISTENING': ['TRANSCRIBING', 'IDLE', 'ERROR'],
      'TRANSCRIBING': ['THINKING', 'IDLE', 'ERROR'],
      'THINKING': ['SPEAKING', 'IDLE', 'ERROR'],
      'SPEAKING': ['IDLE', 'INTERRUPTED', 'ERROR'],
      'INTERRUPTED': ['LISTENING', 'IDLE', 'ERROR'],
      'ERROR': ['IDLE', 'LISTENING'] // Recovery
    };

    if (validTransitions[this.currentState].includes(newState)) {
      this.currentState = newState;
      return true;
    }

    return false;
  }

  public interrupt(): boolean {
    if (this.currentState === 'SPEAKING') {
      return this.transition('INTERRUPTED');
    }
    return false;
  }

  public reset(): void {
    this.currentState = 'IDLE';
  }
}
