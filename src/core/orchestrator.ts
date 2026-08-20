import { SafetyState } from './types.js';
import { Result, ok, err } from './result.js';
import { SafetyPipelineInterface as SafetyPipeline } from '../safety/safety-pipeline.js';
import { StateMachine } from './state-machine.js';
import { ClinicalRouter } from '../routing/clinical-router.js';
import { SkillSelectionResult } from '../clinical/skills/skill-types.js';
import { SkillPolicyGate } from '../clinical/skills/skill-policy.js';
import { SkillRegistry } from '../clinical/skills/skill-registry.js';
import { LLMRuntime } from '../clinical/llm-runtime.js';
import { OutputSafetyFilter } from '../clinical/output-safety-filter.js';
import { Actor, ContextPackage } from '../memory/types.js';
import { CrisisResponseBuilder } from '../clinical/crisis-response-builder.js';
import { DefaultResourceResolver } from '../safety/resource-resolver.js';
import { RuntimeLogger, LogMetadata } from '../observability/runtime-logger.js';
import { InternalError, SafetyError } from './errors.js';
import { UnifiedInput } from './input/unified-input.js';

export class MindCareRuntime {
  constructor(
    private safetyPipeline: SafetyPipeline,
    private stateMachine: StateMachine,
    private clinicalRouter: ClinicalRouter,
    private skillRegistry: SkillRegistry,
    private skillPolicyGate: SkillPolicyGate,
    private llmRuntime: LLMRuntime,
    private outputSafetyFilter: OutputSafetyFilter,
    private logger: RuntimeLogger
  ) {}

  public async processRequest(input: UnifiedInput, actor: Actor, baseContext: ContextPackage): Promise<Result<string, InternalError | SafetyError>> {
    this.logger.info('InteractionStarted', { 
      requestId: input.inputId, 
      sessionId: input.sessionId, 
      modality: input.modality,
      timestamp: new Date() 
    });

    // 1. Safety Pipeline & State Machine
    this.stateMachine.onNewInput(input);
    const safetyResult = await this.safetyPipeline.evaluate(input);
    
    if (!safetyResult.ok) {
       return err(safetyResult.error);
    }
    
    const initialSafetyState = safetyResult.value.state;
    const applyResult = this.stateMachine.applySafetyDecision(initialSafetyState);

    if (!applyResult.ok) {
      return err(new InternalError("State machine failed to apply safety decision"));
    }

    this.logger.info('SafetyEvaluated', { 
      requestId: input.inputId, 
      safetyState: initialSafetyState, 
      decision: initialSafetyState, 
      timestamp: new Date() 
    });

    if (initialSafetyState === 'CRISIS') {
      return this.handleCrisis(input, actor);
    }


    // 2. Clinical Router
    const routingResult = await this.clinicalRouter.route(input, initialSafetyState, actor);
    if (!routingResult.ok) {
      this.logger.error('RoutingFailed', { requestId: input.inputId, reasonCode: routingResult.error.message, timestamp: new Date() });
      return err(new InternalError("Clinical routing failed completely"));
    }

    const skillSelection = routingResult.value;

    const targetSkill = this.skillRegistry.get(skillSelection.skillId);
    if (!targetSkill) {
      this.logger.error('SkillResolutionFailed', { requestId: input.inputId, skillId: skillSelection.skillId, timestamp: new Date() });
      return err(new InternalError("Skill ID resolution failed"));
    }

    // 3. Skill Policy Gate
    const skillAuth = this.skillPolicyGate.authorize(targetSkill, initialSafetyState, actor, ['SESSION'], []);
    if (!skillAuth.ok) {
      this.logger.error('SkillUnauthorized', { 
        requestId: input.inputId, 
        skillId: skillSelection.skillId, 
        reasonCode: skillAuth.error.message || 'Unauthorized', 
        timestamp: new Date() 
      });
      return err(new InternalError("Skill execution unauthorized"));
    }

    const authorizedSkill = skillAuth.value;

    this.logger.info('SkillAuthorized', { 
      requestId: input.inputId, 
      skillId: authorizedSkill.id, 
      timestamp: new Date() 
    });

    // 4. LLM Runtime (handles tool loop internally)
    let llmResult: any;
    try {
      const getDynamicSafetyState = (): SafetyState => {
         const currentState = this.stateMachine.getState();
         if (currentState === 'CRISIS_PROTOCOL') return 'CRISIS';
         return initialSafetyState; // Safe fallback for others
      };

      const llmInput = {
        sessionId: input.sessionId,
        userId: input.userId,
        content: input.text, // mapped text
        timestamp: input.timestamp,
        metadata: input.metadata
      };

      // Append user message to history
      baseContext.CURRENT_SESSION.push({
        id: input.inputId,
        userId: actor.id,
        memoryClass: 'SESSION',
        content: input.text,
        epistemicStatus: 'USER_REPORTED',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        retentionPolicy: 'SESSION_ONLY',
        consentState: 'NOT_REQUIRED',
        source: 'USER_INPUT'
      });

      llmResult = await this.llmRuntime.execute(llmInput, baseContext, getDynamicSafetyState, actor, authorizedSkill);
    } catch (error) {
       this.logger.error('LLMExecutionFailed', { 
         requestId: input.inputId, 
         reasonCode: error instanceof Error ? error.message : String(error), 
         timestamp: new Date() 
       });
       console.error("LLMRuntime threw exception:", error);
       return err(new InternalError("LLM Execution failed"));
    }

    if (!llmResult.safe) {
      this.logger.warn('LLMRuntimeBlocked', { 
        requestId: input.inputId, 
        reasonCode: llmResult.blockedReason || 'UNKNOWN', 
        timestamp: new Date() 
      });
      const content = (llmResult.content && typeof llmResult.content === 'string') 
        ? llmResult.content 
        : "I am unable to fulfill that request at this time.";
      return ok(content);
    }

    const llmResponseText = llmResult.content;

    // 5. Output Safety Filter
    const finalResult = await this.safelyFilterAndReturn(llmResponseText);

    if (finalResult.ok) {
       // Append LLM response to history
       baseContext.CURRENT_SESSION.push({
         id: input.inputId + '-reply',
         userId: actor.id,
         memoryClass: 'SESSION',
         content: finalResult.value,
         epistemicStatus: 'SYSTEM_GENERATED',
         status: 'ACTIVE',
         createdAt: new Date(),
         updatedAt: new Date(),
         retentionPolicy: 'SESSION_ONLY',
         consentState: 'NOT_REQUIRED',
         source: 'LLM_REPLY'
       });
    }

    return finalResult;
  }

  private async safelyFilterAndReturn(text: string): Promise<Result<string, InternalError>> {
    const finalSafety = await this.outputSafetyFilter.validate(text);

    if (!finalSafety.safe) {
       return ok("I cannot provide that response."); // Hard fail-safe response
    }
    
    return ok(text);
  }

  private async handleCrisis(input: UnifiedInput, actor: Actor): Promise<Result<string, InternalError>> {
    this.logger.warn('CrisisLockActivated', { requestId: input.inputId, timestamp: new Date() });
    
    // CRISIS absolute downstream execution barrier. No normal skills.
    const crisisBuilder = new CrisisResponseBuilder(new DefaultResourceResolver());
    const rawCrisisText = await crisisBuilder.buildCrisisResponse('US');

    return this.safelyFilterAndReturn(rawCrisisText);
  }
}
