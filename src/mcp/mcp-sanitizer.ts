import { MCPResponse } from './types.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';
import { OutputSafetyClassifier } from '../safety/output-classifier-interface.js';

export class MCPSanitizer {
  private MAX_BYTES = 5000000;

  constructor(private secondaryClassifier?: OutputSafetyClassifier) {}

  public async sanitize(response: MCPResponse): Promise<Result<MCPResponse, PolicyViolationError>> {
    if (!response.ok || !response.data) {
      return ok(response); // pass through errors cleanly
    }

    const text = response.data;

    // 1. Size Limit
    if (text.length > this.MAX_BYTES) {
      return err(new PolicyViolationError("MCP response exceeded maximum allowed byte size."));
    }

    // 2. Obfuscation & Normalization
    // Strip whitespace, zero-width chars, normalize unicode for analysis
    const normalized = text.toLowerCase()
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFKC');

    // 3. Deterministic Injection & Policy Detection
    if (normalized.includes("ignorepreviousinstructions") ||
        normalized.includes("ignoreallsafetyrules") ||
        normalized.includes("systemprompt") ||
        normalized.includes("overridesafety") ||
        normalized.includes("disablesafety") ||
        normalized.match(/<system>|\[system\]|\bdeveloper\b|<tool>/i)) {
       return err(new PolicyViolationError("MCP response contained suspected malicious injection instructions."));
    }

    // JSON/State Manipulation Detection (e.g. trying to return {"safetyState": "SAFE"})
    if (normalized.includes('"safetystate"') || normalized.includes('"authorization"') || normalized.includes('"consentstate"')) {
       return err(new PolicyViolationError("MCP response attempted to manipulate core authority states."));
    }

    // 4. Secondary Classifier check
    if (this.secondaryClassifier) {
       const classRes = await this.secondaryClassifier.classify(text);
       if (!classRes.ok) {
         return err(new PolicyViolationError("MCP response failed secondary classifier check (Error/Timeout)."));
       }
       
       const v = classRes.value;
       if (typeof v.safe !== 'boolean' || typeof v.confidence !== 'number') {
         return err(new PolicyViolationError("MCP response generated malformed classifier result."));
       }

       if (!v.safe || v.confidence < 0.7) {
         return err(new PolicyViolationError(`MCP response blocked by secondary classifier: ${v.blockedReason || 'LOW_CONFIDENCE'}`));
       }
    }

    // Return sanitized response
    return ok({
      ...response,
      data: text,
      metadata: { ...response.metadata }
    });
  }
}
