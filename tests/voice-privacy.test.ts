import { describe, it, expect, vi } from 'vitest';
import { RuntimeLogger } from '../src/observability/runtime-logger.js';

describe('Phase 5: Voice Privacy & Observability', () => {
  it('Redacts forbidden voice fields from logs (audio, transcript)', () => {
    const logger = new RuntimeLogger();
    
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // This metadata contains forbidden fields
    logger.info('VoiceInteraction', {
      requestId: 'r1',
      timestamp: new Date(),
      audio: 'base64audio...',
      transcript: 'I am feeling very sad today.',
      metadata: {
        latencyMs: 150
      }
    });

    // Should have caught the forbidden fields and emitted a warning, NOT the actual log
    expect(warnSpy).toHaveBeenCalled();
    const warnMessage = warnSpy.mock.calls[0]![0];
    expect(warnMessage).toContain('forbidden sensitive content');
    
    expect(logSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('Allows metadata-only voice logs', () => {
    const logger = new RuntimeLogger();
    
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Safe metadata only
    logger.info('VoiceInteraction', {
      requestId: 'r2',
      modality: 'VOICE',
      timestamp: new Date(),
      metadata: {
        latencyMs: 150,
        provider: 'mock-stt'
      }
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    const logMessage = logSpy.mock.calls[0]![0];
    expect(logMessage).toContain('VoiceInteraction');
    expect(logMessage).toContain('VOICE');
    expect(logMessage).toContain('mock-stt');

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
