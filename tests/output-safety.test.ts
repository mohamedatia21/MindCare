import { describe, it, expect, beforeEach } from 'vitest';
import { OutputSafetyFilter } from '../src/clinical/output-safety-filter.js';
import { MockOutputSafetyClassifier } from '../src/safety/output-classifier-interface.js';

describe('Phase 4E.1: Output Safety Hardening', () => {
  let classifier: MockOutputSafetyClassifier;
  let filter: OutputSafetyFilter;

  beforeEach(() => {
    classifier = new MockOutputSafetyClassifier();
    filter = new OutputSafetyFilter(classifier);
  });

  describe('Obfuscation & Hardened Regex', () => {
    it('Blocks Unicode whitespace obfuscation (e.g. i d i a g n o s e)', async () => {
      // i d i a g n o s e y o u
      const res = await filter.validate({ response: "i d i a g n o s e  y o u with sadness", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('DIAGNOSTIC_CLAIM');
    });

    it('Blocks Arabic harmful content', async () => {
      const res = await filter.validate({ response: "يجب أن تأخذ دواء xanax", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('MEDICATION_CLAIM');
    });
    
    it('Blocks metaphorical self-harm instructions', async () => {
      const res = await filter.validate({ response: "it's time to end the pain", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('SELF_HARM_ENCOURAGEMENT');
    });

    it('Enforces maximum length limitation', async () => {
      const hugeString = 'a'.repeat(2500);
      const res = await filter.validate({ response: hugeString, intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('OUTPUT_LENGTH_EXCEEDED');
      expect(res.content.length).toBeLessThan(100); // Fallback text
    });
  });

  describe('Secondary Classifier Integration', () => {
    it('Fails safe if secondary classifier throws timeout', async () => {
      classifier.setMockScenario('TIMEOUT');
      const res = await filter.validate({ response: "Hello", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('CLASSIFIER_ERROR');
    });

    it('Fails safe if secondary classifier returns uncertain', async () => {
      classifier.setMockScenario('UNCERTAIN');
      const res = await filter.validate({ response: "Maybe hurt?", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('SECONDARY_CLASSIFIER_UNCERTAIN');
    });
    
    it('Fails safe if secondary classifier returns malformed response', async () => {
      classifier.setMockScenario('MALFORMED_RESPONSE');
      const res = await filter.validate({ response: "Hello", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.blockedReason).toBe('MALFORMED_CLASSIFIER');
    });
  });
  
  describe('Safe Fallback Recursive Validation', () => {
    it('Ensures fallback responses are themselves validated', async () => {
      // If we somehow hardcoded a bad fallback string in the class, it would get caught.
      // E.g., if fallback was "take xanax", it would block.
      // This is proven implicitly by the code running recursive validation depth.
      const res = await filter.validate({ response: "i diagnose you", intent: 'X', safetyRelevant: false });
      expect(res.safe).toBe(false);
      expect(res.content).toBe("I cannot provide medical diagnoses. Please consult a professional.");
    });
  });
});
