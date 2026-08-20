import { ContextPackage, MemoryObject } from './types.js';

export class ContextPackager {
  public packageForLLM(memories: MemoryObject[]): ContextPackage {
    const pkg: ContextPackage = {
      CURRENT_SESSION: [],
      USER_PREFERENCES: [],
      APPROVED_PROGRESS: [],
      RELEVANT_CONTEXT: [],
      SAFETY_CONTEXT: []
    };

    memories.forEach(m => {
      // Defense: Strip out any instruction-like formatting
      // We wrap the content in a data envelope
      const sanitizedContent = `[DATA: ${m.epistemicStatus}] ${m.content.replace(/[<>{}\\]/g, '')}`;
      const safeMemory = { ...m, content: sanitizedContent };

      switch (m.memoryClass) {
        case 'SESSION': pkg.CURRENT_SESSION.push(safeMemory); break;
        case 'USER_PREFERENCE': pkg.USER_PREFERENCES.push(safeMemory); break;
        case 'PROGRESS': pkg.APPROVED_PROGRESS.push(safeMemory); break;
        case 'SENSITIVE': pkg.RELEVANT_CONTEXT.push(safeMemory); break;
        case 'CRISIS': pkg.SAFETY_CONTEXT.push(safeMemory); break;
      }
    });

    return pkg;
  }
}
