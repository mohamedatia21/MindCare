import { LLMProvider, LLMRequest, StructuredLLMOutput } from '../../clinical/types.js';
import { env } from '../../config/environment.js';

export class RealLLMProvider implements LLMProvider {
  private MAX_RETRIES = 2;
  private TIMEOUT_MS = 15000;
  
  constructor() {}

  async healthCheck(): Promise<boolean> {
    return !!env.LLM_API_KEY && !!env.LLM_API_URL;
  }

  async generateResponse(request: LLMRequest): Promise<StructuredLLMOutput> {
    if (!env.LLM_API_KEY || !env.LLM_API_URL) {
      return {
        response: 'REAL LLM PROVIDER: NOT VERIFIED\nReason: No production credentials configured.',
        intent: 'SUPPORT',
        safetyRelevant: false
      };
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.MAX_RETRIES) {
      attempt++;
      try {
        return await this.executeFetch(request);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // Only retry transient network errors or timeouts. Do NOT retry parsing or structured output failures.
        if (this.isTransientError(lastError)) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }

        // Fast fail for non-transient errors
        throw lastError;
      }
    }

    throw new Error(`LLM Request failed after ${this.MAX_RETRIES + 1} attempts. Last error: ${lastError?.message}`);
  }

  private async executeFetch(request: LLMRequest): Promise<StructuredLLMOutput> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(env.LLM_API_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.LLM_API_KEY}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: request.systemPolicy },
            { role: 'system', content: `Context: ${request.contextData}` },
            { role: 'user', content: request.userMessage }
          ],
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          throw new Error(`TRANSIENT_HTTP_${response.status}`);
        }
        throw new Error(`NON_TRANSIENT_HTTP_${response.status}`);
      }

      const text = await response.text();
      return this.parseAndValidate(text);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('TRANSIENT_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isTransientError(err: Error): boolean {
    if (err.message.startsWith('TRANSIENT_')) return true;
    if (err.message.includes('ECONNRESET')) return true;
    if (err.message.includes('ETIMEDOUT')) return true;
    return false;
  }

  private parseAndValidate(rawResponse: string): StructuredLLMOutput {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      throw new Error("MALFORMED_JSON");
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error("INVALID_JSON_SHAPE");
    }

    const obj = parsed as Record<string, unknown>;

    // We expect the provider to wrap in `choices[0].message.content` (OpenAI style)
    let contentString: string | undefined;
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
       const message = obj.choices[0].message as Record<string, unknown> | undefined;
       if (message && typeof message.content === 'string') {
          contentString = message.content;
       }
    } else if (typeof obj.response === 'string') {
       // Direct JSON style
       contentString = rawResponse; 
    }

    if (!contentString) {
      throw new Error("MISSING_CONTENT_FIELD");
    }

    // Now parse the structured inner JSON
    let inner: unknown;
    try {
       // If the LLM returned the JSON object directly (e.g. not wrapped), try parsing contentString
       // If it's already an object, use it directly (if we hit the else-if above)
       if (typeof obj.response === 'string') {
          inner = obj;
       } else {
          inner = JSON.parse(contentString);
       }
    } catch {
      throw new Error("MALFORMED_INNER_JSON");
    }

    if (typeof inner !== 'object' || inner === null) {
      throw new Error("INVALID_INNER_JSON_SHAPE");
    }

    const output = inner as Record<string, unknown>;

    if (typeof output.response !== 'string') {
      throw new Error("SCHEMA_ERROR_MISSING_RESPONSE");
    }
    
    if (typeof output.intent !== 'string') {
       throw new Error("SCHEMA_ERROR_MISSING_INTENT");
    }

    const structured: StructuredLLMOutput = {
      response: output.response,
      intent: output.intent,
      safetyRelevant: typeof output.safetyRelevant === 'boolean' ? output.safetyRelevant : false
    };

    if (output.requestedTool && typeof output.requestedTool === 'object') {
       const tool = output.requestedTool as Record<string, unknown>;
       if (typeof tool.toolName === 'string' && typeof tool.arguments === 'object' && tool.arguments !== null) {
          structured.requestedTool = {
             toolName: tool.toolName,
             arguments: tool.arguments as Record<string, unknown>
          };
       }
    }

    return structured;
  }
}
