import { ToolRequest } from '../tools/types.js';

export interface LLMRequest {
  systemPolicy: string;
  contextData: string; // Serialized ContextPackage, treated as DATA
  userMessage: string;
}

export interface StructuredLLMOutput {
  response: string;
  emotion?: string;
  intent: string;
  requestedTool?: Omit<ToolRequest, 'actor' | 'userId' | 'requestId' | 'timestamp'>;
  safetyRelevant: boolean;
}

export interface LLMProvider {
  generateResponse(request: LLMRequest): Promise<StructuredLLMOutput>;
  healthCheck(): Promise<boolean>;
}

export interface StreamingLLMProvider {
  generateStreamingResponse(request: LLMRequest): AsyncGenerator<string, StructuredLLMOutput, void>;
  healthCheck(): Promise<boolean>;
}

export interface ClinicalResponse {
  content: string;
  safe: boolean;
  blockedReason?: string;
}
