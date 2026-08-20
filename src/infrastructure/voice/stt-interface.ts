export interface STTResponse {
  ok: boolean;
  transcript?: string;
  error?: string;
  metadata?: {
    confidence: number;
    latencyMs: number;
    isFinal?: boolean; // True if this is the final transcript for the turn
    detectedLanguage?: string;
  };
}

export interface TurnEvent {
  type: 'speech_start' | 'speech_end' | 'interruption' | 'timeout';
  timestamp: Date;
  turnId: string;
}

export interface StreamingSTTProvider {
  // Yields partial and final transcripts as the user speaks
  transcribeStream(audioStream: AsyncIterable<Buffer | string>): AsyncGenerator<STTResponse, void, unknown>;
  
  // Emits events when turn state changes
  onTurnEvent(callback: (event: TurnEvent) => void): void;
}

export interface SpeechToTextProvider {
  transcribe(audioData: Buffer | string): Promise<STTResponse>;
}
