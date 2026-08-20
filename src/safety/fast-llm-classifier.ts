import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { SafetyClassification, SafetySignals } from './types.js';
import { StructuredSafetyClassifier } from './classifier-interface.js';
import { RuntimeLogger } from '../observability/runtime-logger.js';
import { OpenAI } from 'openai';

interface LLMClientConfig {
  client: OpenAI;
  model: string;
  provider: 'gemini' | 'grok' | 'openai';
}

/**
 * Multilingual Semantic Safety Classifier (Agent 2) (Arabic, Egyptian Arabic, Arabizi, English).
 * Evaluates nuanced crisis signals, indirect self-harm, and hopelessness.
 * Enforces strictly NON-DIAGNOSTIC output.
 * 
 * Supports Gemini & Grok with seamless provider fallback and local deterministic regex fallback.
 */
export class FastLLMSafetyClassifier implements StructuredSafetyClassifier {
  private logger = new RuntimeLogger();
  private primaryClient: LLMClientConfig | null = null;
  private fallbackClient: LLMClientConfig | null = null;

  constructor(apiKey?: string) {
    this.initializeClients(apiKey);
  }

  private initializeClients(explicitKey?: string) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const grokKey = process.env.GROK_API_KEY;
    const openAiKey = explicitKey || process.env.OPENAI_API_KEY;

    const clients: LLMClientConfig[] = [];

    if (geminiKey) {
      clients.push({
        client: new OpenAI({
          apiKey: geminiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          defaultHeaders: { 'x-goog-api-key': geminiKey }
        }),
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        provider: 'gemini'
      });
    }

    if (grokKey) {
      clients.push({
        client: new OpenAI({
          apiKey: grokKey,
          baseURL: 'https://api.x.ai/v1'
        }),
        model: process.env.GROK_MODEL || 'grok-2-latest',
        provider: 'grok'
      });
    }

    if (openAiKey) {
      const isGroq = openAiKey.startsWith('gsk_');
      clients.push({
        client: new OpenAI({
          apiKey: openAiKey,
          baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
        }),
        model: isGroq ? (process.env.OPENAI_MODEL || 'openai/gpt-oss-120b') : 'gpt-4o-mini',
        provider: 'openai'
      });
    }

    const primaryPref = process.env.PRIMARY_LLM_PROVIDER || 'openai';
    if (clients.length > 1) {
      const idx = clients.findIndex(c => c.provider === primaryPref || (primaryPref === 'openai' && c.provider === 'openai'));
      if (idx > 0) {
        const [preferred] = clients.splice(idx, 1);
        if (preferred) clients.unshift(preferred);
      }
    }

    this.primaryClient = clients[0] || null;
    this.fallbackClient = clients[1] || null;
  }

  async classify(input: UnifiedInput, l1Signals: SafetySignals): Promise<Result<SafetyClassification, SafetyError>> {
    // If L1 already flagged prompt injection or critical, reflect it immediately
    if (l1Signals.categories.includes('prompt_injection')) {
      return ok({
        state: 'CRISIS',
        confidence: 0.95,
        signalCategories: ['prompt_injection'],
        requiresEscalation: true
      });
    }

    const text = input.text.trim();
    if (!text) {
      return ok({
        state: 'SAFE',
        confidence: 1.0,
        signalCategories: ['none'],
        requiresEscalation: false
      });
    }

    // If no live LLM client is available, execute local deterministic semantic heuristic (Arabic + Arabizi aware)
    if (!this.primaryClient) {
      return this.heuristicSemanticScan(text, l1Signals);
    }

    const prompt = `You are a clinical safety triage classifier for a mental health voice assistant.
Your task is to analyze the user's input for suicide risk, self-harm, emergency distress, or intent to die.
You must understand Modern Standard Arabic, Egyptian Colloquial Arabic (العامية المصرية), Arabizi/Franco-Arab (e.g. "mesh 3ayez a3eesh", "m5noo2"), and English.

CRITICAL INVARIANTS:
1. DO NOT diagnose or provide treatment.
2. If the user expresses explicit or implied desire to die, end life, severe hopelessness, or inability to stay safe, classify as CRISIS or ELEVATED.
3. If discussing fiction/movies or expressing common frustration without danger, classify as SAFE.

Return ONLY a JSON object with this exact schema:
{
  "state": "SAFE" | "ELEVATED" | "CRISIS",
  "confidence": number between 0.0 and 1.0,
  "signalCategories": string[],
  "requiresEscalation": boolean
}`;

    // Try primary LLM provider
    try {
      return await this.executeClassification(this.primaryClient, prompt, text);
    } catch (primaryErr: any) {
      this.logger.warn(`PrimarySafetyClassifierFailed: ${primaryErr.message}`, {
        requestId: 'safety-classifier',
        provider: this.primaryClient.provider,
        timestamp: new Date()
      });

      // Try fallback provider if available
      if (this.fallbackClient) {
        try {
          this.logger.info(`EngagingFallbackSafetyClassifier: ${this.fallbackClient.provider}`, {
            requestId: 'safety-classifier',
            timestamp: new Date()
          });
          return await this.executeClassification(this.fallbackClient, prompt, text);
        } catch (fallbackErr: any) {
          this.logger.error(`FallbackSafetyClassifierFailed: ${fallbackErr.message}`, {
            requestId: 'safety-classifier',
            provider: this.fallbackClient.provider,
            timestamp: new Date()
          });
        }
      }

      // Fallback to local heuristic semantic scan if all LLM providers fail or are rate-limited
      this.logger.warn(`SafetyClassifierFallingBackToHeuristics`, {
        requestId: 'safety-classifier',
        timestamp: new Date()
      });
      return this.heuristicSemanticScan(text, l1Signals);
    }
  }

  private async executeClassification(config: LLMClientConfig, prompt: string, text: string): Promise<Result<SafetyClassification, SafetyError>> {
    const classificationPromise = config.client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0.0,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Safety classification timeout (3000ms)')), 3000)
    );

    const response = await Promise.race([classificationPromise, timeoutPromise]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty classifier response');
    }

    let parsed: SafetyClassification;
    try {
      const match = content.match(/\{[\s\S]*?\}/);
      const jsonStr = match ? match[0] : content.replace(/^```(json)?\n?/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(jsonStr) as SafetyClassification;
    } catch (parseError: any) {
      this.logger.warn(`SafetyClassifierJSONParseFailed: ${parseError.message}`, {
        requestId: 'safety-classifier',
        contentSubset: content.substring(0, 100),
        timestamp: new Date()
      });
      throw new Error(`Malformed JSON from LLM: ${parseError.message}`);
    }

    const state = (parsed.state === 'CRISIS' || parsed.state === 'ELEVATED' || parsed.state === 'SAFE') ? parsed.state : 'SAFE';

    return ok({
      state,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      signalCategories: Array.isArray(parsed.signalCategories) ? parsed.signalCategories : ['none'],
      requiresEscalation: state === 'CRISIS'
    });
  }


  /**
   * Deterministic multilingual fallback semantic scanner for offline/mock test environments
   */
  private heuristicSemanticScan(text: string, l1Signals: SafetySignals): Result<SafetyClassification, SafetyError> {
    const lower = text.toLowerCase();

    // 1. Egyptian Arabic Crisis Nuances & Arabizi
    // "مش عايز أعيش", "تعبت من الدنيا", "عايز أنام ومصحاش", "أنهي كل حاجة", "ماليش لازمة"
    // Arabizi: "mesh 3ayez a3eesh", "ta3abt mn el donia", "3ayez anam w mas7ash", "anhy kol 7aga", "mlesh lazma", "baye3 nafsi"
    const egyptianCrisisRegex = /(مش عايز اعيش|مش عايزة اعيش|مش طايق نفسي|تعبت من الدنيا|عايز انام ومصحاش|عايزة انام ومصحاش|انهي حياتي|اخلص من حياتي|ماليش لازمة في الدنيا|الكل هيرتاح مني|بايع الدنيا|بايع نفسي|mesh 3ayez a3eesh|ta3abt mn el donia|3ayez anam w mas7ash|enhy 7yaty|mlesh lazma|el kol hayerta7 meny)/i;
    
    // 2. Severe Hopelessness & Ambiguous Crisis
    const ambiguousRegex = /(الدنيا ملهاش طعم|مفيش فايدة خلاص|كل البيبان مقفولة|مخنوق ومش قادر اتنفس|m5noo2|mafeesh fayda)/i;

    if (egyptianCrisisRegex.test(lower)) {
      return ok({
        state: 'CRISIS',
        confidence: 0.95,
        signalCategories: ['suicide_related', 'severe_distress'],
        requiresEscalation: true
      });
    }

    if (ambiguousRegex.test(lower)) {
      return ok({
        state: 'ELEVATED',
        confidence: 0.85,
        signalCategories: ['ambiguous_distress'],
        requiresEscalation: false
      });
    }

    if (l1Signals.categories.length > 0 && l1Signals.categories[0] !== 'none') {
      return ok({
        state: l1Signals.severityHint === 'CRITICAL' ? 'CRISIS' : 'ELEVATED',
        confidence: 0.8,
        signalCategories: l1Signals.categories,
        requiresEscalation: l1Signals.severityHint === 'CRITICAL'
      });
    }

    return ok({
      state: 'SAFE',
      confidence: 0.95,
      signalCategories: ['none'],
      requiresEscalation: false
    });
  }
}
