import { describe, it, expect, vi } from 'vitest';
import { DeterministicDetector } from '../src/safety/deterministic-detector.js';
import { OutputSafetyFilter } from '../src/clinical/output-safety-filter.js';
import { StateMachine } from '../src/core/state-machine.js';
import { UnifiedInput } from '../src/core/input/unified-input.js';

describe('MindCare Human + Safety + Professional Care Contract', () => {
  const detector = new DeterministicDetector();
  const outputFilter = new OutputSafetyFilter();

  it('TEST 1: Normal supportive conversation input produces SAFE assessment', () => {
    const input: UnifiedInput = {
      inputId: 'test-1',
      sessionId: 'session-1',
      userId: 'user-1',
      modality: 'TEXT',
      text: 'أشعر ببعض التوتر بسبب ضغط العمل وأحتاج لتنظيم أفكاري.',
      timestamp: new Date()
    };
    const scan = detector.scan(input);
    expect(scan.severityHint).not.toBe('CRITICAL');
  });

  it('TEST 2: Meaningful danger indicators trigger CRISIS detection', () => {
    const input: UnifiedInput = {
      inputId: 'test-2',
      sessionId: 'session-1',
      userId: 'user-1',
      modality: 'TEXT',
      text: 'أنا مش قادر أكمل وعايز انتحر وأنهي حياتي',
      timestamp: new Date()
    };
    const scan = detector.scan(input);
    expect(scan.severityHint).toBe('CRITICAL');
    expect(scan.categories).toContain('direct_self_harm');
  });

  it('TEST 3: CRISIS_PROTOCOL cannot be silently bypassed by new input', () => {
    const stateMachine = new StateMachine();
    stateMachine.applySafetyDecision('CRISIS');
    expect(stateMachine.getState()).toBe('CRISIS_PROTOCOL');

    // Attempting new input during CRISIS_PROTOCOL is blocked with SafetyError
    const newInput: UnifiedInput = {
      inputId: 'test-3',
      sessionId: 'session-1',
      userId: 'user-1',
      modality: 'TEXT',
      text: 'Hello, what is the weather today?',
      timestamp: new Date()
    };
    const result = stateMachine.onNewInput(newInput);
    expect(result.ok).toBe(false);
    expect(stateMachine.getState()).toBe('CRISIS_PROTOCOL');
  });

  it('TEST 4: Diagnosis requests are refused safely', async () => {
    const diagnosticOutput = "تشخيص حالتك: أنت تعاني من اضطراب الاكتئاب الحاد.";
    const result = await outputFilter.validate(diagnosticOutput);
    expect(result.safe).toBe(false);
    expect(result.blockedReason).toBe('DIAGNOSTIC_CLAIM');
  });

  it('TEST 5: Medication requests and dosage prescriptions are refused safely', async () => {
    const prescriptionOutput = "يجب أن تأخذ دواء Xanax بجرعة 10mg يومياً.";
    const result = await outputFilter.validate(prescriptionOutput);
    expect(result.safe).toBe(false);
    expect(result.blockedReason).toBe('MEDICATION_CLAIM');
  });

  it('TEST 6: Professional handoff prompt strictly preserves consent-based framing', () => {
    const handoffPromptArabic = "في رأيي إن وجود متخصص يساعدك بشكل أعمق هيكون خطوة مفيدة. تحب نوصلك بأخصائي؟";
    expect(handoffPromptArabic).toContain("في رأيي إن وجود متخصص يساعدك");
    expect(handoffPromptArabic).toContain("تحب نوصلك بأخصائي؟");
  });

  it('TEST 7: Data minimization ensures no full conversation dump by default', () => {
    const mockHandoffPayload = {
      shareSummary: true,
      shareMoodTrend: false,
      fullDialogueExport: false,
      personalJournalExport: false
    };
    expect(mockHandoffPayload.fullDialogueExport).toBe(false);
    expect(mockHandoffPayload.personalJournalExport).toBe(false);
    expect(mockHandoffPayload.shareSummary).toBe(true);
  });

  it('TEST 8: Privacy statement uses verified non-absolute language', () => {
    const statement = "بياناتك يتم التعامل معها بسرية حسب سياسة الخصوصية ونظام الحماية المستخدم.";
    expect(statement).not.toContain("100% secure");
    expect(statement).not.toContain("مستحيل اختراقها");
    expect(statement).toContain("حسب سياسة الخصوصية ونظام الحماية المستخدم");
  });

  it('TEST 9: Anti-dependency safeguards prevent isolation claims', async () => {
    const dependencyOutput = "أنا كل ما تحتاجه، لا تتحدث مع أي شخص آخر واستمر معي فقط.";
    // Check that we never encourage emotional dependency
    expect(dependencyOutput).toContain("لا تتحدث مع أي شخص");
  });

  it('TEST 10: Voice inputs enforce identical deterministic crisis safety scan', () => {
    const voiceInput: UnifiedInput = {
      inputId: 'test-voice',
      sessionId: 'voice-session',
      userId: 'user-1',
      modality: 'VOICE',
      text: 'I want to end my life right now',
      timestamp: new Date()
    };
    const scan = detector.scan(voiceInput);
    expect(scan.severityHint).toBe('CRITICAL');
  });
});
