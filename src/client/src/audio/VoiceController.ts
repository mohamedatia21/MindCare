export type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';
export type SupportedLanguage = 'EGYPTIAN_ARABIC' | 'ENGLISH';

export interface VoiceControllerCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onFinalSpeech?: (text: string) => void;
  onAmplitudeChange?: (amplitude: number) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: string) => void;
}

export class VoiceController {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private recognition: any = null;
  private isListening = false;
  private isSpeaking = false;
  private language: SupportedLanguage = 'EGYPTIAN_ARABIC';
  private callbacks: VoiceControllerCallbacks = {};
  
  // Voice Activity Detection (VAD)
  private userIsSpeaking = false;
  private silenceTimer: any = null;
  private lastSpeechTimestamp = 0;
  private synthPulseTimer: any = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private fastPathTranscript = '';
  private isProcessingAudio = false;

  constructor(callbacks: VoiceControllerCallbacks = {}) {
    this.callbacks = callbacks;
    this.initVoiceList();
  }

  private initVoiceList(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  public setCallbacks(callbacks: VoiceControllerCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setLanguage(lang: SupportedLanguage) {
    this.language = lang;
    if (this.recognition) {
      try {
        this.recognition.lang = lang === 'ENGLISH' ? 'en-US' : 'ar-EG';
      } catch (e) {}
    }
  }

  public async startListening(): Promise<boolean> {
    console.log('[MindCare Voice] 🎙️ Initializing audio pipeline & speech engines...');
    this.stopSpeaking();
    this.fastPathTranscript = '';
    this.isProcessingAudio = false;

    try {
      // 1. Initialize AudioContext & Analyser (Microphone)
      await this.initAudioContext();
      await this.initMicrophone();

      // 2. Initialize Fast-Path Web Speech API if supported
      this.initSpeechRecognition();

      // 3. Start MediaRecorder & VAD Loop
      this.startMediaRecorder();
      this.startAmplitudeAndVADLoop();

      this.isListening = true;
      this.callbacks.onStateChange?.('LISTENING');
      return true;
    } catch (err: any) {
      console.error('[MindCare Voice] ❌ Failed to start voice listening:', err);
      this.callbacks.onError?.(err.message || 'Microphone access denied');
      return false;
    }
  }

  public stopListening(): void {
    console.log('[MindCare Voice] ⏹️ Stopping voice listening.');
    this.isListening = false;
    this.userIsSpeaking = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }
    this.stopMediaRecorder();
    this.stopAmplitudeLoop();
    this.stopMicrophone();
    if (!this.isSpeaking) {
      this.callbacks.onStateChange?.('IDLE');
    }
  }

  public toggleListening(): Promise<boolean> {
    if (this.isListening) {
      this.stopListening();
      return Promise.resolve(false);
    } else {
      return this.startListening();
    }
  }

  private async initAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private async initMicrophone(): Promise<void> {
    if (this.micStream) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (this.audioCtx) {
      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.analyser = analyser;
    }
  }

  private stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    this.analyser = null;
  }

  private startMediaRecorder(): void {
    if (!this.micStream) return;

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      this.recordedChunks = [];
      const recorder = new MediaRecorder(this.micStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      recorder.start(250); // Slice every 250ms
      this.mediaRecorder = recorder;
    } catch (e) {
      console.warn('[MindCare Voice] MediaRecorder init error:', e);
    }
  }

  private stopMediaRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
    }
    this.recordedChunks = [];
  }

  private initSpeechRecognition(): void {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.language === 'ENGLISH' ? 'en-US' : 'ar-EG';

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0]?.transcript || '';
        }
        const clean = transcript.trim();
        if (clean) {
          console.log(`[MindCare Voice] 🗣️ Fast-Path Recognition: "${clean}"`);
          this.fastPathTranscript = clean;
          this.callbacks.onTranscript?.(clean, false);
        }
      };

      rec.onerror = (e: any) => {
        console.warn('[MindCare Voice] Fast-path speech recognition notice:', e.error);
      };

      rec.start();
      this.recognition = rec;
    } catch (e) {}
  }

  private startAmplitudeAndVADLoop(): void {
    if (this.animFrameId) return;

    const buffer = new Uint8Array(128);

    const update = () => {
      if (this.isListening && this.analyser && !this.isSpeaking) {
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(avg / 65, 1.0);
        this.callbacks.onAmplitudeChange?.(normalized);

        // Voice Activity Detection (VAD) Logic
        const SPEECH_THRESHOLD = 0.12;
        if (normalized > SPEECH_THRESHOLD) {
          this.lastSpeechTimestamp = Date.now();
          if (!this.userIsSpeaking) {
            this.userIsSpeaking = true;
            console.log('[MindCare Voice] 🎙️ User speech started.');
          }
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.userIsSpeaking && Date.now() - this.lastSpeechTimestamp > 1200) {
          // 1.2 seconds of silence after user spoke -> Finalize speech turn!
          this.userIsSpeaking = false;
          console.log('[MindCare Voice] 🛑 User speech ended. Finalizing turn...');
          this.handleSpeechTurnFinalized();
        }
      } else if (!this.isSpeaking) {
        this.callbacks.onAmplitudeChange?.(0);
      }

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  private async handleSpeechTurnFinalized(): Promise<void> {
    if (this.isProcessingAudio || !this.isListening || this.isSpeaking) return;
    this.isProcessingAudio = true;

    // 1. If fast-path transcript is already available
    if (this.fastPathTranscript.trim()) {
      const text = this.fastPathTranscript.trim();
      this.fastPathTranscript = '';
      this.isProcessingAudio = false;
      this.callbacks.onFinalSpeech?.(text);
      return;
    }

    // 2. Otherwise transcribe audio chunks via Serverless Whisper API
    try {
      if (this.recordedChunks.length === 0) {
        this.isProcessingAudio = false;
        return;
      }

      const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      this.recordedChunks = [];

      // Only transcribe if audio blob is meaningful (> 5KB)
      if (audioBlob.size < 4000) {
        this.isProcessingAudio = false;
        return;
      }

      console.log(`[MindCare Voice] 🌐 Sending audio (${Math.round(audioBlob.size / 1024)}KB) to Whisper STT...`);
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              language: this.language === 'ENGLISH' ? 'en' : 'ar'
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.text && data.text.trim()) {
              const transcribedText = data.text.trim();
              console.log(`[MindCare Voice] ✅ Whisper Transcribed: "${transcribedText}"`);
              this.callbacks.onTranscript?.(transcribedText, true);
              this.callbacks.onFinalSpeech?.(transcribedText);
            }
          }
        } catch (sttErr) {
          console.warn('[MindCare Voice] Whisper transcription error:', sttErr);
        } finally {
          this.isProcessingAudio = false;
        }
      };
    } catch (e) {
      console.warn('[MindCare Voice] Audio turn processing error:', e);
      this.isProcessingAudio = false;
    }
  }

  private stopAmplitudeLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.callbacks.onAmplitudeChange?.(0);
  }

  public async speakText(text: string, lang?: SupportedLanguage): Promise<void> {
    const targetLang = lang || this.language;
    const cleanText = text.replace(/[*_#`~[\]()]/g, '').trim();
    if (!cleanText) return;

    console.log(`[MindCare Voice] 🔊 Speaking response (${targetLang}): "${cleanText.slice(0, 60)}..."`);
    
    this.stopSpeaking();
    this.isSpeaking = true;
    this.callbacks.onStateChange?.('SPEAKING');

    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    this.startSpeechAmplitudeSimulation();

    // 1. Try High-Fidelity Cloud Neural TTS (/api/tts) first
    try {
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language: targetLang === 'ENGLISH' ? 'en' : 'ar'
        })
      });

      if (ttsRes.ok) {
        const data = await ttsRes.json();
        if (data.ok && data.audioBase64) {
          console.log('[MindCare Voice] 🎵 Playing neural audio stream from TTS endpoint...');
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
          
          await new Promise<void>((res) => {
            let done = false;
            const end = () => {
              if (!done) {
                done = true;
                this.finishSpeaking();
                res();
              }
            };

            audio.onended = end;
            audio.onerror = end;
            audio.play().catch((playErr) => {
              console.warn('[MindCare Voice] Audio play error:', playErr);
              end();
            });

            setTimeout(end, Math.max(4000, cleanText.length * 110));
          });
          return;
        }
      }
    } catch (apiTtsErr) {
      console.warn('[MindCare Voice] /api/tts offline or standalone, falling back to Web Speech Synthesis:', apiTtsErr);
    }

    // 2. Fallback: Browser Web Speech Synthesis
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.finishSpeaking();
        resolve();
        return;
      }

      try {
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = targetLang === 'EGYPTIAN_ARABIC' ? 'ar-EG' : 'en-US';
        utterance.rate = targetLang === 'EGYPTIAN_ARABIC' ? 0.95 : 1.0;
        utterance.pitch = 1.0;

        if (this.cachedVoices.length === 0) {
          this.cachedVoices = window.speechSynthesis.getVoices();
        }
        const preferredVoice = this.pickBestVoice(this.cachedVoices, targetLang);
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        let finished = false;
        const complete = () => {
          if (!finished) {
            finished = true;
            this.finishSpeaking();
            resolve();
          }
        };

        utterance.onstart = () => {
          this.isSpeaking = true;
          this.callbacks.onStateChange?.('SPEAKING');
        };

        utterance.onend = () => {
          complete();
        };

        utterance.onerror = (e) => {
          console.warn('[MindCare Voice] ⚠️ SpeechSynthesis error:', e);
          complete();
        };

        window.speechSynthesis.speak(utterance);

        // Failsafe watchdog timer
        const maxSpeechMs = Math.max(3000, cleanText.length * 90);
        setTimeout(() => {
          if (this.isSpeaking) {
            complete();
          }
        }, maxSpeechMs);
      } catch (synthErr) {
        console.warn('[MindCare Voice] ⚠️ SpeechSynthesis invocation failed:', synthErr);
        this.finishSpeaking();
        resolve();
      }
    });
  }

  private pickBestVoice(voices: SpeechSynthesisVoice[], lang: SupportedLanguage): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) return null;

    if (lang === 'EGYPTIAN_ARABIC') {
      const arVoices = voices.filter(v => v.lang.toLowerCase().startsWith('ar'));
      const naturalAr = arVoices.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Google') || 
        v.name.includes('Salma') || 
        v.name.includes('Shakir') || 
        v.name.includes('Hoda') || 
        v.name.includes('Maged') ||
        v.name.includes('Naayf') ||
        v.name.includes('Laila') ||
        v.name.includes('Tarik') ||
        v.name.includes('Arabic')
      );
      if (naturalAr) return naturalAr;
      if (arVoices.length > 0) return arVoices[0];
    } else {
      const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
      const naturalEn = enVoices.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Google') || 
        v.name.includes('Samantha') || 
        v.name.includes('Jenny') || 
        v.name.includes('Guy')
      );
      if (naturalEn) return naturalEn;
      if (enVoices.length > 0) return enVoices[0];
    }

    return null;
  }

  private startSpeechAmplitudeSimulation(): void {
    if (this.synthPulseTimer) clearInterval(this.synthPulseTimer);

    let step = 0;
    this.synthPulseTimer = setInterval(() => {
      if (!this.isSpeaking) {
        clearInterval(this.synthPulseTimer);
        this.synthPulseTimer = null;
        return;
      }
      step += 0.35;
      const base = 0.45 + Math.sin(step) * 0.3 + Math.cos(step * 2.3) * 0.2;
      const amp = Math.max(0.15, Math.min(base, 0.95));
      this.callbacks.onAmplitudeChange?.(amp);
    }, 45);
  }

  public stopSpeaking(): void {
    if (this.synthPulseTimer) {
      clearInterval(this.synthPulseTimer);
      this.synthPulseTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
  }

  private finishSpeaking(): void {
    this.stopSpeaking();
    this.callbacks.onAmplitudeChange?.(0);
    if (this.isListening) {
      this.callbacks.onStateChange?.('LISTENING');
      this.fastPathTranscript = '';
      this.recordedChunks = [];
      try {
        if (this.recognition) {
          this.recognition.start();
        } else {
          this.initSpeechRecognition();
        }
      } catch {}
    } else {
      this.callbacks.onStateChange?.('IDLE');
    }
  }

  public destroy(): void {
    this.stopListening();
    this.stopSpeaking();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
  }
}
