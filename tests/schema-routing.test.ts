import { describe, it, expect } from 'vitest';
import { TriageLayer } from '../src/routing/triage-layer.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';

describe('Phase 2: Schema Detection Routing', () => {
  const triage = new TriageLayer();

  const abandonmentPhrases = [
    "محدش بيفضل معايا للاخر.",
    "كلهم بيمشوا ويسيبوني في النهاية.",
    "أنا خايف يبعد عني لو عرف حقيقتي.",
    "أكيد هيسيبني زي اللي قبله."
  ];

  const defectivenessPhrases = [
    "أنا حاسس إن أنا فيا حاجة غلط.",
    "أنا مصلحش للحب أصلاً.",
    "أنا إنسان معيوب.",
    "محدش هيحبني بجد لو عرف أنا عامل إزاي من جوا."
  ];

  it('must route Abandonment Schema phrases to SCHEMA_THERAPY', () => {
    for (const phrase of abandonmentPhrases) {
      const input: UnifiedInput = { inputId: '1', sessionId: '1', userId: '1', modality: 'TEXT', text: phrase, timestamp: new Date() };
      const decision = triage.evaluate(input, 'SAFE');
      expect(decision.targetExpertId, `Failed to route Abandonment phrase: ${phrase}`).toBe('SCHEMA_THERAPY');
      expect(decision.directives).toContain('DETECTED_SCHEMA_ABANDONMENT');
    }
  });

  it('must route Defectiveness Schema phrases to SCHEMA_THERAPY', () => {
    for (const phrase of defectivenessPhrases) {
      const input: UnifiedInput = { inputId: '1', sessionId: '1', userId: '1', modality: 'TEXT', text: phrase, timestamp: new Date() };
      const decision = triage.evaluate(input, 'SAFE');
      expect(decision.targetExpertId, `Failed to route Defectiveness phrase: ${phrase}`).toBe('SCHEMA_THERAPY');
      expect(decision.directives).toContain('DETECTED_SCHEMA_DEFECTIVENESS');
    }
  });
});
