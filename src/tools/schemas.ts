import { MemoryClass, EpistemicStatus } from '../memory/types.js';
import { Result, ok, err } from '../core/result.js';
import { ValidationError } from '../core/errors.js';

export interface WriteMemoryArgs {
  memoryClass: MemoryClass;
  epistemicStatus: EpistemicStatus;
  content: string;
  source: string;
}

export function validateWriteMemory(args: Record<string, unknown>): Result<WriteMemoryArgs, ValidationError> {
    if (typeof args.content !== 'string' || args.content.length === 0 || args.content.length > 2000) {
      return err(new ValidationError("Invalid content length"));
    }
    const validClasses: MemoryClass[] = ['EPHEMERAL', 'SESSION', 'USER_PREFERENCE', 'PROGRESS', 'SENSITIVE', 'CRISIS'];
    if (!validClasses.includes(args.memoryClass as MemoryClass)) {
      return err(new ValidationError("Invalid memoryClass"));
    }
    const validEpistemic: EpistemicStatus[] = ['FACT', 'USER_REPORTED', 'INFERENCE', 'UNCERTAIN', 'SYSTEM_GENERATED'];
    if (!validEpistemic.includes(args.epistemicStatus as EpistemicStatus)) {
      return err(new ValidationError("Invalid epistemicStatus"));
    }
    if (typeof args.source !== 'string') {
      return err(new ValidationError("Invalid source"));
    }
    
    return ok(args as unknown as WriteMemoryArgs);
}
