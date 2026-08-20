import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokStreamingLLM } from '../src/infrastructure/llm/grok-provider.js';
import { LLMRequest } from '../src/clinical/types.js';

describe('GrokStreamingLLM: Provider Integration & Streaming Tests', () => {
  const originalApiKey = process.env.GROK_API_KEY;

  beforeEach(() => {
    process.env.GROK_API_KEY = 'xai-mock-valid-api-key';
  });

  afterEach(() => {
    process.env.GROK_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('correctly streams chunks and accumulates into StructuredLLMOutput', async () => {
    const provider = new GrokStreamingLLM();

    const mockChunks = [
      { id: 'x1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'أنا ' }, finish_reason: null }] },
      { id: 'x2', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'معاك ' }, finish_reason: null }] },
      { id: 'x3', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'وبسمعك.' }, finish_reason: null }] },
      { id: 'x4', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
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
      userMessage: 'حاسس بضيق'
    };

    const output = await provider.generateResponse(request);

    expect(output).toBeDefined();
    expect(output.response).toBe('أنا معاك وبسمعك.');
    expect(output.intent).toBe('conversational');
    expect(output.safetyRelevant).toBe(false);
  });

  it('correctly captures tool call requests from Grok stream', async () => {
    const provider = new GrokStreamingLLM();

    const mockToolChunks = [
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: {
                name: 'WEB_MEDICAL_SEARCH',
                arguments: '{"query":"mayo clinic panic attack"}'
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
      userMessage: 'ما هي أعراض نوبة الهلع؟'
    };

    const output = await provider.generateResponse(request);

    expect(output.intent).toBe('tool_call');
    expect(output.requestedTool).toBeDefined();
    expect(output.requestedTool?.toolName).toBe('WEB_MEDICAL_SEARCH');
    expect(output.requestedTool?.arguments).toEqual({ query: 'mayo clinic panic attack' });
  });

  it('re-throws transport failure to allow fallback handler engagement', async () => {
    const provider = new GrokStreamingLLM();

    async function* failingStream() {
      yield { choices: [{ delta: { content: 'Partial...' } }] };
      throw new Error('xAI API timeout');
    }

    vi.spyOn((provider as any).client.chat.completions, 'create').mockResolvedValue(failingStream() as any);

    const request: LLMRequest = { systemPolicy: '', contextData: '', userMessage: 'test' };
    
    await expect(provider.generateResponse(request)).rejects.toThrow('xAI API timeout');
  });
});
