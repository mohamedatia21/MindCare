import { UnifiedInput } from '../core/input/unified-input.js';
import { SafetySignals } from './types.js';

export class DeterministicDetector {
  public scan(input: UnifiedInput): SafetySignals {
    const text = input.text.toLowerCase();
    const signals: SafetySignals = {
      categories: [],
      matchedRules: [],
      severityHint: 'NONE',
      requiresFurtherAssessment: false
    };

    // Rule 1: Direct Self-Harm (Explicit - English and Arabic)
    if (text.match(/\b(kill myself|end my life|commit suicide|want to die|going to jump|overdose tonight)\b/) ||
        text.match(/(انتحر|أنهي حياتي|مش عايز أعيش|اقتل نفسي|أقتل نفسي)/)) {
      signals.categories.push('direct_self_harm');
      signals.matchedRules.push('RULE_DSH_01');
      signals.severityHint = 'CRITICAL';
    }

    // Rule 2: Indirect/Ambiguous Distress & Hopelessness
    // "better off without me", "point anymore", "everything to stop", "saying goodbye"
    if (text.match(/\b(better off without me|no point anymore|everything to stop|deal with any of this tomorrow|saying goodbye to everyone|finally know what i'm going to do|can't keep doing this)\b/)) {
      signals.categories.push('ambiguous_distress');
      signals.matchedRules.push('RULE_AMB_INDIRECT_01');
      if (signals.severityHint !== 'CRITICAL') signals.severityHint = 'HIGH';
      signals.requiresFurtherAssessment = true;
    }
    
    // Rule 3: False Positive Mitigation Context Checks
    // E.g., discussing a movie, fictional character, book
    if (text.match(/\b(in the movie|the character|my book|this script|fictional|episode|season)\b/)) {
      // We do NOT cancel the signal, but we strongly flag it for L2/L3 context assessment
      // The classifier should decide if it's benign content about risk vs user at risk.
      signals.requiresFurtherAssessment = true;
      if (signals.severityHint === 'HIGH') {
         // Demote severity hint slightly to prevent immediate panic fallback, rely on LLM
         signals.severityHint = 'MODERATE'; 
      }
    }

    // Rule 4: Prompt Injection
    if (text.match(/\b(ignore.*safety|disable.*crisis|forget.*rules|bypass|this is a test)\b/)) {
      signals.categories.push('prompt_injection');
      signals.matchedRules.push('RULE_INJ_01');
      if (signals.severityHint !== 'CRITICAL') signals.severityHint = 'HIGH';
      signals.requiresFurtherAssessment = true; 
    }

    if (signals.categories.length === 0) {
      signals.requiresFurtherAssessment = true; 
    }

    return signals;
  }
}
