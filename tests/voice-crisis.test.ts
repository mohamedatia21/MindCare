import { describe, it, expect, vi } from 'vitest';
import { MindCareRuntime } from '../src/core/orchestrator.js';
import { ProductionSafetyPipeline } from '../src/safety/safety-pipeline.js';
import { DeterministicDetector } from '../src/safety/deterministic-detector.js';
import { MockSafetyClassifier } from '../src/safety/classifier-interface.js';
import { ContextAwareAssessor } from '../src/safety/context-assessment.js';
import { ConservativeFallback } from '../src/safety/fallback-handler.js';
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

describe('Phase 5: Voice Crisis Flow', () => {
  it('Triggers the absolute CRISIS lock when a voice transcript contains self-harm indicators', async () => {
    
    // We use the real deterministic detector which should catch the crisis phrase
    const pipeline = new ProductionSafetyPipeline(
      new DeterministicDetector(),
      new MockSafetyClassifier(),
      new ContextAwareAssessor(),
      new ConservativeFallback()
    );

    const stateMachine = new StateMachine();
    
    // Mock LLM Provider - SHOULD NOT BE CALLED during a crisis!
    const generateResponseSpy = vi.fn().mockResolvedValue({
      response: "This should never be returned.",
      intent: 'SUPPORT',
      safetyRelevant: false
    } as StructuredLLMOutput);

    const mockLLMProvider: LLMProvider = {
      healthCheck: async () => true,
      generateResponse: generateResponseSpy
    };

    const registry = new SkillRegistry();
    const policyGate = new SkillPolicyGate();
    const router = new DefaultClinicalRouter(registry, policyGate);
    
    const repo = {} as any; 
    const audit = {} as any; 
    const memoryPolicy = new MemoryPolicyGate(repo, audit);

    const toolGate = new AdvancedToolGate(memoryPolicy, new MemoryMinimizer());
    const crisisBuilder = new CrisisResponseBuilder(new DefaultResourceResolver());
    const safetyFilter = new OutputSafetyFilter({
      classify: vi.fn().mockResolvedValue({ ok: true, value: { safe: true, confidence: 1.0 } })
    });
    
    const llmRuntime = new LLMRuntime(mockLLMProvider, safetyFilter, toolGate, crisisBuilder);
    const logger = new RuntimeLogger();
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    const orchestrator = new MindCareRuntime(
      pipeline,
      stateMachine,
      router,
      registry,
      policyGate,
      llmRuntime,
      safetyFilter,
      logger
    );

    const voiceCrisisInput: UnifiedInput = { 
      inputId: 'i1',
      sessionId: 's1', 
      userId: 'u1', 
      modality: 'VOICE',
      text: 'أنا مش عايز أعيش', // Arabic self-harm trigger from mock/detector... wait, does deterministic detector catch Arabic? 
      // The detector checks English keywords right now: "kill myself", etc. Let's use English for the test to ensure L1 hits.
      timestamp: new Date() 
    };
    
    // Let's use the explicit english keyword caught by DeterministicDetector
    voiceCrisisInput.text = 'I want to kill myself.';

    const actor: Actor = { id: 'u1', role: 'USER' };
    const context: ContextPackage = { 
      CURRENT_SESSION: [], 
      USER_PREFERENCES: [], 
      APPROVED_PROGRESS: [], 
      RELEVANT_CONTEXT: [], 
      SAFETY_CONTEXT: [] 
    };

    const result = await orchestrator.processRequest(voiceCrisisInput, actor, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The LLM must NOT be called for a crisis input.
      expect(generateResponseSpy).not.toHaveBeenCalled();
      
      // The response must be the deterministic crisis response from CrisisResponseBuilder
      expect(result.value).toContain('Call or Text 988');
    }
  });
});
