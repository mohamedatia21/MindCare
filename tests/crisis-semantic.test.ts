import { describe, it, expect, vi } from 'vitest';
import { FastLLMSafetyClassifier } from '../src/safety/fast-llm-classifier.js';
import { DeterministicDetector } from '../src/safety/deterministic-detector.js';
import { ProductionSafetyPipeline } from '../src/safety/safety-pipeline.js';
import { ContextAwareAssessor } from '../src/safety/context-assessment.js';
import { ConservativeFallback } from '../src/safety/fallback-handler.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';

describe('Phase 12: Multilingual Semantic Crisis Classifier & Pipeline', () => {
  const classifier = new FastLLMSafetyClassifier();
  const detector = new DeterministicDetector();
  const pipeline = new ProductionSafetyPipeline(
    detector,
    classifier,
    new ContextAwareAssessor(),
    new ConservativeFallback()
  );

  it('detects explicit Egyptian Arabic crisis intent', async () => {
    const input: UnifiedInput = {
      inputId: 'inp-1',
      sessionId: 'sess-1',
      userId: 'u1',
      text: 'أنا خلاص مش عايز اعيش في الدنيا دي وكل حاجة اتقفلت في وشي',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const res = await pipeline.evaluate(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.state).toBe('CRISIS');
      expect(res.value.requiresEscalation).toBe(true);
    }
  });

  it('detects Arabizi / Franco-Arab implied crisis expressions', async () => {
    const input: UnifiedInput = {
      inputId: 'inp-1',
      sessionId: 'sess-1',
      userId: 'u1',
      text: 'mesh 3ayez a3eesh ta3abt mn el donia w mlesh lazma',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const res = await pipeline.evaluate(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.state).toBe('CRISIS');
      expect(res.value.requiresEscalation).toBe(true);
    }
  });

  it('detects ambiguous severe distress and elevates without false crisis lock', async () => {
    const input: UnifiedInput = {
      inputId: 'inp-1',
      sessionId: 'sess-1',
      userId: 'u1',
      text: 'مخنوق ومش قادر اتنفس ومفيش فايدة خلاص',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const res = await pipeline.evaluate(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.state).toBe('ELEVATED');
    }
  });

  it('classifies benign conversational venting as SAFE', async () => {
    const input: UnifiedInput = {
      inputId: 'inp-1',
      sessionId: 'sess-1',
      userId: 'u1',
      text: 'الشغل كان متعب النهاردة وزحمة الطريق خنقتني بس الحمد لله روحت',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const res = await pipeline.evaluate(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.state).toBe('SAFE');
      expect(res.value.requiresEscalation).toBe(false);
    }
  });

  it('fails safe (Conservative Fallback) if the LLM classifier throws', async () => {
    const failingClassifier = {
      classify: vi.fn().mockRejectedValue(new Error('LLM Rate limit / network timeout'))
    };

    const safeFallbackPipeline = new ProductionSafetyPipeline(
      detector,
      failingClassifier as any,
      new ContextAwareAssessor(),
      new ConservativeFallback()
    );

    const input: UnifiedInput = {
      inputId: 'inp-1',
      sessionId: 'sess-1',
      userId: 'u1',
      text: 'أنا حاسس بإحباط',
      modality: 'TEXT',
      timestamp: new Date()
    };

    const res = await safeFallbackPipeline.evaluate(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Must NOT fail open to SAFE. Must escalate to ELEVATED / FAILSAFE
      expect(res.value.state).toBe('ELEVATED');
      expect(res.value.requiresEscalation).toBe(true);
      expect(res.value.reasonCode).toContain('FAILSAFE');
    }
  });
});
