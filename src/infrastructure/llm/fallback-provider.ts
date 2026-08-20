import { LLMProvider, StreamingLLMProvider, LLMRequest, StructuredLLMOutput } from '../../clinical/types.js';
import { RuntimeLogger } from '../../observability/runtime-logger.js';
import { GeminiStreamingLLM } from './gemini-provider.js';
import { GrokStreamingLLM } from './grok-provider.js';
import { OpenAIStreamingLLM } from './openai-llm.js';

export type ProviderType = 'gemini' | 'grok' | 'openai';

export interface FallbackLLMConfig {
  primaryProvider?: ProviderType;
  fallbackProvider?: ProviderType;
  geminiApiKey?: string;
  geminiModel?: string;
  grokApiKey?: string;
  grokModel?: string;
}

export function isQuotaError(errMessage: string): boolean {
  const lower = (errMessage || '').toLowerCase();
  return lower.includes('quota') || 
         lower.includes('429') || 
         lower.includes('rate limit') || 
         lower.includes('resource_exhausted') || 
         lower.includes('too many requests') ||
         lower.includes('insufficient_quota') ||
         lower.includes('rate_limit_exceeded');
}

/**
 * Robust provider fallback adapter.
 * Tries the primary provider (Gemini or Grok). If a failure or network timeout occurs,
 * it seamlessly attempts the fallback provider while strictly preserving all safety,
 * clinical policy, skill constraints, and output structures.
 */
export class FallbackStreamingLLM implements StreamingLLMProvider, LLMProvider {
  private primary: StreamingLLMProvider & LLMProvider;
  private fallback: (StreamingLLMProvider & LLMProvider) | null = null;
  private primaryType: ProviderType;
  private fallbackType: ProviderType | null = null;
  private logger = new RuntimeLogger();

  constructor(config?: FallbackLLMConfig) {
    const rawPrimary = config?.primaryProvider || 
      (process.env.PRIMARY_LLM_PROVIDER as ProviderType) || 
      (process.env.GEMINI_API_KEY ? 'gemini' : (process.env.GROK_API_KEY ? 'grok' : 'openai'));

    const rawFallback = config?.fallbackProvider || 
      (process.env.FALLBACK_LLM_PROVIDER as ProviderType) || 
      (rawPrimary === 'gemini' && process.env.GROK_API_KEY ? 'grok' : (rawPrimary === 'grok' && process.env.GEMINI_API_KEY ? 'gemini' : undefined));

    this.primaryType = rawPrimary;
    this.primary = this.createProvider(rawPrimary, config);

    if (rawFallback && rawFallback !== rawPrimary) {
      this.fallbackType = rawFallback;
      this.fallback = this.createProvider(rawFallback, config);
    }
  }

  private createProvider(type: ProviderType, config?: FallbackLLMConfig): StreamingLLMProvider & LLMProvider {
    switch (type) {
      case 'gemini':
        return new GeminiStreamingLLM(config?.geminiApiKey, config?.geminiModel);
      case 'grok':
        return new GrokStreamingLLM(config?.grokApiKey, config?.grokModel);
      case 'openai':
      default:
        return new OpenAIStreamingLLM();
    }
  }

  public getPrimaryType(): ProviderType {
    return this.primaryType;
  }

  public getFallbackType(): ProviderType | null {
    return this.fallbackType;
  }

  public async generateResponse(request: LLMRequest): Promise<StructuredLLMOutput> {
    try {
      return await this.primary.generateResponse(request);
    } catch (primaryErr: any) {
      this.logger.warn('PrimaryLLMProviderFailed', {
        requestId: 'fallback-llm',
        primaryProvider: this.primaryType,
        error: primaryErr.message,
        timestamp: new Date()
      });

      if (this.fallback) {
        try {
          this.logger.info('EngagingFallbackLLMProvider', {
            requestId: 'fallback-llm',
            fallbackProvider: this.fallbackType,
            timestamp: new Date()
          });
          return await this.fallback.generateResponse(request);
        } catch (fallbackErr: any) {
          this.logger.error('FallbackLLMProviderFailed', {
            requestId: 'fallback-llm',
            fallbackProvider: this.fallbackType,
            error: fallbackErr.message,
            timestamp: new Date()
          });
        }
      }

      const lastError = (this.fallback ? 'Fallback & Primary failed' : primaryErr.message) || '';
      const isQuota = isQuotaError(primaryErr.message) || isQuotaError(lastError);

      const responseMsg = isQuota
        ? '⏳ تم الوصول إلى الحد الأقصى للاستخدام اليومي (Quota Limit). سيتم إعادة ضبط وتجديد الحصة تلقائياً مع بداية الدورة القادمة (عادة خلال الساعة القادمة أو بداية اليوم الجديد). شكراً لصبرك ووجودك معنا!'
        : 'عذراً، حدث خطأ في الاتصال بنموذج الذكاء الاصطناعي، يرجى المحاولة مرة أخرى.';

      return {
        response: responseMsg,
        intent: isQuota ? 'quota_exceeded' : 'error',
        safetyRelevant: false
      };
    }
  }

  public async *generateStreamingResponse(request: LLMRequest): AsyncGenerator<string, StructuredLLMOutput, void> {
    try {
      const gen = this.primary.generateStreamingResponse(request);
      let yieldedAny = false;
      let result = await gen.next();
      
      while (!result.done) {
        yieldedAny = true;
        yield result.value;
        result = await gen.next();
      }

      return result.value;
    } catch (primaryErr: any) {
      this.logger.warn('PrimaryLLMStreamingFailed', {
        requestId: 'fallback-llm',
        primaryProvider: this.primaryType,
        error: primaryErr.message,
        timestamp: new Date()
      });

      if (this.fallback) {
        try {
          this.logger.info('EngagingFallbackLLMStreaming', {
            requestId: 'fallback-llm',
            fallbackProvider: this.fallbackType,
            timestamp: new Date()
          });
          const fallbackGen = this.fallback.generateStreamingResponse(request);
          let result = await fallbackGen.next();
          while (!result.done) {
            yield result.value;
            result = await fallbackGen.next();
          }
          return result.value;
        } catch (fallbackErr: any) {
          this.logger.error('FallbackLLMStreamingFailed', {
            requestId: 'fallback-llm',
            fallbackProvider: this.fallbackType,
            error: fallbackErr.message,
            timestamp: new Date()
          });
        }
      }

      const isQuota = isQuotaError(primaryErr.message);
      const errorMsg = isQuota
        ? '⏳ تم الوصول إلى الحد الأقصى للاستخدام اليومي (Quota Limit). سيتم إعادة ضبط وتجديد الحصة تلقائياً مع بداية الدورة القادمة (عادة خلال الساعة القادمة أو بداية اليوم الجديد). شكراً لصبرك ووجودك معنا!'
        : 'عذراً، حدث خطأ في الاتصال بنموذج الذكاء الاصطناعي، يرجى المحاولة مرة أخرى.';

      yield errorMsg;
      return {
        response: errorMsg,
        intent: isQuota ? 'quota_exceeded' : 'error',
        safetyRelevant: false
      };
    }
  }

  public async healthCheck(): Promise<boolean> {
    const primaryOk = await this.primary.healthCheck();
    if (primaryOk) return true;
    if (this.fallback) {
      return await this.fallback.healthCheck();
    }
    return false;
  }
}
