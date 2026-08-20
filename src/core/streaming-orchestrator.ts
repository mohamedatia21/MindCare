import { MindCareRuntime } from './orchestrator.js';
import { UnifiedInput } from './input/unified-input.js';
import { Actor, ContextPackage } from '../memory/types.js';
import { StreamingSTTProvider, TurnEvent } from '../infrastructure/voice/stt-interface.js';
import { StreamingTTSProvider } from '../infrastructure/voice/tts-interface.js';
import { VoiceStateMachine } from './voice/voice-state-machine.js';
import { RuntimeLogger } from '../observability/runtime-logger.js';
import { MetricsCollector } from '../observability/metrics-collector.js';
import { Result, ok, err } from './result.js';
import { InternalError } from './errors.js';
import { randomUUID } from 'crypto';

export class StreamingMindCareRuntime {
  private currentTurnId: string | null = null;
  private isGenerating = false;
  private onControlRef: ((msg: any) => void) | undefined = undefined;
  
  constructor(
    private readonly orchestrator: MindCareRuntime,
    private readonly sttProvider: StreamingSTTProvider,
    private readonly ttsProvider: StreamingTTSProvider,
    private readonly stateMachine: VoiceStateMachine,
    private readonly logger: RuntimeLogger,
    private readonly metricsCollector: MetricsCollector
  ) {
    this.sttProvider.onTurnEvent(this.handleTurnEvent.bind(this));
  }

  private handleTurnEvent(event: TurnEvent) {
    if (event.type === 'speech_start') {
      if (this.stateMachine.getState() === 'SPEAKING' || this.isGenerating) {
        // BARGE-IN DETECTED
        this.logger.warn('BargeInDetected', { 
          requestId: this.currentTurnId || 'unknown',
          timestamp: new Date(),
          previousTurn: this.currentTurnId, 
          newTurn: event.turnId 
        });
        
        // 1. Stop/cancel TTS playback
        if (this.currentTurnId) {
          this.ttsProvider.cancel(this.currentTurnId);
        }
        
        // 2. Cancel unnecessary generation (flag)
        this.isGenerating = false;
        
        // 3. Transition to LISTENING
        this.stateMachine.interrupt();
        this.stateMachine.transition('LISTENING');
        if (this.onControlRef) {
           this.onControlRef({ type: 'state', state: 'LISTENING', turnId: this.currentTurnId });
           this.onControlRef({ type: 'audio_cancelled', turnId: this.currentTurnId });
        }
      } else {
        this.stateMachine.transition('LISTENING');
        if (this.onControlRef) this.onControlRef({ type: 'state', state: 'LISTENING' });
      }
      this.currentTurnId = event.turnId;
    } else if (event.type === 'speech_end') {
       this.stateMachine.transition('TRANSCRIBING');
    }
  }

  public async processAudioStream(
     audioStream: AsyncIterable<Buffer | string>, 
     actor: Actor, 
     context: ContextPackage,
     onAudio?: (chunk: Buffer) => void,
     onControl?: (msg: any) => void,
     metadata?: UnifiedInput['metadata']
  ) {
    const turnStartTime = Date.now();
    let llmFirstTokenMs = 0;
    let ttsFirstAudioChunkMs = 0;
    let finalTranscript = '';
    
    this.onControlRef = onControl;
    // 1. Stream into STT
    for await (const sttChunk of this.sttProvider.transcribeStream(audioStream)) {
       // L1 Deterministic Safety could be hooked here for extreme low latency crisis abort!
       // But for now we gather the final transcript.
       if (sttChunk.ok && sttChunk.transcript) {
          finalTranscript = sttChunk.transcript;
          // In a true streaming safety setup, we might abort the `for await` early if MOCK_CRISIS is matched.
          if (finalTranscript.includes('I want to kill myself') || finalTranscript.includes('أنا مش عايز أعيش')) {
             this.logger.warn('StreamingCrisisDetected', { 
                requestId: this.currentTurnId || 'unknown',
                timestamp: new Date(),
                text: finalTranscript 
             });
             break; // Short circuit
          }
          
          // CRITICAL FIX: Break out of the STT collection loop when the STT provider 
          // indicates the user has finished speaking a full turn (silence detected).
          if (sttChunk.metadata?.isFinal) {
             break;
          }
       }
    }

    if (!finalTranscript) return;

    // Determine if we exited the STT loop due to crisis detection
    const isCrisisDetected = finalTranscript.includes('I want to kill myself') || finalTranscript.includes('أنا مش عايز أعيش');

    // Transition through proper state sequence: LISTENING → TRANSCRIBING → THINKING
    // When crisis breaks out of the STT loop, speech_end never fires, so we must
    // transition through TRANSCRIBING ourselves to maintain state machine integrity.
    const currentState = this.stateMachine.getState();
    if (currentState === 'LISTENING') {
      this.stateMachine.transition('TRANSCRIBING');
    }
    this.stateMachine.transition('THINKING');
    if (onControl) onControl({ type: 'transcript', text: finalTranscript, turnId: this.currentTurnId });
    if (onControl) onControl({ type: 'state', state: 'THINKING', turnId: this.currentTurnId });
    this.isGenerating = true;

    // 2. Convert to UnifiedInput and run the existing secure architecture
    const input: UnifiedInput = {
      inputId: this.currentTurnId || randomUUID(),
      sessionId: 'stream-session',
      userId: actor.id,
      modality: 'VOICE',
      text: finalTranscript,
      timestamp: new Date(),
      metadata
    };

    const orchestratorResult = await this.orchestrator.processRequest(input, actor, context);
    llmFirstTokenMs = Date.now() - turnStartTime;
    
    if (!this.isGenerating || this.stateMachine.getState() !== 'THINKING') {
      // We were interrupted during the LLM generation phase
      return;
    }

    // If crisis was detected, the orchestrator handles it via crisis pipeline.
    // The result may be an error (SafetyError for CRISIS state) or a crisis response.
    // In either case, we transition to IDLE after crisis handling.
    if (isCrisisDetected) {
      this.isGenerating = false;
      this.stateMachine.transition('IDLE');
      if (onControl) onControl({ type: 'state', state: 'IDLE', turnId: this.currentTurnId });
      return;
    }

    if (!orchestratorResult || !orchestratorResult.ok) {
       this.logger.error('StreamingOrchestratorFailed', { 
          requestId: this.currentTurnId || 'unknown',
          timestamp: new Date(),
          reasonCode: orchestratorResult?.error?.message || 'UnknownError'
       });
       this.stateMachine.transition('IDLE');
       return;
    }

    if (onControl) {
       onControl({ type: 'chat_response', text: orchestratorResult.value, turnId: this.currentTurnId });
    }

    // 3. Stream the output text to TTS
    this.stateMachine.transition('SPEAKING');
    if (onControl) onControl({ type: 'state', state: 'SPEAKING', turnId: this.currentTurnId });
    if (onControl) onControl({ type: 'audio_start', turnId: this.currentTurnId });
    
    async function* textStreamGenerator(text: string) {
       const words = text.split(' ');
       for (const word of words) {
          yield word + ' ';
       }
    }

    const ttsTurnId = this.currentTurnId || 'fallback';
    for await (const audioChunk of this.ttsProvider.synthesizeStream(textStreamGenerator(orchestratorResult.value), ttsTurnId)) {
       if (ttsFirstAudioChunkMs === 0) {
          ttsFirstAudioChunkMs = Date.now() - turnStartTime;
       }
       if (this.stateMachine.getState() !== 'SPEAKING') {
          break; // Barge-in interrupted TTS playback
       }
       if (onAudio && audioChunk.audioChunk) {
           onAudio(audioChunk.audioChunk);
       }
    }

    if (this.stateMachine.getState() === 'SPEAKING') {
      if (onControl) onControl({ type: 'audio_end', turnId: this.currentTurnId });
      this.stateMachine.transition('IDLE');
      if (onControl) onControl({ type: 'state', state: 'IDLE' });
      this.isGenerating = false;
      const totalTurnMs = Date.now() - turnStartTime;
      this.metricsCollector.recordTurnLatency({
        turnId: this.currentTurnId || randomUUID(),
        sessionId: 'anonymous', 
        ttfaMs: ttsFirstAudioChunkMs, 
        ttstMs: llmFirstTokenMs,
        llmFirstTokenMs,
        ttsFirstAudioChunkMs,
        totalTurnMs,
        bargeInTriggered: false
      });
    }
  }

  public async processTextMessage(
     text: string, 
     actor: Actor, 
     context: ContextPackage,
     onAudio?: (chunk: Buffer) => void,
     onControl?: (msg: any) => void,
     metadata?: UnifiedInput['metadata']
  ): Promise<string> {
     const turnStartTime = Date.now();
     this.currentTurnId = 'turn-' + Date.now();
     this.onControlRef = onControl;
     
     if (this.stateMachine.getState() !== 'IDLE' && this.stateMachine.getState() !== 'LISTENING') {
        this.stateMachine.interrupt();
     }
     this.stateMachine.transition('THINKING');
     if (onControl) onControl({ type: 'state', state: 'THINKING', turnId: this.currentTurnId });
     this.isGenerating = true;

     const input: UnifiedInput = {
       inputId: this.currentTurnId,
       sessionId: 'text-session',
       userId: actor.id,
       modality: 'TEXT',
       text,
       timestamp: new Date(),
       metadata
     };

     const orchestratorResult = await this.orchestrator.processRequest(input, actor, context);
     const llmFirstTokenMs = Date.now() - turnStartTime;

     if (!orchestratorResult || !orchestratorResult.ok) {
        this.logger.error('StreamingOrchestratorTextFailed', { 
           requestId: this.currentTurnId,
           timestamp: new Date(),
           reasonCode: orchestratorResult?.error?.message || 'UnknownError'
        });
        const fallbackMsg = "أنا سامعك وحاسس بيك، خلينا نعدي ده سوا.";
        if (onControl) {
           onControl({ type: 'chat_response', text: fallbackMsg, turnId: this.currentTurnId });
        }
        this.stateMachine.transition('LISTENING');
        if (onControl) onControl({ type: 'state', state: 'LISTENING', turnId: this.currentTurnId });
        this.isGenerating = false;
        return fallbackMsg;
     }

     const responseText = orchestratorResult.value;
     if (onControl) {
        onControl({ type: 'chat_response', text: responseText, turnId: this.currentTurnId });
     }

     // Synthesize voice for the response
     this.stateMachine.transition('SPEAKING');
     if (onControl) {
        onControl({ type: 'state', state: 'SPEAKING', turnId: this.currentTurnId });
        onControl({ type: 'audio_start', turnId: this.currentTurnId });
     }

     async function* textStreamGenerator(txt: string) {
        const words = txt.split(' ');
        for (const word of words) {
           yield word + ' ';
        }
     }

     let ttsFirstAudioChunkMs = 0;
     const ttsTurnId = this.currentTurnId;
     for await (const audioChunk of this.ttsProvider.synthesizeStream(textStreamGenerator(responseText), ttsTurnId)) {
        if (ttsFirstAudioChunkMs === 0) {
           ttsFirstAudioChunkMs = Date.now() - turnStartTime;
        }
        if (this.stateMachine.getState() !== 'SPEAKING') {
           break;
        }
        if (onAudio && audioChunk.audioChunk) {
            onAudio(audioChunk.audioChunk);
        }
     }

     if (this.stateMachine.getState() === 'SPEAKING') {
       if (onControl) onControl({ type: 'audio_end', turnId: this.currentTurnId });
       this.stateMachine.transition('IDLE');
       this.stateMachine.transition('LISTENING');
       if (onControl) onControl({ type: 'state', state: 'LISTENING' });
       this.isGenerating = false;
       
       const totalTurnMs = Date.now() - turnStartTime;
       this.metricsCollector.recordTurnLatency({
         turnId: this.currentTurnId,
         sessionId: 'text-session',
         ttfaMs: ttsFirstAudioChunkMs,
         ttstMs: llmFirstTokenMs,
         llmFirstTokenMs,
         ttsFirstAudioChunkMs,
         totalTurnMs,
         bargeInTriggered: false
       });
     }

     return responseText;
  }
}
