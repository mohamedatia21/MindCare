import WebSocket from 'ws';
import { StreamingTTSProvider, TTSResponse } from './tts-interface.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

export class ElevenLabsStreamingTTS implements StreamingTTSProvider {
  private logger = new RuntimeLogger();
  private cancelledTurns = new Set<string>();

  public cancel(turnId: string): void {
    this.cancelledTurns.add(turnId);
  }

  public async *synthesizeStream(textStream: AsyncIterable<string>, turnId: string): AsyncGenerator<TTSResponse, void, unknown> {
    if (!process.env.ELEVENLABS_API_KEY) {
       this.logger.warn('ElevenLabs missing credentials. Aborting stream.', { requestId: turnId, timestamp: new Date() });
       return;
    }

    this.logger.info('ElevenLabsTTSStarted', { requestId: turnId, turnId, timestamp: new Date() });

    // Use a default voice ID for now. Step 5 will replace this with the Ahmad clone ID.
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default Adam
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_multilingual_v2&output_format=pcm_24000`;
    
    const ws = new WebSocket(wsUrl);
    const queue: TTSResponse[] = [];
    let isStreamActive = true;
    let isWsOpen = false;

    // Send initial configuration message once WS is open
    ws.on('open', () => {
        isWsOpen = true;
        ws.send(JSON.stringify({
            text: " ",
            voice_settings: { stability: 0.5, similarity_boost: 0.8 },
            xi_api_key: process.env.ELEVENLABS_API_KEY
        }));

        // Start reading text stream
        (async () => {
            try {
                for await (const chunk of textStream) {
                    if (this.cancelledTurns.has(turnId) || !isWsOpen) break;
                    if (chunk.trim() !== '') {
                        ws.send(JSON.stringify({
                            text: chunk + " ",
                            try_trigger_generation: true
                        }));
                    }
                }
            } catch (err: any) {
                this.logger.error('ElevenLabsTextStreamError', { requestId: turnId, error: err, timestamp: new Date() });
            } finally {
                if (isWsOpen && !this.cancelledTurns.has(turnId)) {
                    ws.send(JSON.stringify({ text: "" })); // End of stream
                }
            }
        })();
    });

    ws.on('message', (data: any) => {
        try {
            const rawMsg = data.toString();
            console.log("ElevenLabs WS msg:", rawMsg.substring(0, 200));
            const msg = JSON.parse(rawMsg);
            if (msg.error) {
                this.logger.error('ElevenLabsWSError', { requestId: turnId, error: msg.error, message: msg.message, timestamp: new Date() });
                isStreamActive = false;
                ws.close();
                return;
            }
            if (msg.audio) {
                const audioBuffer = Buffer.from(msg.audio, 'base64');
                queue.push({
                    ok: true,
                    audioChunk: audioBuffer,
                    metadata: { latencyMs: 0, durationMs: 0 }
                });
            }
            if (msg.isFinal) {
                isStreamActive = false;
                ws.close();
            }
        } catch (e) {
            this.logger.error('ElevenLabsMessageParseError', { requestId: turnId, error: e, timestamp: new Date() });
        }
    });

    ws.on('error', (err: any) => {
        this.logger.error('ElevenLabsTTSError', { requestId: turnId, error: err.message, timestamp: new Date() });
        isStreamActive = false;
    });

    ws.on('close', () => {
        isStreamActive = false;
        isWsOpen = false;
    });

    while (isStreamActive || queue.length > 0) {
        if (this.cancelledTurns.has(turnId)) {
            this.logger.warn('ElevenLabsTTSCancelled', { requestId: turnId, turnId, timestamp: new Date() });
            if (isWsOpen) ws.close();
            break;
        }

        if (queue.length > 0) {
            yield queue.shift()!;
        } else {
            await new Promise(r => setTimeout(r, 10));
        }
    }
  }
}

