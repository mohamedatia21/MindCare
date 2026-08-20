import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuntimeLogger, LogMetadata } from '../src/observability/runtime-logger.js';

describe('Phase 4H: Privacy-Preserving Runtime Logger', () => {
  let logger: RuntimeLogger;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new RuntimeLogger();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseMetadata: LogMetadata = {
    requestId: 'req-1',
    timestamp: new Date()
  };

  it('Allows clean metadata to be logged', () => {
    logger.info('Test Event', { ...baseMetadata, safetyState: 'SAFE', skillId: 'SUPPORTIVE_CONVERSATION' });
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('Rejects direct content injection', () => {
    logger.info('Test Event', { ...baseMetadata, content: 'This is a raw user message' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Rejects nested content injection', () => {
    logger.info('Test Event', { ...baseMetadata, someNested: { deep: { message: 'Raw message' } } });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Rejects prompt injection', () => {
    logger.info('Test Event', { ...baseMetadata, prompt: 'System prompt content' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Rejects API key injection', () => {
    logger.info('Test Event', { ...baseMetadata, apiKey: 'sk-12345' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Rejects authorization token injection', () => {
    logger.info('Test Event', { ...baseMetadata, authorization: 'Bearer 123' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Rejects memory content injection', () => {
    logger.info('Test Event', { ...baseMetadata, memoryContent: 'Patient details' });
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('Safely degrades on circular references', () => {
    const circularObj: any = {};
    circularObj.self = circularObj;
    
    logger.info('Test Event', { ...baseMetadata, circular: circularObj });
    // Doesn't crash, and logs successfully since there's no forbidden key
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });
});
