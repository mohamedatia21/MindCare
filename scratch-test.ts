import 'dotenv/config';
import { OpenAIStreamingLLM } from './src/infrastructure/llm/openai-llm.js';
import { LLMRuntime } from './src/clinical/llm-runtime.js';
import { OutputSafetyFilter } from './src/clinical/output-safety-filter.js';
import { AdvancedToolGate } from './src/tools/tool-gate.js';
import { CrisisResponseBuilder } from './src/clinical/crisis-response-builder.js';
import { DefaultResourceResolver } from './src/safety/resource-resolver.js';
import { SupportiveConversationSkill } from './src/clinical/skills/supportive-conversation/skill.js';

const provider = new OpenAIStreamingLLM();
const runtime = new LLMRuntime(provider, new OutputSafetyFilter(), new AdvancedToolGate(), new CrisisResponseBuilder(new DefaultResourceResolver()));

(async () => {
  // Shared context simulates a single conversation/session — memory accumulates across all 4 turns
  const contextPackage: any = { CURRENT_SESSION: [], USER_PREFERENCES: [], APPROVED_PROGRESS: [], RELEVANT_CONTEXT: [], SAFETY_CONTEXT: [] };

  const executeTurn = async (turnNum: number, msg: string) => {
    // Orchestrator appends user message to history BEFORE calling LLMRuntime
    contextPackage.CURRENT_SESSION.push({
      id: `turn-${turnNum}-user`,
      userId: 'u1',
      memoryClass: 'SESSION',
      content: msg,
      epistemicStatus: 'USER_REPORTED',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionPolicy: 'SESSION_ONLY',
      consentState: 'NOT_REQUIRED',
      source: 'USER_INPUT'
    });

    const res = await runtime.execute(
      { inputId: `turn-${turnNum}`, sessionId: 's1', userId: 'u1', content: msg, timestamp: new Date(), text: msg, type: 'text', modality: 'TEXT' },
      contextPackage,
      () => 'SAFE',
      { id: 'u1', role: 'USER' },
      SupportiveConversationSkill
    );

    // Orchestrator appends LLM reply to history AFTER
    contextPackage.CURRENT_SESSION.push({
      id: `turn-${turnNum}-reply`,
      userId: 'u1',
      memoryClass: 'SESSION',
      content: res.content,
      epistemicStatus: 'SYSTEM_GENERATED',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionPolicy: 'SESSION_ONLY',
      consentState: 'NOT_REQUIRED',
      source: 'LLM_REPLY'
    });

    const hasArabicInResponse = /[\u0600-\u06FF]/.test(res.content);
    const hasArabicInInput = /[\u0600-\u06FF]/.test(msg);
    const langLabel = hasArabicInInput ? 'ARABIC_INPUT' : 'ENGLISH_INPUT';
    const respLabel = hasArabicInResponse ? '→ ARABIC RESPONSE ✓' : '→ ENGLISH RESPONSE ✓';

    console.log(`\n─────── TURN ${turnNum} [${langLabel}] ${respLabel} ───────`);
    console.log(`INPUT:    ${msg}`);
    console.log(`OUTPUT:   ${res.content}`);
    console.log(`History entries so far: ${contextPackage.CURRENT_SESSION.length}`);
  };

  console.log('=== 4-TURN LANGUAGE SWITCHING TEST (same session/conversation) ===\n');
  await executeTurn(1, "I've been feeling overwhelmed lately with work deadlines.");   // ENGLISH
  await executeTurn(2, 'أنا مش عارف ازاي اتعامل مع الضغط ده خالص، حاسس اني تعبت'); // ARABIC
  await executeTurn(3, "That actually makes a lot of sense. Can you tell me more about those breathing techniques?"); // ENGLISH AGAIN
  await executeTurn(4, 'طيب، ممكن تساعدني اعمل خطة صغيرة للأسبوع الجاي؟'); // ARABIC AGAIN

  console.log('\n=== END OF TEST ===');
})();
