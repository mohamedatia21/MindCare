export interface TTSResponse {
  ok: boolean;
  audioUrl?: string; // or raw Buffer stream, depending on provider
  audioChunk?: Buffer; // For streaming
  error?: string;
  metadata?: {
    latencyMs: number;
    durationMs: number;
  };
}

export interface StreamingTTSProvider {
  // Yields synthesized audio chunks from a stream of text tokens
  synthesizeStream(textStream: AsyncIterable<string>, turnId: string): AsyncGenerator<TTSResponse, void, unknown>;
  
  // Halts the current synthesis immediately (used during barge-in)
  cancel(turnId: string): void;
}

export interface TextToSpeechProvider {
  synthesize(text: string): Promise<TTSResponse>;
  cancel(): void;
}
