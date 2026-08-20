import { OpenAI } from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers';
import { LLMProvider, StreamingLLMProvider, LLMRequest, StructuredLLMOutput } from '../../clinical/types.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';

/**
 * xAI Grok LLM Provider adapter using xAI's OpenAI-compatible endpoint.
 * Conforms strictly to the existing StreamingLLMProvider and LLMProvider contracts.
 */
export class GrokStreamingLLM implements StreamingLLMProvider, LLMProvider {
  private client: OpenAI | null = null;
  private model: string;
  private logger = new RuntimeLogger();

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GROK_API_KEY;
    this.model = model || process.env.GROK_MODEL || 'grok-2-latest';
    if (key) {
      this.client = wrapOpenAI(new OpenAI({
        apiKey: key,
        baseURL: 'https://api.x.ai/v1'
      }));
    }
  }

  public async generateResponse(request: LLMRequest): Promise<StructuredLLMOutput> {
    const gen = this.generateStreamingResponse(request);
    let result = await gen.next();
    while (!result.done) {
      result = await gen.next();
    }
    return result.value;
  }

  public async *generateStreamingResponse(request: LLMRequest): AsyncGenerator<string, StructuredLLMOutput, void> {
    if (!this.client) {
      this.logger.warn('Grok missing credentials. Aborting.', { requestId: 'grok', timestamp: new Date() });
      return { response: '', intent: 'unknown', safetyRelevant: false };
    }

    try {
      let historyMessages: any[] = [];
      try {
        const parts = request.contextData.split('\n[TOOL_CALL:');
        const jsonPart = parts[0];

        const parsedContext = JSON.parse(jsonPart || '{}');
        if (parsedContext && Array.isArray(parsedContext.CURRENT_SESSION)) {
          historyMessages = parsedContext.CURRENT_SESSION
            .filter((m: any) => m.content && m.content.trim() !== '')
            .map((m: any) => ({
              role: m.source === 'USER_INPUT' ? 'user' : 'assistant',
              content: m.content
            }));
        }

        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i] || '';
            const subParts = part.split(']\n[TOOL_RESULT:');
            if (subParts.length === 2) {
              const toolCallStr = (subParts[0] || '').trim();
              const toolResultStr = (subParts[1] || '').replace(']', '').trim();

              try {
                const tc = JSON.parse(toolCallStr);
                const callId = `call_${Date.now()}_${i}`;

                historyMessages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: callId,
                    type: 'function',
                    function: {
                      name: tc.toolName,
                      arguments: JSON.stringify(tc.arguments || {})
                    }
                  }]
                });

                historyMessages.push({
                  role: 'tool',
                  tool_call_id: callId,
                  name: tc.toolName,
                  content: toolResultStr
                });
              } catch (e) {}
            }
          }
        }
      } catch (e) {}

      const currentMessageObj = { role: 'user' as const, content: request.userMessage || ' ' };
      if (historyMessages.length > 0 &&
          historyMessages[historyMessages.length - 1].role === 'user' &&
          historyMessages[historyMessages.length - 1].content === currentMessageObj.content) {
        historyMessages.pop();
      }

      const messages = [
        { role: 'system' as const, content: request.systemPolicy },
        ...historyMessages,
        currentMessageObj
      ];

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "KNOWLEDGE_BASE_SEARCH",
              description: "Search the knowledge base for medical information.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The search query" }
                },
                required: ["query"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "WEB_MEDICAL_SEARCH",
              description: "Search external medical websites (Mayo Clinic, WHO, WebMD) when the WHO mhGAP guide does not contain the answer.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The search query" }
                },
                required: ["query"]
              }
            }
          }
        ]
      });

      let fullContent = '';
      let toolName = '';
      let toolArgs = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          const tc = delta.tool_calls[0];
          if (tc && tc.function?.name) toolName += tc.function.name;
          if (tc && tc.function?.arguments) toolArgs += tc.function.arguments;
        }

        const content = delta?.content || '';
        if (content) {
          fullContent += content;
          yield content;
        }
      }

      if (toolName) {
        let args = {};
        try { args = JSON.parse(toolArgs); } catch (e) {}
        return {
          response: fullContent,
          intent: 'tool_call',
          safetyRelevant: false,
          requestedTool: {
            toolName,
            arguments: args
          }
        };
      }

      return {
        response: fullContent,
        intent: 'conversational',
        safetyRelevant: false
      };

    } catch (err) {
      this.logger.error('GrokStreamingError', { requestId: 'grok', error: err, timestamp: new Date() });
      throw err; // Allow outer fallback wrapper to catch and attempt fallback
    }
  }

  public async healthCheck(): Promise<boolean> {
    return !!process.env.GROK_API_KEY;
  }
}
