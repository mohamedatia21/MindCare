import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAIStreamingLLM } from '../src/infrastructure/llm/openai-llm.js';
import { LLMRequest } from '../src/clinical/types.js';

describe('OpenAIStreamingLLM: Realistic SDK Mock Integration Tests', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-valid-api-key-for-test';
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('correctly accumulates realistic multi-chunk OpenAI SDK stream into StructuredLLMOutput', async () => {
    const provider = new OpenAIStreamingLLM();

    // Realistic OpenAI ChatCompletionChunk sequence as emitted by official openai SDK
    const mockSdkChunks = [
      { id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'أنا ' }, finish_reason: null }] },
      { id: 'c2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'سامعك ' }, finish_reason: null }] },
      { id: 'c3', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'ومعاك، ' }, finish_reason: null }] },
      { id: 'c4', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'احكيلي براحتك.' }, finish_reason: null }] },
      { id: 'c5', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
    ];

    async function* createSdkStream() {
      for (const chunk of mockSdkChunks) {
        yield chunk;
      }
    }

    // Intercept openai.chat.completions.create to return the SDK stream
    vi.spyOn((provider as any).openai.chat.completions, 'create').mockResolvedValue(createSdkStream() as any);

    const request: LLMRequest = {
      systemPolicy: 'Test policy',
      contextData: '{}',
      userMessage: 'أنا متضايق'
    };

    const output = await provider.generateResponse(request);

    expect(output).toBeDefined();
    expect(output.response).toBe('أنا سامعك ومعاك، احكيلي براحتك.');
    expect(output.intent).toBe('conversational');
    expect(output.safetyRelevant).toBe(false);
  });

  it('correctly streams individual tokens in real-time via generateStreamingResponse', async () => {
    const provider = new OpenAIStreamingLLM();

    const mockSdkChunks = [
      { choices: [{ delta: { content: 'Hello ' } }] },
      { choices: [{ delta: { content: 'world' } }] },
      { choices: [{ delta: { content: '!' } }] }
    ];

    async function* createSdkStream() {
      for (const chunk of mockSdkChunks) {
        yield chunk;
      }
    }

    vi.spyOn((provider as any).openai.chat.completions, 'create').mockResolvedValue(createSdkStream() as any);

    const request: LLMRequest = { systemPolicy: '', contextData: '', userMessage: 'test' };
    const gen = provider.generateStreamingResponse(request);

    const receivedTokens: string[] = [];
    let next = await gen.next();
    while (!next.done) {
      receivedTokens.push(next.value);
      next = await gen.next();
    }

    expect(receivedTokens).toEqual(['Hello ', 'world', '!']);
    expect(next.done).toBe(true);
    expect(next.value).toEqual({
      response: 'Hello world!',
      intent: 'conversational',
      safetyRelevant: false
    });
  });

  it('surfaces mid-stream transport failures cleanly without unhandled rejection or silent drop', async () => {
    const provider = new OpenAIStreamingLLM();

    async function* failingSdkStream() {
      yield { choices: [{ delta: { content: 'Partial content before ' } }] };
      yield { choices: [{ delta: { content: 'crash...' } }] };
      throw new Error('EPIPE: Connection closed by remote host');
    }

    vi.spyOn((provider as any).openai.chat.completions, 'create').mockResolvedValue(failingSdkStream() as any);

    const request: LLMRequest = { systemPolicy: '', contextData: '', userMessage: 'test' };
    const output = await provider.generateResponse(request);

    // Error is caught, logged, and surfaced with intent: 'error'
    expect(output).toBeDefined();
    expect(output.intent).toBe('error');
    expect(output.response).toBe('عذراً، حدث خطأ في الاتصال بنموذج الذكاء الاصطناعي، يرجى المحاولة مرة أخرى.');
    expect(output.safetyRelevant).toBe(false);
  });
});
