import { MCPRequest } from './types.js';
import { Result, ok, err } from '../core/result.js';
import { PolicyViolationError } from '../core/errors.js';

export class MCPInputSanitizer {
  private MAX_BYTES = 5000;

  public sanitize(request: MCPRequest): Result<MCPRequest, PolicyViolationError> {
    const argsStr = JSON.stringify(request.arguments);
    
    if (argsStr.length > this.MAX_BYTES) {
      return err(new PolicyViolationError("MCP Input exceeded maximum allowed byte size."));
    }

    const normalized = argsStr.toLowerCase();
    
    // Prevent injection or system prompt extraction in MCP requests
    if (normalized.includes("system prompt") || 
        normalized.includes("ignore previous instructions") ||
        normalized.includes("override safety")) {
       return err(new PolicyViolationError("MCP Input contained suspected malicious injection instructions."));
    }

    // Heuristic PHI blocking (e.g. SSN)
    if (normalized.match(/\b\d{3}-\d{2}-\d{4}\b/)) {
       return err(new PolicyViolationError("MCP Input contained potential PHI (SSN blocked)."));
    }

    return ok(request);
  }
}
