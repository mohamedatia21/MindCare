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

describe('Phase 4H: E2E Orchestration (Safe Path)', () => {
  it('Executes the full pipeline for a safe request', async () => {
    const stateMachine = new StateMachine();
    const mockSafetyPipeline = {
      evaluate: vi.fn().mockResolvedValue({ ok: true, value: { state: 'SAFE', confidence: 1.0, signalCategories: [], requiresEscalation: false } })
    } as unknown as SafetyPipeline;

    const mockLLMProvider: LLMProvider = {
      healthCheck: async () => true,
      generateResponse: async (req: LLMRequest): Promise<StructuredLLMOutput> => {
        return {
          response: "It sounds like you're having a good day.",
          intent: 'SUPPORT',
          safetyRelevant: false
        };
      }
    };

    const registry = new SkillRegistry();
    registry.register(SupportiveConversationSkill);
    const policyGate = new SkillPolicyGate();
    const router = new DefaultClinicalRouter(registry, policyGate);
    const repo = {} as any; // mock repo
    const audit = {} as any; // mock audit
    const memoryPolicy = new MemoryPolicyGate(repo, audit);
    const toolGate = new AdvancedToolGate(memoryPolicy, new MemoryMinimizer());
    const crisisBuilder = new CrisisResponseBuilder(new DefaultResourceResolver());
    
    const safetyFilter = new OutputSafetyFilter({
      classify: vi.fn().mockResolvedValue({ ok: true, value: { safe: true, confidence: 1.0 } })
    });
    
    const llmRuntime = new LLMRuntime(mockLLMProvider, safetyFilter, toolGate, crisisBuilder);
    const logger = new RuntimeLogger();
    vi.spyOn(logger, 'info').mockImplementation(() => {});

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
      text: 'I feel okay today', 
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
    if (!result.ok) {
       console.error("Test failed with error:", result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
       expect(result.value).toBe("It sounds like you're having a good day.");
    }
  });
});
