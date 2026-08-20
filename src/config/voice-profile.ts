export interface VoiceCharacteristics {
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  tone: string[];
  age: 'YOUNG_ADULT' | 'ADULT' | 'MATURE';
}

export interface VoiceProfile {
  voiceId: string;
  provider: string; // e.g. 'ELEVENLABS', 'DEEPGRAM', 'MOCK'
  referenceAudioPath?: string; // Path to reference audio for cloning if supported
  languageSupport: string[]; // e.g. ['ar-EG', 'en-US']
  supportedModalities: ('TEXT_TO_SPEECH' | 'SPEECH_TO_SPEECH')[];
  characteristics: VoiceCharacteristics;
}

// Configuration for Ahmed - Egyptian Arabic Voice Profile
export const ahmedVoiceProfile: VoiceProfile = {
  voiceId: 'ahmed-egyptian-v1',
  provider: 'PRODUCTION_TTS_PROVIDER', // Placeholder for real integration
  referenceAudioPath: 'voice_preview_ahmed', // User provided reference identifier
  languageSupport: ['ar-EG', 'en-US', 'ar-SA'],
  supportedModalities: ['TEXT_TO_SPEECH'],
  characteristics: {
    gender: 'MALE',
    tone: ['warm', 'calm', 'empathetic', 'human', 'non-robotic'],
    age: 'ADULT'
  }
};

export class VoiceProfileRegistry {
  private activeProfile: VoiceProfile;

  constructor(defaultProfile: VoiceProfile = ahmedVoiceProfile) {
    this.activeProfile = defaultProfile;
  }

  public getActiveProfile(): VoiceProfile {
    return this.activeProfile;
  }

  public setActiveProfile(profile: VoiceProfile): void {
    this.activeProfile = profile;
  }
}
