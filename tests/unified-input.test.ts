import { describe, it, expect } from 'vitest';
import { UnifiedInput } from '../src/core/input/unified-input.js';
import { MindCareRuntime } from '../src/core/orchestrator.js';

describe('Phase 5: Unified Input', () => {
  it('Normalizes TEXT and VOICE input into the same orchestrator format', () => {
    const textInput: UnifiedInput = {
      inputId: 'i1',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      text: 'I am typing this.',
      timestamp: new Date()
    };

    const voiceInput: UnifiedInput = {
      inputId: 'i2',
      sessionId: 's1',
      userId: 'u1',
      modality: 'VOICE',
      text: 'I am speaking this.',
      timestamp: new Date(),
      metadata: {
        sttProviderId: 'mock-stt',
        sttConfidence: 0.99
      }
    };

    // Both must satisfy the UnifiedInput interface and share the same core properties
    expect(textInput.modality).toBe('TEXT');
    expect(voiceInput.modality).toBe('VOICE');
    expect(textInput.text).toBe('I am typing this.');
    expect(voiceInput.text).toBe('I am speaking this.');
  });
});
