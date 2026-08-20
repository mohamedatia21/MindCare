export interface LogMetadata {
  event: string;
  timestamp: Date;
  requestId?: string;
  component: string;
  state?: string;
  toolName?: string;
  status?: string;
}

export interface PrivacyLogger {
  info(metadata: LogMetadata, message?: string): void;
  error(metadata: LogMetadata, error: Error): void;
  warn(metadata: LogMetadata, message?: string): void;
}

export class DefaultPrivacyLogger implements PrivacyLogger {
  // Explicitly avoids logging raw user input or hidden reasoning
  info(metadata: LogMetadata, message?: string): void {
    console.log(JSON.stringify({ level: 'INFO', ...metadata, message: this.redact(message) }));
  }

  error(metadata: LogMetadata, error: Error): void {
    console.error(JSON.stringify({ level: 'ERROR', ...metadata, errorMessage: error.message }));
  }

  warn(metadata: LogMetadata, message?: string): void {
    console.warn(JSON.stringify({ level: 'WARN', ...metadata, message: this.redact(message) }));
  }

  private redact(message?: string): string | undefined {
    if (!message) return undefined;
    // Basic placeholder for redaction utility
    return message.replace(/\\b\\d{9}\\b/g, '[REDACTED_SSN]'); 
  }
}
