import { StructuredLLMOutput, ClinicalResponse } from './types.js';
import { OutputSafetyClassifier } from '../safety/output-classifier-interface.js';

export class OutputSafetyFilter {
  private MAX_LENGTH = 2000;

  constructor(private secondaryClassifier?: OutputSafetyClassifier) {}

  public async validate(output: StructuredLLMOutput | string, depth = 0): Promise<ClinicalResponse> {
    if (depth > 2) {
       // Prevent infinite fallback recursion
       return { content: "Internal error.", safe: false, blockedReason: 'FALLBACK_RECURSION' };
    }

    const text = typeof output === 'string' ? output : output.response;
    
    // 0. Length check
    if (text.length > this.MAX_LENGTH) {
       return this.validateFallback("The response was too long to process safely.", 'OUTPUT_LENGTH_EXCEEDED', depth);
    }

    // 1. Obfuscation & Normalization
    // Strip whitespace, zero-width chars, normalize unicode for analysis
    const normalized = text.toLowerCase()
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFKC');

    // 2. Deterministic Regex Pipeline (English & Arabic)
    
    // Diagnostics & Indirect Diagnostics
    if (normalized.match(/idiagnoseyou|youhave(generalizedanxiety|depression|bipolar|schizophrenia|ptsd|ocd|adhd)/i) || 
        normalized.match(/تشخيص|لديك(اكتئاب|قلق|فصام)/i)) {
      return this.validateFallback("I cannot provide medical diagnoses. Please consult a professional.", 'DIAGNOSTIC_CLAIM', depth);
    }

    // Medication & Dosage
    // Only block when dosage appears with a quantity (e.g. "10mg", "50 mg") or when explicitly prescribing.
    // Avoid false-positives on "dosage of practice" / "breathing dosage" type phrasing.
    if (normalized.match(/youshouldtake|prescribe|ssri|xanax|prozac|adderall|\d+\s*mg\b/i) ||
        normalized.match(/يجبأنتأخذ|أوصفلك|جرعة/i)) {
      return this.validateFallback("عذراً، لا يمكنني تقديم نصائح دوائية. يرجى استشارة طبيب مختص.", 'MEDICATION_CLAIM', depth);
    }

    // Professional Identity Fabrication
    if (normalized.match(/licensedtherapist|yourdoctor|clinicalpsychologist|medicalprofessional/i) ||
        normalized.match(/أناطبيبك|معالجكمرخص/i)) {
      return this.validateFallback("I am an AI companion, not a licensed professional.", 'FAKE_IDENTITY', depth);
    }

    // Self Harm & Violence (Direct & Metaphorical)
    if (normalized.match(/okaytoendit|youshouldkillyourself|betteroffdead|endthepain|hurtyourself|hurtothers/i) ||
        normalized.match(/انهاءحياتك|يجبأنتنتحر/i)) {
      return this.validateFallback("I am here to support you safely, but I cannot discuss this. Please reach out to emergency resources.", 'SELF_HARM_ENCOURAGEMENT', depth);
    }

    // Policy & System Prompt Leakage & Jailbreaks
    if (normalized.match(/systemprompt|safetypolicy|ignoreinstructions|myinstructionssay|jailbreak|developer|override/i) ||
        normalized.match(/تجاهلالتعليمات/i)) {
      return this.validateFallback("I cannot discuss my internal instructions.", 'POLICY_LEAKAGE', depth);
    }

    // Malformed JSON check (if checking structured output)
    if (typeof output !== 'string') {
      if (typeof output.response !== 'string' || typeof output.intent !== 'string') {
        return this.validateFallback("I encountered an internal error processing that.", 'MALFORMED_OUTPUT', depth);
      }
    }

    // 3. Secondary Advisory Classifier
    if (this.secondaryClassifier) {
      const classRes = await this.secondaryClassifier.classify(text);
      if (!classRes.ok) {
        // Fail safe on classifier error/timeout
        return this.validateFallback("Internal safety check failed.", 'CLASSIFIER_ERROR', depth);
      }
      
      const v = classRes.value;
      if (typeof v.safe !== 'boolean' || typeof v.confidence !== 'number') {
        return this.validateFallback("Internal safety check failed.", 'MALFORMED_CLASSIFIER', depth);
      }

      if (!v.safe || v.confidence < 0.7) {
        return this.validateFallback("This response was flagged by secondary safety systems.", v.blockedReason || 'SECONDARY_CLASSIFIER_BLOCKED', depth);
      }
    }

    return { content: typeof output === 'string' ? output : output.response, safe: true };
  }

  private async validateFallback(fallbackContent: string, reason: string, depth: number): Promise<ClinicalResponse> {
    // recursively run the fallback through the same deterministic filter to ensure it's safe!
    const validated = await this.validate(fallbackContent, depth + 1);
    if (!validated.safe) return validated; // If the fallback itself is unsafe, return its deeper fallback
    return { content: fallbackContent, safe: false, blockedReason: reason };
  }
}
