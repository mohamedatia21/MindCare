import { Actor } from '../memory/types.js';

export type AllowedToolName = 
  | 'READ_MEMORY'
  | 'WRITE_MEMORY'
  | 'UPDATE_MEMORY'
  | 'DELETE_MEMORY'
  | 'GET_PROGRESS'
  | 'GET_CRISIS_RESOURCES'
  | 'EXTERNAL_KNOWLEDGE_SEARCH'
  | 'KNOWLEDGE_BASE_SEARCH'
  | 'WEB_MEDICAL_SEARCH'
  | 'REQUEST_HUMAN_HANDOFF';

export interface ToolRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  actor: Actor;
  userId: string;
  requestId: string;
  timestamp: Date;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  metadata: {
    semanticBoundary: 'TOOL_RESULT' | 'MEMORY_DATA' | 'USER_REPORTED' | 'SYSTEM_GENERATED' | 'MCP_DATA';
    truncated: boolean;
  };
}
