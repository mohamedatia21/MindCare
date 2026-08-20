import { SafetyState } from '../core/types.js';

export interface LogMetadata {
  requestId: string;
  sessionId?: string;
  modality?: string;
  traceId?: string;
  skillId?: string;
  safetyState?: SafetyState;
  toolName?: string;
  decision?: string;
  reasonCode?: string;
  status?: string;
  latency?: number;
  retryCount?: number;
  timestamp: Date;
  [key: string]: unknown;
}

const FORBIDDEN_KEYS = new Set([
  'content',
  'message',
  'prompt',
  'response',
  'rawoutput',
  'usermessage',
  'memorycontent',
  'contextdata',
  'apikey',
  'token',
  'authorization',
  'secret',
  'phi',
  'pii',
  'audio',
  'rawaudio',
  'transcript',
  'rawtranscript',
  'voicedata',
  'speechdata'
]);

export class RuntimeLogger {
  
  public info(event: string, metadata: LogMetadata): void {
    this.log('INFO', event, metadata);
  }

  public warn(event: string, metadata: LogMetadata): void {
    this.log('WARN', event, metadata);
  }

  public error(event: string, metadata: LogMetadata): void {
    this.log('ERROR', event, metadata);
  }

  private log(level: string, event: string, metadata: LogMetadata): void {
    try {
      if (this.containsForbiddenContent(metadata)) {
        // Degrade safely: emit a safe error log instead of the raw data
        console.warn(`[WARN] [${metadata.timestamp.toISOString()}] Observability - Attempted to log forbidden sensitive content in event: ${event}`);
        return;
      }
      
      const safeStringify = (obj: any) => {
        const cache = new Set();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      };

      console.log(`[${level}] [${metadata.timestamp.toISOString()}] ${event} - ${safeStringify(metadata)}`);
    } catch (err) {
      // Never crash the user request because logging failed
      console.error(`[CRITICAL] [${new Date().toISOString()}] Logging infrastructure failure: ${err}`);
    }
  }

  private containsForbiddenContent(obj: unknown, visited = new WeakSet()): boolean {
    if (obj instanceof Error) return false;

    if (obj === null || typeof obj !== 'object') {
      return false;
    }

    if (visited.has(obj as object)) {
      return false; // circular reference, ignore
    }
    visited.add(obj as object);

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(lowerKey)) {
        return true;
      }

      if (typeof value === 'object' && value !== null) {
        if (this.containsForbiddenContent(value, visited)) {
          return true;
        }
      }
    }

    return false;
  }
}
