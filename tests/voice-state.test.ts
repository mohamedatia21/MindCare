import { describe, it, expect } from 'vitest';
import { VoiceStateMachine } from '../src/core/voice/voice-state-machine.js';

describe('Phase 5: Voice State Machine', () => {
  it('Initializes in IDLE state', () => {
    const sm = new VoiceStateMachine();
    expect(sm.getState()).toBe('IDLE');
  });

  it('Follows the normal conversation lifecycle: IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING -> IDLE', () => {
    const sm = new VoiceStateMachine();
    
    expect(sm.transition('LISTENING')).toBe(true);
    expect(sm.getState()).toBe('LISTENING');

    expect(sm.transition('TRANSCRIBING')).toBe(true);
    expect(sm.getState()).toBe('TRANSCRIBING');

    expect(sm.transition('THINKING')).toBe(true);
    expect(sm.getState()).toBe('THINKING');

    expect(sm.transition('SPEAKING')).toBe(true);
    expect(sm.getState()).toBe('SPEAKING');

    expect(sm.transition('IDLE')).toBe(true);
    expect(sm.getState()).toBe('IDLE');
  });

  it('Rejects invalid transitions', () => {
    const sm = new VoiceStateMachine();
    // Cannot jump from IDLE to SPEAKING
    expect(sm.transition('SPEAKING')).toBe(false);
    expect(sm.getState()).toBe('IDLE');

    // Cannot jump from LISTENING to THINKING without TRANSCRIBING
    sm.transition('LISTENING');
    expect(sm.transition('THINKING')).toBe(false);
    expect(sm.getState()).toBe('LISTENING');
  });

  it('Handles interruption while SPEAKING', () => {
    const sm = new VoiceStateMachine();
    sm.transition('LISTENING');
    sm.transition('TRANSCRIBING');
    sm.transition('THINKING');
    sm.transition('SPEAKING');

    // User interrupts
    expect(sm.interrupt()).toBe(true);
    expect(sm.getState()).toBe('INTERRUPTED');

    // Interrupted goes back to LISTENING
    expect(sm.transition('LISTENING')).toBe(true);
    expect(sm.getState()).toBe('LISTENING');
  });

  it('Cannot interrupt when not SPEAKING', () => {
    const sm = new VoiceStateMachine();
    sm.transition('LISTENING');
    expect(sm.interrupt()).toBe(false);
    expect(sm.getState()).toBe('LISTENING');
  });
});
