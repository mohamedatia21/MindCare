import { describe, it, expect, vi } from 'vitest';
import { MindCareRuntime } from '../src/core/orchestrator.js';
import { SafetyPipelineInterface as SafetyPipeline } from '../src/safety/safety-pipeline.js';
import { StateMachine } from '../src/core/state-machine.js';
import { DefaultClinicalRouter } from '../src/routing/clinical-router.js';
import { SkillRegistry } from '../src/clinical/skills/skill-registry.js';
import { SkillPolicyGate } from '../src/clinical/skills/skill-policy.js';
import { LLMRuntime } from '../src/clinical/llm-runtime.js';
import { AdvancedToolGate } from '../src/tools/tool-gate.js';
import { MemoryPolicyGate } from '../src/memory/memory-policy.js';
import { MemoryMinimizer } from '../src/tools/minimizer.js';
import { OutputSafetyFilter } from '../src/clinical/output-safety-filter.js';
import { DefaultResourceResolver } from '../src/safety/resource-resolver.js';
import { CrisisResponseBuilder } from '../src/clinical/crisis-response-builder.js';
import { RuntimeLogger } from '../src/observability/runtime-logger.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';
import { Actor, ContextPackage } from '../src/memory/types.js';
import { LLMProvider, LLMRequest, StructuredLLMOutput } from '../src/clinical/types.js';
import { SupportiveConversationSkill } from '../src/clinical/skills/supportive-conversation/skill.js';

describe('Phase 4H: E2E Crisis Race Condition', () => {
  it('Immediately halts downstream execution if safety state transitions to CRISIS during LLM generation', async () => {
    // 1. Setup the standard deterministic pipeline
    const stateMachine = new StateMachine();
    
    // We create a mock SafetyPipeline that always says SAFE
    const mockSafetyPipeline = {
      evaluate: vi.fn().mockResolvedValue({ ok: true, value: { state: 'SAFE', confidence: 1.0, signalCategories: [], requiresEscalation: false } })
    } as unknown as SafetyPipeline;

    // A mock LLM Provider that simulates the race condition
    const mockLLMProvider: LLMProvider = {
      healthCheck: async () => true,
      generateResponse: async (req: LLMRequest): Promise<StructuredLLMOutput> => {
        // RACE CONDITION: Asynchronously transition state to CRISIS *while* LLM was generating
        stateMachine.applySafetyDecision('CRISIS');

        // LLM finishes and attempts to use a tool
        return {
          response: "Let me check my notes.",
          intent: 'SUPPORT',
          safetyRelevant: false,
          requestedTool: {
            toolName: 'WRITE_MEMORY',
            arguments: { memoryClass: 'SESSION', content: 'test', epistemicStatus: 'FACT', source: 'test' }
          }
        };
      }
    };

    const registry = new SkillRegistry();
    registry.register(SupportiveConversationSkill);
    const policyGate = new SkillPolicyGate();
    const router = new DefaultClinicalRouter(registry, policyGate);
    
    // We mock MemoryPolicyGate to verify it NEVER gets called for writeMemory
    const repo = {} as any; // mock repo
    const audit = {} as any; // mock audit
    const memoryPolicy = new MemoryPolicyGate(repo, audit);
    const writeMemorySpy = vi.spyOn(memoryPolicy, 'writeMemory');

    const toolGate = new AdvancedToolGate(memoryPolicy, new MemoryMinimizer());
    const crisisBuilder = new CrisisResponseBuilder(new DefaultResourceResolver());
    const safetyFilter = new OutputSafetyFilter({
      classify: vi.fn().mockResolvedValue({ ok: true, value: { safe: true, confidence: 1.0 } })
    });
    
    const llmRuntime = new LLMRuntime(mockLLMProvider, safetyFilter, toolGate, crisisBuilder);
    const logger = new RuntimeLogger();
    // Silence logger for tests
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    const orchestrator = new MindCareRuntime(
      mockSafetyPipeline,
      stateMachine,
      router,
      registry,
      policyGate,
      llmRuntime,
      safetyFilter,
      logger
    );

    const input: UnifiedInput = { 
      inputId: 'i1',
      sessionId: 's1', 
      userId: 'u1', 
      modality: 'TEXT',
      text: 'hello', 
      timestamp: new Date() 
    };
    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { 
      CURRENT_SESSION: [], 
      USER_PREFERENCES: [], 
      APPROVED_PROGRESS: [], 
      RELEVANT_CONTEXT: [], 
      SAFETY_CONTEXT: [] 
    };

    const result = await orchestrator.processRequest(input, actor, context);

    // Assertions
    if (!result.ok) {
       console.error("Test failed with error:", result.error);
    }
    expect(result.ok).toBe(true);
    
    // The response MUST NOT be the LLM's requested tool/response. It must fall back to the generic safe error or crisis lockdown response.
    // In our orchestrator, if llmRuntime blocks it, it falls back to "I am unable to fulfill that request at this time."
    if (result.ok) {
      expect(result.value).toMatch(/I am unable to fulfill that request|أنا قلق/);
    }

    // CRUCIAL: The memory MUST NOT have been written because AdvancedToolGate re-checked safety
    expect(writeMemorySpy).not.toHaveBeenCalled();
  });
});
