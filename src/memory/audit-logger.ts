import { ActorRole } from './types.js';

export interface MemoryAuditLog {
  timestamp: Date;
  action: 'READ' | 'WRITE' | 'UPDATE' | 'DELETE' | 'REVOKE' | 'DECRYPT_READ' | 'SHRED';
  memoryId: string;
  userId: string;
  actorId: string;
  actorRole: ActorRole;
  decision: 'ALLOW' | 'DENY';
  reasonCode: string;
}

export class MemoryAuditLogger {
  private logs: MemoryAuditLog[] = [];

  logEvent(event: Omit<MemoryAuditLog, 'timestamp'>) {
    // PRIVACY INVARIANT: Ensure no raw content accidentally enters the log object
    if ('content' in event || 'userMessage' in event || 'systemPolicy' in event) {
      throw new Error("CRITICAL PRIVACY VIOLATION: Attempted to log raw content or instructions.");
    }
    
    this.logs.push({ ...event, timestamp: new Date() });
  }

  getLogs() {
    return this.logs;
  }
}
