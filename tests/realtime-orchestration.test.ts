import { describe, it, expect, vi } from 'vitest';
import { StreamingMindCareRuntime } from '../src/core/streaming-orchestrator.js';
import { MockStreamingSTTProvider, MockStreamingTTSProvider } from '../src/infrastructure/voice/mock-providers.js';
import { VoiceStateMachine } from '../src/core/voice/voice-state-machine.js';
import { RuntimeLogger } from '../src/observability/runtime-logger.js';
import { MetricsCollector } from '../src/observability/metrics-collector.js';
import { Actor, ContextPackage } from '../src/memory/types.js';

describe('Phase 5.5: Real-Time Orchestration & Barge-In', () => {
  it('Immediately cancels TTS and transitions to LISTENING on Barge-In', async () => {
    const stt = new MockStreamingSTTProvider();
    const tts = new MockStreamingTTSProvider();
    const stateMachine = new VoiceStateMachine();
    const logger = new RuntimeLogger();

    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    const mockOrchestrator = {
       processRequest: vi.fn().mockResolvedValue({ ok: true, value: "I am speaking a long sentence now." })
    } as any;

    const streamingOrchestrator = new StreamingMindCareRuntime(
       mockOrchestrator,
       stt,
       tts,
       stateMachine,
       logger,
       new MetricsCollector()
    );

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { 
      CURRENT_SESSION: [], 
      USER_PREFERENCES: [], 
      APPROVED_PROGRESS: [], 
      RELEVANT_CONTEXT: [], 
      SAFETY_CONTEXT: [] 
    };

    // We can simulate an async audio stream
    async function* mockAudioStream() {
       yield "Hello ";
       yield "MindCare.";
    }

    // Start the process (it will transcribe -> generate -> speak)
    const streamPromise = streamingOrchestrator.processAudioStream(mockAudioStream(), actor, context);

    // Wait a tiny bit for it to enter the SPEAKING state
    await new Promise(r => setTimeout(r, 10));

    // Simulate barge-in by firing the speech_start event while it's processing or speaking
    // Hacky internal test invocation since the provider usually triggers this
    // @ts-ignore
    stt.listeners.forEach(cb => cb({ type: 'speech_start', timestamp: new Date(), turnId: 'barge-in-turn' }));

    // Verify it immediately transitioned to LISTENING
    expect(stateMachine.getState()).toBe('LISTENING');

    await streamPromise;

    // Verify logger captured the barge in
    expect(logger.warn).toHaveBeenCalledWith(
       'BargeInDetected', 
       expect.objectContaining({ newTurn: 'barge-in-turn' })
    );
  });

  it('Immediately aborts generation if crisis word is detected in STT stream', async () => {
    const stt = new MockStreamingSTTProvider();
    const tts = new MockStreamingTTSProvider();
    const stateMachine = new VoiceStateMachine();
    const logger = new RuntimeLogger();

    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    const mockOrchestrator = {
       processRequest: vi.fn()
    } as any;

    const streamingOrchestrator = new StreamingMindCareRuntime(
       mockOrchestrator,
       stt,
       tts,
       stateMachine,
       logger,
       new MetricsCollector()
    );

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

    async function* crisisAudioStream() {
       yield "I am feeling very sad... ";
       yield "MOCK_CRISIS"; // Special string mock provider looks for
    }

    await streamingOrchestrator.processAudioStream(crisisAudioStream(), actor, context);

    // Orchestrator should NEVER be called with normal logic because crisis was intercepted mid-stream!
    // (Or it would be called with crisis state, depending on implementation. In our mock it short circuits.)
    expect(logger.warn).toHaveBeenCalledWith(
      'StreamingCrisisDetected',
      expect.objectContaining({ text: 'I want to kill myself' })
    );

    // The streaming orchestrator intercepts the crisis early (via the 'break' in the async iterator)
    // and immediately passes the partial transcript to the main MindCareRuntime to handle the crisis.
    expect(mockOrchestrator.processRequest).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'I want to kill myself' }),
      actor,
      context
    );
  });

  it('Processes text chat message through orchestrator and synthesizes audio stream', async () => {
    const stt = new MockStreamingSTTProvider();
    const tts = new MockStreamingTTSProvider();
    const stateMachine = new VoiceStateMachine();
    const logger = new RuntimeLogger();

    const mockOrchestrator = {
       processRequest: vi.fn().mockResolvedValue({ ok: true, value: "أنا سامعك وحاسس بيك، خلينا نتكلم." })
    } as any;

    const streamingOrchestrator = new StreamingMindCareRuntime(
       mockOrchestrator,
       stt,
       tts,
       stateMachine,
       logger,
       new MetricsCollector()
    );

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

    const audioChunks: Buffer[] = [];
    const controlMessages: any[] = [];

    const onAudio = (chunk: Buffer) => {
      audioChunks.push(chunk);
    };

    const onControl = (msg: any) => {
      controlMessages.push(msg);
    };

    const result = await streamingOrchestrator.processTextMessage("أنا حاسس بضغط في الشغل", actor, context, onAudio, onControl);

    expect(result).toBe("أنا سامعك وحاسس بيك، خلينا نتكلم.");
    expect(mockOrchestrator.processRequest).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'أنا حاسس بضغط في الشغل', modality: 'TEXT' }),
      actor,
      context
    );

    // Verify control events were emitted in proper sequence
    const types = controlMessages.map(m => m.type);
    expect(types).toContain('state');
    expect(types).toContain('chat_response');
    expect(types).toContain('audio_start');
    expect(types).toContain('audio_end');

    const chatResponseMsg = controlMessages.find(m => m.type === 'chat_response');
    expect(chatResponseMsg.text).toBe("أنا سامعك وحاسس بيك، خلينا نتكلم.");

    // Verify audio chunks were synthesized and streamed to onAudio
    expect(audioChunks.length).toBeGreaterThan(0);
    expect(stateMachine.getState()).toBe('LISTENING');
  });
});
