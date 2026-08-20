import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastLLMSafetyClassifier } from '../src/safety/fast-llm-classifier.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';

describe('FastLLMSafetyClassifier (Agent 2): Provider Integration & Resilience Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROK_API_KEY = 'grok-key';
    process.env.PRIMARY_LLM_PROVIDER = 'gemini';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('classifies input using primary provider (Gemini)', async () => {
    const classifier = new FastLLMSafetyClassifier();

    vi.spyOn((classifier as any).primaryClient.client.chat.completions, 'create').mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            state: 'SAFE',
            confidence: 0.98,
            signalCategories: ['none'],
            requiresEscalation: false
          })
        }
      }]
    });

    const input: UnifiedInput = {
      inputId: 'inp-1',
      text: 'أشعر ببعض التعب اليوم لكنني بخير',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const result = await classifier.classify(input, { categories: ['none'], matchedRules: [], confidence: 1.0, severityHint: 'NONE' } as any);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('SAFE');
      expect(result.value.confidence).toBe(0.98);
      expect(result.value.requiresEscalation).toBe(false);
    }
  });

  it('falls back to secondary provider (Grok) when primary provider fails', async () => {
    const classifier = new FastLLMSafetyClassifier();

    // Primary fails
    vi.spyOn((classifier as any).primaryClient.client.chat.completions, 'create').mockRejectedValue(new Error('Gemini API Error'));

    // Fallback succeeds
    const fallbackMock = vi.spyOn((classifier as any).fallbackClient.client.chat.completions, 'create').mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            state: 'CRISIS',
            confidence: 0.99,
            signalCategories: ['suicide_related'],
            requiresEscalation: true
          })
        }
      }]
    });

    const input: UnifiedInput = {
      inputId: 'inp-2',
      text: 'مش عايز أكمل في الدنيا دي',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const result = await classifier.classify(input, { categories: ['none'], matchedRules: [], confidence: 1.0, severityHint: 'NONE' } as any);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('CRISIS');
      expect(result.value.requiresEscalation).toBe(true);
    }
    expect(fallbackMock).toHaveBeenCalledOnce();
  });

  it('uses local deterministic semantic heuristic when no API keys are present (Offline / Mock mode)', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const classifier = new FastLLMSafetyClassifier();

    // Test Egyptian Arabic crisis phrase
    const crisisInput: UnifiedInput = {
      inputId: 'inp-3',
      text: 'مش عايز اعيش ماليش لازمة في الدنيا',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const crisisResult = await classifier.classify(crisisInput, { categories: ['none'], matchedRules: [], confidence: 1.0, severityHint: 'NONE' } as any);
    expect(crisisResult.ok).toBe(true);
    if (crisisResult.ok) {
      expect(crisisResult.value.state).toBe('CRISIS');
      expect(crisisResult.value.requiresEscalation).toBe(true);
    }

    // Test Franco-Arab / Arabizi phrase
    const arabiziInput: UnifiedInput = {
      inputId: 'inp-4',
      text: 'mesh 3ayez a3eesh ta3abt mn el donia',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const arabiziResult = await classifier.classify(arabiziInput, { categories: ['none'], matchedRules: [], confidence: 1.0, severityHint: 'NONE' } as any);
    expect(arabiziResult.ok).toBe(true);
    if (arabiziResult.ok) {
      expect(arabiziResult.value.state).toBe('CRISIS');
      expect(arabiziResult.value.requiresEscalation).toBe(true);
    }

    // Test safe input
    const safeInput: UnifiedInput = {
      inputId: 'inp-5',
      text: 'عايز أسأل عن نصائح للنوم الكويس',
      sessionId: 's1',
      userId: 'u1',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const safeResult = await classifier.classify(safeInput, { categories: ['none'], matchedRules: [], confidence: 1.0, severityHint: 'NONE' } as any);
    expect(safeResult.ok).toBe(true);
    if (safeResult.ok) {
      expect(safeResult.value.state).toBe('SAFE');
      expect(safeResult.value.requiresEscalation).toBe(false);
    }
  });
});
