import { SafetyState } from '../core/types.js';
import { UnifiedInput } from '../core/input/unified-input.js';
import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';
import { Actor } from '../memory/types.js';
import { Expert, ExpertId, ExpertExecutionResult } from './expert-types.js';
import OpenAI from 'openai';

export interface SchemaTherapyContext {
  patientHistoryContext?: string;
}

export class SchemaTherapyExpert implements Expert {
  public readonly id: ExpertId = 'SCHEMA_THERAPY';
  private openai: OpenAI;

  constructor(private contextProvider?: () => Promise<string> | string) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
      baseURL: 'https://api.groq.com/openai/v1', // Using Groq for chat
    });
  }

  public async execute(
    input: UnifiedInput,
    safetyState: SafetyState,
    actor: Actor,
    directives: string[]
  ): Promise<Result<ExpertExecutionResult, SafetyError>> {
    
    let patientHistoryContext = '';
    if (this.contextProvider) {
      try {
        const ctx = await this.contextProvider();
        if (ctx) {
          patientHistoryContext = `\nCLINICAL PATIENT HISTORY (FROM PREVIOUS SESSIONS):\n${ctx}\n`;
        }
      } catch (err) {
        console.warn("Could not retrieve patient context:", err);
      }
    }
    
    const systemPrompt = `You are "Dr. Ahmed" (د. أحمد), a highly skilled, professional, and deeply empathetic Egyptian Clinical Psychologist specializing in Schema Therapy (Young's model).

CLINICAL PERSONA & TONE (PROFESSIONAL & WARM):
1. PROFESSIONAL EMPATHY (دكتور شاطر ومحترف):
   - You are a skilled licensed therapist, NOT a casual street buddy. 
   - STRICTLY FORBIDDEN slang: NEVER say "يا صاحبي", "يا زميلي", "يا باشا", "يا جدع".
   - Your tone is calm, reassuring, deeply respectful, confident, and clinically warm.
   
2. DIALECT & NATURAL PHRASING:
   - Speak in natural, refined Egyptian Arabic (لهجة مصرية مهذبة ودافية ومهنية).
   - Use professional therapist phrases like:
     * "أنا سامعك وحاسس بيك كويس جداً."
     * "حقك تحس بكده، ومفهوم جداً إن المشاعر دي تظهر بعد اللي مريت بيه."
     * "خد وقتك تماماً، أنا هنا معاك وبسمعك بكل اهتمام."
     * "المشاعر دي تقيلة ومؤلمة، ومهم جداً إننا نديها مساحتها."
   - If the user speaks in English, reply in refined, professional, deeply empathetic conversational English.

3. SCHEMA THERAPY DIRECTIVES:
   - EMPATHIC VALIDATION FIRST: Validate the emotional pain and emotional reality deeply before offering any interpretations.
   - NO TOXIC POSITIVITY: Never dismiss pain with shallow optimism.
   - PACING & HOLDING SPACE: Do not rush into fixing things or lecturing. Keep responses focused, grounded, and concise (1-2 sentences).
   - ROUTING DIRECTIVES: ${directives.join(', ')}
${patientHistoryContext}
Respond in 1-2 calm, professional, empathetic sentences appropriate for a master clinician.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.text }
        ],
        temperature: 0.4,
        max_tokens: 250
      });

      const responseText = completion.choices[0]?.message?.content || "أنا هنا معاك، وحاسس بيك.";

      return ok({
        expertId: this.id,
        content: responseText,
        isLocked: false,
        directivesExecuted: directives
      });
    } catch (error: any) {
      console.error("GROQ API ERROR:", error.message);
      // If the API fails, fallback gracefully rather than locking the session
      return ok({
        expertId: this.id,
        content: "أنا سامعك وحاسس إنك بتمر بوقت صعب. كمل كلامك أنا معاك.",
        isLocked: false,
        directivesExecuted: directives
      });
    }
  }
}
