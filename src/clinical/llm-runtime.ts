import { LLMProvider, ClinicalResponse } from './types.js';
import { OutputSafetyFilter } from './output-safety-filter.js';
import { ContextPackage, Actor } from '../memory/types.js';
import { AdvancedToolGate } from '../tools/tool-gate.js';
import { SafetyState, UserInput } from '../core/types.js';
import { CrisisResponseBuilder } from './crisis-response-builder.js';
import { MentalHealthSkill } from './skills/skill-types.js';

export class LLMRuntime {
  private MAX_TOOL_CALLS = 3;

  constructor(
    private provider: LLMProvider,
    private safetyFilter: OutputSafetyFilter,
    private toolGate: AdvancedToolGate,
    private crisisBuilder: CrisisResponseBuilder
  ) {}

  public async execute(
    input: UserInput,
    context: ContextPackage,
    getSafetyState: () => SafetyState,
    actor: Actor,
    skill: MentalHealthSkill
  ): Promise<ClinicalResponse> {
    
    // 1. Crisis State Hard Block (checked immediately)
    if (getSafetyState() === 'CRISIS') {
      const rawCrisisText = await this.crisisBuilder.buildCrisisResponse('US'); // Using US as default for runtime
      // Crisis fallback must STILL pass through output safety filter
      const safeCrisis = await this.safetyFilter.validate(rawCrisisText);
      return {
        content: safeCrisis.content,
        safe: false,
        blockedReason: 'CRISIS_STATE_LOCKDOWN'
      };
    }

    // 2. Deterministic Language Detection for this Turn
    // If the input contains Arabic unicode block, enforce Egyptian Arabic. Otherwise default to English.
    // This combined with session history memory guarantees no random language jumping.
    const hasArabic = /[\u0600-\u06FF]/.test(input.content);
    const enforcedLanguage = input.metadata?.languagePreference || (hasArabic ? 'EGYPTIAN_ARABIC' : 'ENGLISH');

    let toolCalls = 0;
    let currentContextData = JSON.stringify(context);

    // Runtime Loop
    while (toolCalls <= this.MAX_TOOL_CALLS) {
      try {
        const systemPolicy = this.buildClinicalPolicy(skill, enforcedLanguage);
        const response = await this.provider.generateResponse({
          systemPolicy,
          contextData: currentContextData,
          userMessage: input.content
        });

        if (getSafetyState() === 'CRISIS') {
          const rawCrisisText = await this.crisisBuilder.buildCrisisResponse('US');
          const safeCrisis = await this.safetyFilter.validate(rawCrisisText);
          return {
            content: safeCrisis.content,
            safe: false,
            blockedReason: 'CRISIS_STATE_LOCKDOWN'
          };
        }

        const filtered = await this.safetyFilter.validate(response);
        if (!filtered.safe) {
          return filtered;
        }

        if (response.requestedTool) {
          toolCalls++;
          if (toolCalls > this.MAX_TOOL_CALLS) {
            const fallback = await this.safetyFilter.validate("I needed to think too long about this. Let's try something else.");
            return { ...fallback, safe: false, blockedReason: 'LOOP_LIMIT_EXCEEDED' };
          }
          
          if (!skill.allowedTools.includes(response.requestedTool.toolName)) {
             const fallback = await this.safetyFilter.validate("I am not authorized to use that capability for this skill.");
             return { ...fallback, safe: false, blockedReason: 'UNAUTHORIZED_SKILL_TOOL' };
          }
          
          const toolResult = await this.toolGate.authorizeAndExecute({
             toolName: response.requestedTool.toolName,
             arguments: response.requestedTool.arguments,
             actor: actor,
             userId: input.userId,
             requestId: `req_${Date.now().toString()}`,
             timestamp: new Date()
          }, getSafetyState);

          currentContextData += `\n[TOOL_CALL: ${JSON.stringify(response.requestedTool)}]\n[TOOL_RESULT: ${toolResult.ok ? JSON.stringify(toolResult.value) : JSON.stringify(toolResult.error)}]`;
          continue; 
        }

        return filtered;

      } catch {
        const fallback = await this.safetyFilter.validate("I am currently experiencing technical difficulties. Please try again later.");
        return { ...fallback, safe: false, blockedReason: 'PROVIDER_ERROR' };
      }
    }

    const fallback = await this.safetyFilter.validate("Execution limits exceeded.");
    return { ...fallback, safe: false, blockedReason: 'LOOP_LIMIT_EXCEEDED' };
  }

  /**
   * Synthesizes the Clinical Mind from CleanRAG & Improved_RAG:
   * - Egyptian Arabic empathetic communication
   * - Strict WHO mhGAP grounding & anti-hallucination rules
   * - Prohibits diagnostic claims & medication prescriptions
   * - Adapts dynamically to the active mental health skill
   * - Evidence tier classification and citation verification
   * - Source provenance tracking
   */
  private buildClinicalPolicy(skill: MentalHealthSkill, enforcedLanguage: 'EGYPTIAN_ARABIC' | 'ENGLISH'): string {
    const languageInstruction = enforcedLanguage === 'EGYPTIAN_ARABIC'
      ? "CRITICAL RULE: The user communicated in Arabic. You MUST respond ONLY in warm, natural Egyptian Arabic (اللهجة المصرية العامية البسيطة)."
      : "CRITICAL RULE: The user communicated in English. You MUST respond ONLY in simple, natural English.";

    return `أنت مساعد تدريبي متخصص في الصحة النفسية، تعمل وفق دليل WHO mhGAP الإرشادي ومصادر طبية موثوقة (WHO, DSM-5, ICD-11).
المهارة الحالية: ${skill.name} (${skill.description}).

قواعد إجبارية على كل إجابة:

1. التحقق الطبي ومنع الاختلاق:
- تأكد أن كل معلومة مستندة لدليل WHO mhGAP أو الأدلة الطبية المعتمدة.
- لو مش متأكد أو المعلومة مش متوفرة في السياق، قول "مش متأكد من النقطة دي بدقة، والأفضل مراجعة متخصص" وماتختلقش أي معلومة.
- يجب استخدام أداة KNOWLEDGE_BASE_SEARCH للبحث في قاعدة المعرفة أولاً كمرجع أساسي.
- إذا استخدمت KNOWLEDGE_BASE_SEARCH ولم تجد إجابة، **يجب عليك استخدام أداة WEB_MEDICAL_SEARCH للبحث في المواقع الطبية العالمية** لإيجاد الإجابة.
- إذا كانت نتيجة البحث من أي أداة (TOOL_RESULT) تحتوي على معلومات مفيدة، أجب فوراً.

2. ذكر المصدر ومنع الاختلاق نهائياً:
- اذكر المصدر دائماً عندما تقدم معلومة طبية، نصيحة، أو إجابة تستند إلى دليل.
- اعتمد فقط على المعلومات المرجعة من نتائج البحث (TOOL_RESULT). ممنوع نهائياً الإجابة من معرفتك العامة.
- **استخدم أداة البحث مرة واحدة فقط**. إذا كانت نتيجة البحث فارغة (لا توجد معلومات)، **لا تقم بإعادة استخدام أداة البحث أبداً**. اعتذر فوراً وقل "عذراً، هذه المعلومة غير متوفرة في المراجع الطبية المعتمدة لدي، والأفضل مراجعة متخصص" ولا تقدم أي نصيحة إضافية.
- إذا كان المصدر كتاباً أو مستنداً (مثل mhGAP)، اذكر اسم المستند ورقم الصفحة كما هو موضح في نتيجة البحث. 
- إذا كان المصدر رابطاً (URL)، اذكر الرابط.
- التنسيق الإجباري للمصدر في نهاية الإجابة:
المصدر: [اسم المستند أو الجهة] - [رقم الصفحة أو الرابط]

3. تصنيف المصادر (مهم جداً):
- TIER_A (أعلى موثوقية): المنظمات الحكومية والدولية (WHO, NIMH, NIH, CDC, NHS, APA, NICE)
- TIER_B (عالي الموثوقية): مصادر أكاديمية وطبية (PubMed, Mayo Clinic, Cleveland Clinic, Cochrane)
- TIER_C (متوسط الموثوقية): مصادر تعليمية طبية (Wikipedia, WebTeb, Altibbi)
- استخدم المصادر الأعلى موثوقية أولاً عند توفرها.
- لا تستخدم المدونات العشوائية أو مواقع التواصل الاجتماعي كمصادر طبية.

4. التفريق بين الأدلة والاستنتاج:
- فرق بوضوح بين المعلومة المدعومة بمصدر (SUPPORTED_BY_SOURCE) والتفكير العام (MODEL_REASONING).
- لا تقدم استنتاج الذكاء الاصطناعي كحقيقة طبية مثبتة.
- عند تقديم رأي أو استنتاج، وضّح أنه ليس معلومة طبية مؤكدة.

5. التنسيق (مهم جداً لأن الواجهة لا تفسر الماركداون ولتسهيل النطق الصوتي TTS):
- ممنوع نهائي استخدام أي نجوم (**) أو شباك (###) أو خطوط مائلة (_) أو جداول (|) أو رموز ماركداون.
- اكتب نص عادي صافي تماماً بدون أي نجوم.
- اكتب جمل قصيرة وبسيطة ومريحة في كل سطر.
- للتعداد، استخدم شرطة (-) في بداية السطر فقط وسطر جديد لكل نقطة.

6. اللغة:
- ${languageInstruction}
- الكلام يكون تلقائي وطبيعي وداعم بدون تكلف أو نبرة روبوتية.

7. الطابع الطبي والتوعوي:
- أنت أداة تدريبية وتوعوية، ممنوع تماماً تشخيص المستخدم أو إعطاء أحكام قاطعة.
- ممنوع منعاً باتاً وصف أدوية أو تعديل جرعات.
- لو المستخدم وصف حالة شخصية، وجهه لأخصائي أو طبيب نفسي حقيقي.
- في حالات الطوارئ أو إيذاء النفس، قدم تعاطف هادئ ووجه فوراً لطلب المساعدة الطارئة وخطوط الدعم.

8. منع اختلاق المراجع:
- ممنوع نهائياً اختلاق أرقام صفحات أو عناوين كتب أو روابط إنترنت.
- استخدم فقط المعلومات الموجودة حرفياً في نتيجة البحث (TOOL_RESULT).
- إذا لم يكن رقم الصفحة متاحاً في نتيجة البحث، اكتب: "الصفحة الدقيقة غير متاحة في البيانات المتوفرة".
- إذا لم يكن الرابط متاحاً في نتيجة البحث، لا تكتب رابطاً.`;
  }
}

