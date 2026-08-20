import { WriteMemoryArgs } from './schemas.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';

export class MemoryMinimizer {
  public sanitizeAndValidate(args: WriteMemoryArgs): Result<WriteMemoryArgs, PolicyViolationError> {
    let { content, memoryClass, epistemicStatus } = args;
    const { source } = args;

    // 1. Defend against instruction injection
    if (content.match(/<system>|<instruction>|ignore.*policy|override.*safety/i)) {
      return err(new PolicyViolationError("Instruction injection detected in memory content"));
    }

    // 2. Reject secrets / credentials (basic heuristic)
    if (content.match(/(sk-[a-zA-Z0-9]{32,}|bearer\s+[a-zA-Z0-9\-.]{20,})/i)) {
      return err(new PolicyViolationError("Secret/credential detected in memory content"));
    }

    // 3. Classification Override (Defense against LLM marking sensitive data as preference)
    const sensitiveKeywords = /trauma|abuse|suicide|disorder|diagnosis|medication|assault/i;
    if (sensitiveKeywords.test(content) && memoryClass === 'USER_PREFERENCE') {
      // Force classification to SENSITIVE so Policy Gate enforces explicit consent
      memoryClass = 'SENSITIVE';
    }

    // 4. Epistemic Validation (Defense against LLM manufacturing facts)
    const clinicalTerms = /disorder|diagnosed with|suffers from|syndrome/i;
    if (clinicalTerms.test(content) && epistemicStatus === 'FACT') {
       // Cannot declare clinical diagnosis as FACT. Must be INFERENCE or USER_REPORTED.
       epistemicStatus = 'INFERENCE'; 
    }
    // "caused by" -> INFERENCE
    if (content.match(/caused by|because of/i) && epistemicStatus === 'FACT') {
       epistemicStatus = 'INFERENCE';
    }

    // 5. Basic Minimization (strip dangerous characters that might break formatting later)
    content = content.replace(/[<>]/g, '');

    return ok({ content, memoryClass, epistemicStatus, source });
  }
}
