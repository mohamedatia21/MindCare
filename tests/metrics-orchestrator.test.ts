import { describe, it, expect, vi } from 'vitest';
import { StreamingMindCareRuntime } from '../src/core/streaming-orchestrator.js';
import { MockStreamingSTTProvider, MockStreamingTTSProvider } from '../src/infrastructure/voice/mock-providers.js';
import { VoiceStateMachine } from '../src/core/voice/voice-state-machine.js';
import { RuntimeLogger } from '../src/observability/runtime-logger.js';
import { MetricsCollector } from '../src/observability/metrics-collector.js';
import { Actor, ContextPackage } from '../src/memory/types.js';

describe('MetricsCollector Integration in StreamingOrchestrator', () => {
  it('Records turn latency with plausible values on successful turn', async () => {
    const stt = new MockStreamingSTTProvider();
    const tts = new MockStreamingTTSProvider();
    const stateMachine = new VoiceStateMachine();
    const logger = new RuntimeLogger();
    const metricsCollector = new MetricsCollector();

    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    const recordSpy = vi.spyOn(metricsCollector, 'recordTurnLatency').mockImplementation(() => {});

    const mockOrchestrator = {
       processRequest: vi.fn().mockImplementation(async () => {
         await new Promise(r => setTimeout(r, 10)); // simulate LLM delay
         return { ok: true, value: "Response text" };
       })
    } as any;

    const streamingOrchestrator = new StreamingMindCareRuntime(
       mockOrchestrator, stt, tts, stateMachine, logger, metricsCollector
    );

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { 
      CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] 
    };

    async function* mockAudioStream() {
       yield "Hello ";
       yield "MindCare.";
    }

    // Force speech_end to simulate the user finishing speaking
    stt.listeners.push((event) => {
      if (event.type === 'speech_start') {
        setTimeout(() => {
          stt.listeners.forEach(cb => cb({ type: 'speech_end', timestamp: new Date(), turnId: 'turn-1' }));
        }, 10);
      }
    });

    await streamingOrchestrator.processAudioStream(mockAudioStream(), actor, context);

    expect(recordSpy).toHaveBeenCalledTimes(1);

    const callArgs = recordSpy.mock.calls[0]?.[0];
    if (!callArgs) throw new Error("Call args not found");
    
    // Validate plausible values
    expect(callArgs.totalTurnMs).toBeGreaterThan(0);
    expect(callArgs.ttstMs).toBeGreaterThan(0);
    expect(callArgs.ttfaMs || 0).toBeGreaterThanOrEqual(callArgs.ttstMs || 0);
    expect(callArgs.ttfaMs || 0).toBeLessThanOrEqual(callArgs.totalTurnMs || 0);
    expect(callArgs.bargeInTriggered).toBe(false);
    expect(callArgs.turnId).toBeDefined();
    
    expect(isNaN(callArgs.ttfaMs as number)).toBe(false);
    expect(isNaN(callArgs.totalTurnMs as number)).toBe(false);

    console.log("RAW SPY CALL ARGUMENTS:", JSON.stringify(callArgs, null, 2));
  });

  it('Skips recording latency if orchestrator fails mid-way', async () => {
    const stt = new MockStreamingSTTProvider();
    const tts = new MockStreamingTTSProvider();
    const stateMachine = new VoiceStateMachine();
    const logger = new RuntimeLogger();
    const metricsCollector = new MetricsCollector();

    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const recordSpy = vi.spyOn(metricsCollector, 'recordTurnLatency');

    const mockOrchestrator = {
       processRequest: vi.fn().mockResolvedValue({ ok: false, error: new Error('LLM Failed') })
    } as any;

    const streamingOrchestrator = new StreamingMindCareRuntime(
       mockOrchestrator, stt, tts, stateMachine, logger, metricsCollector
    );

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

    async function* mockAudioStream() {
       yield "Hello.";
    }

    await streamingOrchestrator.processAudioStream(mockAudioStream(), actor, context);

    expect(recordSpy).not.toHaveBeenCalled();
    expect(stateMachine.getState()).toBe('IDLE');
  });
});
