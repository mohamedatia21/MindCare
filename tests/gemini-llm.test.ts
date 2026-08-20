import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiStreamingLLM } from '../src/infrastructure/llm/gemini-provider.js';
import { LLMRequest } from '../src/clinical/types.js';

describe('GeminiStreamingLLM: Provider Integration & Streaming Tests', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gemini-mock-valid-api-key';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('correctly streams chunks and accumulates into StructuredLLMOutput', async () => {
    const provider = new GeminiStreamingLLM();

    const mockChunks = [
      { id: 'g1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'أهلاً ' }, finish_reason: null }] },
      { id: 'g2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'بيك، ' }, finish_reason: null }] },
      { id: 'g3', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'أنا هنا لمساعدتك.' }, finish_reason: null }] },
      { id: 'g4', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
    ];

    async function* createStream() {
      for (const chunk of mockChunks) {
        yield chunk;
      }
    }

    vi.spyOn((provider as any).client.chat.completions, 'create').mockResolvedValue(createStream() as any);

    const request: LLMRequest = {
      systemPolicy: 'Test policy',
      contextData: '{}',
      userMessage: 'مرحباً'
    };

    const output = await provider.generateResponse(request);

    expect(output).toBeDefined();
    expect(output.response).toBe('أهلاً بيك، أنا هنا لمساعدتك.');
    expect(output.intent).toBe('conversational');
    expect(output.safetyRelevant).toBe(false);
  });

  it('correctly captures tool call requests from Gemini stream', async () => {
    const provider = new GeminiStreamingLLM();

    const mockToolChunks = [
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: {
                name: 'KNOWLEDGE_BASE_SEARCH',
                arguments: '{"query":"who depression"}'
              }
            }]
          }
        }]
      }
    ];

    async function* createStream() {
      for (const chunk of mockToolChunks) {
        yield chunk;
      }
    }

    vi.spyOn((provider as any).client.chat.completions, 'create').mockResolvedValue(createStream() as any);

    const request: LLMRequest = {
      systemPolicy: 'Clinical policy',
      contextData: '{}',
      userMessage: 'ما هو الاكتئاب وفق الدليل؟'
    };

    const output = await provider.generateResponse(request);

    expect(output.intent).toBe('tool_call');
    expect(output.requestedTool).toBeDefined();
    expect(output.requestedTool?.toolName).toBe('KNOWLEDGE_BASE_SEARCH');
    expect(output.requestedTool?.arguments).toEqual({ query: 'who depression' });
  });

  it('re-throws transport failure to allow fallback handler engagement', async () => {
    const provider = new GeminiStreamingLLM();

    async function* failingStream() {
      yield { choices: [{ delta: { content: 'Partial...' } }] };
      throw new Error('Gemini API rate limit exceeded');
    }

    vi.spyOn((provider as any).client.chat.completions, 'create').mockResolvedValue(failingStream() as any);

    const request: LLMRequest = { systemPolicy: '', contextData: '', userMessage: 'test' };
    
    await expect(provider.generateResponse(request)).rejects.toThrow('Gemini API rate limit exceeded');
  });
});
