import { SafetyState } from '../core/types.js';

export interface MCPToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED';

export interface MCPServerDef {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  disabledReason?: string;
  trustLevel: 'HIGH' | 'LOW'; 
  verificationStatus: VerificationStatus;
  allowedTools: string[];
  allowedClinicalModes: SafetyState[]; // e.g. ['SAFE', 'ELEVATED']
  timeoutMs: number;
  maxResponseBytes: number;
  transport: 'stdio' | 'sse';
  command?: string; // For stdio
  args?: string[]; // For stdio
  url?: string; // For sse
}

export interface MCPRequest {
  requestId: string;
  actorId: string;
  toolName: string;
  serverId: string;
  arguments: Record<string, unknown>;
  safetyState: SafetyState;
  timestamp: Date;
  timeoutMs?: number;
}

export interface MCPResponse {
  ok: boolean;
  data?: string; 
  error?: string;
  metadata: {
    truncated: boolean;
    provenance: string;
    executionTimeMs: number;
  };
}
