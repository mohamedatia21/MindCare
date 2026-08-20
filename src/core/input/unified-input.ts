export type Modality = 'TEXT' | 'VOICE';

export interface UnifiedInput {
  inputId: string;
  sessionId: string;
  userId: string;
  modality: Modality;
  text: string; // The raw typed text or the transcribed voice text
  timestamp: Date;
  metadata?: {
    sttProviderId?: string | undefined;
    sttConfidence?: number | undefined;
    sttLatencyMs?: number | undefined;
    interrupted?: boolean | undefined;
    languagePreference?: 'ENGLISH' | 'EGYPTIAN_ARABIC' | undefined;
    // Strictly forbidden from entering clinical layers:
    // audio: string; 
    // rawAudio: string;
    // rawTranscript: string;
  } | undefined;
}

export interface UnifiedResponse {
  interactionId: string;
  content: string; // the safe, output-filtered text
  modality: Modality;
  safe: boolean;
  blockedReason?: string;
  metadata?: {
    ttsLatencyMs?: number;
    ttsProviderId?: string;
  };
}
