import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FallbackStreamingLLM } from '../src/infrastructure/llm/fallback-provider.js';
import { LLMRequest } from '../src/clinical/types.js';

describe('FallbackStreamingLLM: Primary & Fallback Provider Orchestration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROK_API_KEY = 'grok-key';
    process.env.PRIMARY_LLM_PROVIDER = 'gemini';
    process.env.FALLBACK_LLM_PROVIDER = 'grok';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('correctly uses primary provider (Gemini) when it succeeds', async () => {
    const provider = new FallbackStreamingLLM();
    expect(provider.getPrimaryType()).toBe('gemini');
    expect(provider.getFallbackType()).toBe('grok');

    const primaryMock = vi.spyOn((provider as any).primary, 'generateResponse').mockResolvedValue({
      response: 'Gemini Primary Response',
      intent: 'conversational',
      safetyRelevant: false
    });

    const fallbackMock = vi.spyOn((provider as any).fallback, 'generateResponse');

    const request: LLMRequest = { systemPolicy: '', contextData: '{}', userMessage: 'test' };
    const output = await provider.generateResponse(request);

    expect(output.response).toBe('Gemini Primary Response');
    expect(primaryMock).toHaveBeenCalledOnce();
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it('seamlessly switches to fallback provider (Grok) when primary (Gemini) fails', async () => {
    const provider = new FallbackStreamingLLM();

    // Primary fails with network/rate limit error
    vi.spyOn((provider as any).primary, 'generateResponse').mockRejectedValue(new Error('Gemini 429 Too Many Requests'));

    // Fallback succeeds
    const fallbackMock = vi.spyOn((provider as any).fallback, 'generateResponse').mockResolvedValue({
      response: 'Grok Fallback Response',
      intent: 'conversational',
      safetyRelevant: false
    });

    const request: LLMRequest = { systemPolicy: '', contextData: '{}', userMessage: 'test' };
    const output = await provider.generateResponse(request);

    expect(output.response).toBe('Grok Fallback Response');
    expect(fallbackMock).toHaveBeenCalledOnce();
  });

  it('seamlessly switches streaming generator to fallback provider when primary fails', async () => {
    const provider = new FallbackStreamingLLM();

    async function* failingPrimary() {
      throw new Error('Primary streaming network failure');
      yield '';
    }

    async function* workingFallback() {
      yield 'Fallback ';
      yield 'Token ';
      yield 'Stream';
      return { response: 'Fallback Token Stream', intent: 'conversational', safetyRelevant: false };
    }

    vi.spyOn((provider as any).primary, 'generateStreamingResponse').mockImplementation(failingPrimary as any);
    vi.spyOn((provider as any).fallback, 'generateStreamingResponse').mockImplementation(workingFallback as any);

    const request: LLMRequest = { systemPolicy: '', contextData: '{}', userMessage: 'test' };
    const gen = provider.generateStreamingResponse(request);

    const tokens: string[] = [];
    let next = await gen.next();
    while (!next.done) {
      tokens.push(next.value);
      next = await gen.next();
    }

    expect(tokens).toEqual(['Fallback ', 'Token ', 'Stream']);
    expect(next.value?.response).toBe('Fallback Token Stream');
  });

  it('returns graceful safe Arabic error message if both primary and fallback fail', async () => {
    const provider = new FallbackStreamingLLM();

    vi.spyOn((provider as any).primary, 'generateResponse').mockRejectedValue(new Error('Gemini Down'));
    vi.spyOn((provider as any).fallback, 'generateResponse').mockRejectedValue(new Error('Grok Down'));

    const request: LLMRequest = { systemPolicy: '', contextData: '{}', userMessage: 'test' };
    const output = await provider.generateResponse(request);

    expect(output.intent).toBe('error');
    expect(output.response).toContain('عذراً، حدث خطأ');
    expect(output.safetyRelevant).toBe(false);
  });
});
