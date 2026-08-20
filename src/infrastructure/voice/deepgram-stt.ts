import WebSocket from 'ws';
import { StreamingSTTProvider, STTResponse, TurnEvent } from './stt-interface.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

export class DeepgramStreamingSTT implements StreamingSTTProvider {
  private listeners: ((event: TurnEvent) => void)[] = [];
  private logger = new RuntimeLogger();
  private language: string = 'ar';

  public setLanguage(lang: string): void {
    if (lang === 'ENGLISH' || lang === 'en' || lang === 'en-US') {
      this.language = 'en';
    } else {
      this.language = 'ar';
    }
  }

  public onTurnEvent(callback: (event: TurnEvent) => void): void {
    this.listeners.push(callback);
  }

  public async *transcribeStream(audioStream: AsyncIterable<Buffer | string>): AsyncGenerator<STTResponse, void, unknown> {
    if (!process.env.DEEPGRAM_API_KEY) {
      this.logger.warn('Deepgram STT missing credentials. Aborting stream silently.', { requestId: 'deepgram', timestamp: new Date() });
      return;
    }

    const langParam = this.language || 'ar';
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&vad_events=true&utterance_end_ms=800&language=${langParam}&encoding=linear16&sample_rate=16000`;
    const ws = new WebSocket(wsUrl, {
        headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
        }
    });

    const queue: STTResponse[] = [];
    let isStreamActive = true;
    let turnId = 'turn-' + Date.now();

    const pushEvent = (res: STTResponse) => {
        queue.push(res);
    };

    ws.on('open', () => {
      // Feed audio into deepgram in background
      (async () => {
        try {
          for await (const chunk of audioStream) {
            if (!isStreamActive || ws.readyState !== WebSocket.OPEN) break;
            ws.send(chunk);
          }
        } catch (err: any) {
          this.logger.error('AudioStreamError', { requestId: 'deepgram', error: err, timestamp: new Date() });
        } finally {
          if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'CloseStream' }));
          }
        }
      })();
    });

    ws.on('message', (data: any) => {
        try {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'Results') {
                const transcript = msg.channel.alternatives[0].transcript;
                const confidence = msg.channel.alternatives[0].confidence;
                const isFinal = msg.is_final;
                const detectedLanguage = msg.channel.alternatives[0].languages ? msg.channel.alternatives[0].languages[0] : (this.language === 'en' ? 'en-US' : 'ar-EG');

                if (transcript && transcript.trim() !== '') {
                    pushEvent({
                        ok: true,
                        transcript,
                        metadata: {
                            confidence,
                            latencyMs: 0,
                            isFinal,
                            detectedLanguage
                        }
                    });
                }
            } else if (msg.type === 'SpeechStarted') {
                turnId = 'turn-' + Date.now();
                this.listeners.forEach(cb => cb({ type: 'speech_start', timestamp: new Date(), turnId }));
            } else if (msg.type === 'UtteranceEnd') {
                this.listeners.forEach(cb => cb({ type: 'speech_end', timestamp: new Date(), turnId }));
            }
        } catch (e) {
            // ignore parse errors
        }
    });

    ws.on('error', (err: any) => {
        console.error("Deepgram WS Error:", err.message);
        this.logger.error('DeepgramSTTError', { requestId: 'deepgram', error: err.message, timestamp: new Date() });
    });

    ws.on('close', () => {
        isStreamActive = false;
    });

    // Yield results back to orchestrator
    while (isStreamActive || queue.length > 0) {
      if (queue.length > 0) {
         yield queue.shift()!;
      } else {
         await new Promise(r => setTimeout(r, 10)); // tiny poll
      }
    }
  }
}
