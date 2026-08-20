export class AppError extends Error {
  constructor(public message: string, public code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) { super(message, 'CONFIG_ERR'); }
}
export class SafetyError extends AppError {
  constructor(message: string) { super(message, 'SAFETY_ERR'); }
}
export class PolicyViolationError extends AppError {
  constructor(message: string) { super(message, 'POLICY_ERR'); }
}
export class ToolExecutionError extends AppError {
  constructor(message: string) { super(message, 'TOOL_ERR'); }
}
export class ValidationError extends AppError {
  constructor(message: string) { super(message, 'VALIDATION_ERR'); }
}
export class InternalError extends AppError {
  constructor(message: string) { super(message, 'INTERNAL_ERR'); }
}
