import { SpeechToTextProvider, STTResponse, StreamingSTTProvider, TurnEvent } from './stt-interface.js';
import { TextToSpeechProvider, TTSResponse, StreamingTTSProvider } from './tts-interface.js';

export type MockVoiceScenario = 'NORMAL' | 'DELAYED' | 'FAILURE' | 'CRISIS' | 'EMPTY';

export class MockSTTProvider implements SpeechToTextProvider {
  private scenario: MockVoiceScenario = 'NORMAL';

  public setMockScenario(scenario: MockVoiceScenario): void {
    this.scenario = scenario;
  }

  public async transcribe(audioData: Buffer | string): Promise<STTResponse> {
    const startTime = Date.now();
    
    if (this.scenario === 'DELAYED') {
      await new Promise(r => setTimeout(r, 1000));
    }

    if (this.scenario === 'FAILURE') {
      return {
        ok: false,
        error: 'MOCK_STT_ERROR',
        metadata: { confidence: 0, latencyMs: Date.now() - startTime }
      };
    }

    if (this.scenario === 'EMPTY') {
      return {
        ok: true,
        transcript: '',
        metadata: { confidence: 1.0, latencyMs: Date.now() - startTime }
      };
    }

    let transcript = "I've been feeling overwhelmed lately.";
    if (this.scenario === 'CRISIS') {
      transcript = "أنا مش عايز أعيش"; // Crisis indicator
    }

    // In a test, if audioData contains specific text string, mock it out exactly
    if (typeof audioData === 'string' && audioData.startsWith('MOCK_TRANSCRIPT:')) {
      transcript = audioData.replace('MOCK_TRANSCRIPT:', '');
    }

    return {
      ok: true,
      transcript,
      metadata: { confidence: 0.95, latencyMs: Date.now() - startTime }
    };
  }
}

export class MockTTSProvider implements TextToSpeechProvider {
  private scenario: MockVoiceScenario = 'NORMAL';
  private cancelled = false;

  public setMockScenario(scenario: MockVoiceScenario): void {
    this.scenario = scenario;
  }

  public async synthesize(text: string): Promise<TTSResponse> {
    this.cancelled = false;
    const startTime = Date.now();

    if (this.scenario === 'DELAYED') {
      await new Promise(r => setTimeout(r, 1000));
    }

    if (this.cancelled) {
      return {
        ok: false,
        error: 'PLAYBACK_CANCELLED',
        metadata: { latencyMs: Date.now() - startTime, durationMs: 0 }
      };
    }

    if (this.scenario === 'FAILURE') {
      return {
        ok: false,
        error: 'MOCK_TTS_ERROR',
        metadata: { latencyMs: Date.now() - startTime, durationMs: 0 }
      };
    }

    return {
      ok: true,
      audioUrl: 'mock://audio.mp3',
      metadata: { latencyMs: Date.now() - startTime, durationMs: text.length * 50 } // mock duration
    };
  }

  public cancel(): void {
    this.cancelled = true;
  }
}

export class MockStreamingSTTProvider implements StreamingSTTProvider {
  public listeners: ((event: TurnEvent) => void)[] = [];
  
  public onTurnEvent(callback: (event: TurnEvent) => void): void {
    this.listeners.push(callback);
  }

  public async *transcribeStream(audioStream: AsyncIterable<Buffer | string>): AsyncGenerator<STTResponse, void, unknown> {
    this.listeners.forEach(cb => cb({ type: 'speech_start', timestamp: new Date(), turnId: 'mock-turn' }));
    
    let fullTranscript = '';
    
    for await (const chunk of audioStream) {
      if (typeof chunk === 'string' && chunk === 'MOCK_CRISIS') {
         yield { ok: true, transcript: 'I want to kill myself', metadata: { confidence: 1.0, latencyMs: 50, isFinal: false } };
         continue;
      }
      if (typeof chunk === 'string' && chunk === 'MOCK_FINAL') {
         this.listeners.forEach(cb => cb({ type: 'speech_end', timestamp: new Date(), turnId: 'mock-turn' }));
         yield { ok: true, transcript: fullTranscript, metadata: { confidence: 0.98, latencyMs: 20, isFinal: true, detectedLanguage: 'ar-EG' } };
         fullTranscript = ''; // Reset for next turn
         continue;
      }
      
      fullTranscript += chunk.toString();
      yield {
        ok: true,
        transcript: fullTranscript,
        metadata: { confidence: 0.9, latencyMs: 10, isFinal: false, detectedLanguage: 'ar-EG' }
      };
    }
    
    this.listeners.forEach(cb => cb({ type: 'speech_end', timestamp: new Date(), turnId: 'mock-turn' }));
    yield {
      ok: true,
      transcript: fullTranscript,
      metadata: { confidence: 0.98, latencyMs: 20, isFinal: true, detectedLanguage: 'ar-EG' }
    };
  }
}

export class MockStreamingTTSProvider implements StreamingTTSProvider {
  private cancelledTurns = new Set<string>();

  public cancel(turnId: string): void {
    this.cancelledTurns.add(turnId);
  }

  public async *synthesizeStream(textStream: AsyncIterable<string>, turnId: string): AsyncGenerator<TTSResponse, void, unknown> {
    for await (const textChunk of textStream) {
      if (this.cancelledTurns.has(turnId)) {
        return; // Halt stream immediately on barge-in
      }
      
      // Simulate synthesis delay
      await new Promise(r => setTimeout(r, 20));
      
      if (this.cancelledTurns.has(turnId)) return;
      
      yield {
        ok: true,
        audioChunk: Buffer.from(`mock-audio-for:${textChunk}`),
        metadata: { latencyMs: 20, durationMs: 100 }
      };
    }
  }
}
