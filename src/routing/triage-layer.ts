import { SafetyState } from '../core/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { ExpertId } from '../experts/expert-types.js';

export type UrgencyLevel = 'CRITICAL' | 'ELEVATED' | 'ROUTINE';

export interface TriageDecision {
  urgency: UrgencyLevel;
  targetExpertId: ExpertId;
  directives: string[];
}

export class TriageLayer {
  
  // Egyptian Arabic Regex Rules for Imminent Threat (CRITICAL)
  private readonly criticalRules = [
    /أنا هنهي كل حاجة/i,
    /مبقاش في فايدة من عيشتي/i,
    /نفسي أنام ومصحاش تاني/i,
    /أنا بكتب رسالة الوداع/i,
    /هرتاح من الدنيا دي/i,
    /شريط برشام وهخلصه/i,
    /يارب خدني وريحني بقا/i,
    /هموت نفسي/i,
    /الموت أرحم/i,
    /أذيت نفسي ومش قادر/i,
    /مش عايز أكمل[،\s]*أنا همشي/i
  ];

  // Egyptian Arabic Regex Rules for Severe Distress (ELEVATED)
  private readonly elevatedRules = [
    /تعبت من كل حاجة خالص مفيش فايدة/i,
    /عبء على كل اللي حواليا/i,
    /الدنيا سودة في وشي/i,
    /محدش حاسس بيا/i,
    /مخنوق ومش طايق نفسي/i,
    /بعيط ومش عارف أعمل إيه/i,
    /بتدمر من جوايا بالبطيء/i,
    /أسوأ من اللي قبله/i,
    /فقدت الشغف/i,
    /لو اختفيت محدش هيزعل/i,
    /عايش ميت/i,
    /دماغي مش بتبطل تفكير هتجنن/i,
    /لوحدي تماماً في الدنيا/i,
    /بقع في حفرة ملهاش قاع/i,
    /مفيش أي أمل/i
  ];

  // Schema Triggers
  private readonly schemaRules = [
    { regex: /محدش بيفضل معايا/i, schema: 'ABANDONMENT' },
    { regex: /كلهم بيمشوا ويسيبوني/i, schema: 'ABANDONMENT' },
    { regex: /خايف يبعد عني/i, schema: 'ABANDONMENT' },
    { regex: /فيا حاجة غلط/i, schema: 'DEFECTIVENESS' },
    { regex: /مصلحش للحب/i, schema: 'DEFECTIVENESS' },
    { regex: /معيوب/i, schema: 'DEFECTIVENESS' },
    { regex: /محدش هيحبني بجد/i, schema: 'DEFECTIVENESS' },
    { regex: /هيسيبني/i, schema: 'ABANDONMENT' }
  ];

  public evaluate(input: UnifiedInput, currentSafetyState: SafetyState): TriageDecision {
    const text = input.text;

    // 1. Mandatory 24-Hour Cooldown Check
    // If the session is already in CRISIS, the Triage Layer forcefully ignores the text
    // and continuously routes to the Emergency Expert to maintain the lock.
    if (currentSafetyState === 'CRISIS') {
      return {
        urgency: 'CRITICAL',
        targetExpertId: 'EMERGENCY_HANDOFF',
        directives: ['ENFORCE_CRISIS_LOCK']
      };
    }

    // 2. Evaluate Input for Imminent Threat (CRITICAL)
    for (const rule of this.criticalRules) {
      if (rule.test(text)) {
        return {
          urgency: 'CRITICAL',
          targetExpertId: 'EMERGENCY_HANDOFF',
          directives: ['INITIATE_CRISIS_LOCK', 'PROVIDE_HOTLINE']
        };
      }
    }

    // 3. Evaluate Input for Severe Distress (ELEVATED)
    for (const rule of this.elevatedRules) {
      if (rule.test(text)) {
        return {
          urgency: 'ELEVATED',
          targetExpertId: 'SUPPORTIVE_LISTENER',
          directives: ['ENFORCE_EMPATHY', 'MONITOR_IDEATION']
        };
      }
    }

    // 4. Evaluate Input for Early Maladaptive Schemas
    for (const rule of this.schemaRules) {
      if (rule.regex.test(text)) {
        return {
          urgency: 'ROUTINE',
          targetExpertId: 'SCHEMA_THERAPY',
          directives: ['IDENTIFY_SCHEMA', 'VALIDATE_PAIN', `DETECTED_SCHEMA_${rule.schema}`]
        };
      }
    }

    // 5. Default Routine Routing
    return {
      urgency: 'ROUTINE',
      targetExpertId: 'SUPPORTIVE_LISTENER',
      directives: []
    };
  }
}
