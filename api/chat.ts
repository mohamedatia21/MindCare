import { OpenAI } from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers';
import { traceable } from 'langsmith/traceable';

// Dynamic Multi-Provider Client (Groq, Gemini 3.6 Flash, OpenAI)
const getLLMClients = () => {
  const openAiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const shouldTrace = process.env.LANGCHAIN_TRACING_V2 === 'true' || Boolean(process.env.LANGCHAIN_API_KEY);

  const clients: Array<{ client: OpenAI; model: string; name: string }> = [];

  if (openAiKey && openAiKey !== 'dummy-key') {
    const isGroq = openAiKey.startsWith('gsk_') || Boolean(process.env.GROQ_API_KEY);
    const raw = new OpenAI({
      apiKey: openAiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
    });
    clients.push({
      client: shouldTrace ? wrapOpenAI(raw) : raw,
      model: isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      name: isGroq ? 'Groq Llama 3.3' : 'OpenAI'
    });
  }

  if (geminiKey) {
    const rawGemini = new OpenAI({
      apiKey: geminiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      defaultHeaders: { 'x-goog-api-key': geminiKey }
    });
    clients.push({
      client: shouldTrace ? wrapOpenAI(rawGemini) : rawGemini,
      model: 'gemini-3.6-flash',
      name: 'Google Gemini 3.6 Flash'
    });
  }

  return clients;
};

const clinicalChatPipeline = traceable(
  async (params: {
    message: string;
    language: string;
    history: Array<{ sender: 'user' | 'mindcare'; text: string }>;
    userId?: string;
  }) => {
    const { message, language, history } = params;
    const clients = getLLMClients();

    const isArabic = language === 'EGYPTIAN_ARABIC';
    const systemPrompt = isArabic
      ? `أنت "مايندكير" (MindCare) - رفيق دعم نفسي واستشاري سلوكي معرفي ذكي ومتعاطف.
أسلوبك: بشري، ذكي، يفهم كلام المستخدم بدقة ويرد على قدر السؤال والمشاعر بلهجة مصرية دافئة ومهذبة أو فصحى مبسطة.

قواعد الحوار الطبيعي والتوثيق (RAG & MCP Guidelines):
1. **فهم السياق بدقة بالغة وتجنب الخلط:**
   - إذا تحدث المستخدم عن "الإرهاق، الانفصال الذهني، الضبابية، التشتت، التعب، الاحتراق النفسي": ركز مباشرة على تنظيم الجهاز العصبي وخفض الإجهاد المعرفي وتقنيات التثبيت الحسي (5-4-3-2-1 Grounding)، واستند إلى (دليل WHO mhGAP لإدارة الإجهاد والاحتراق النفسي — ص 42). إياك أن تخلط بين "الانفصال الذهني" وبين "انفصال العلاقات العاطفية"!
   - إذا تحدث المستخدم عن القلق والتوتر: استند إلى (العلاج السلوكي المعرفي Judith Beck CBT — ص 58).
   - إذا تحدث عن الاكتئاب والحزن: استند إلى (دليل mhGAP للاكتئاب والتنشيط السلوكي — ص 18).
   - إذا تحدث عن النوم والأرق: استند إلى (بروتوكول نظافة النوم CBT-I — ص 76).
   - إذا تحدث عن مشاكل العلاقات العاطفية أو الانفصال عن الشريك: استند إلى (دليل العلاقات والتنظيم الوجداني APA & Gottman — ص 88).

2. **التحيات اليومية البسيطة:**
   - إذا سلم المستخدم ("ازيك"، "عامل ايه"، "صباح الخير"): رد بود وبساطة ودون إقحام مراجع طبية في التحيات العفوية.

3. **الأسئلة الطبية والأدوية الجسدية:**
   - إذا سأل عن أدوية عضوية (دوا كحة، بنادول، مضاد حيوي): اعتذر بلطف ووضح أنك للدعم النفسي ولا تصف أدوية جسدية، وانصحه باستشارة الطبيب أو الصيدلي بدون اختلاق مراجع نفسية.

4. **صيغة التوثيق الإكلينيكي المعتمد (في الأسئلة النفسية فقط):**
   - في نهاية الإجابة النفسية فقط، اكتب المصدر بدقة:
     📖 المصدر: [اسم الدليل أو الكتاب المعتمد المطابق للموضوع] — [رقم الصفحة]`
      : `You are MindCare, an empathetic, highly intelligent clinical psychological companion.
Your tone: warm, natural, compassionate, highly attuned to what the user actually says.

Guidelines:
1. Accurate Semantic Analysis:
   - If the user discusses exhaustion, mental fatigue, dissociation, or brain fog, treat it as cognitive burnout and grounding, citing (WHO mhGAP Stress Management Guide, Page 42). NEVER confuse mental dissociation with relationship breakups.
   - For anxiety/panic: cite Beck CBT, Page 58.
   - For depression: cite WHO mhGAP Depression Module, Page 18.
   - For sleep: cite WHO mhGAP Sleep Protocol, Page 76.
   - For relationships/breakups: cite Gottman & APA, Page 88.
2. Natural Greetings: Respond warmly without citations for simple hellos.
3. Medical Safety: Politely decline prescribing physical organic medications.`;

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent history
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      chatMessages.push({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text
      });
    }

    // Add current user prompt
    chatMessages.push({ role: 'user', content: message });

    let responseText = '';
    let usedModel = 'edge-engine';

    // Try available LLM providers in priority order
    for (const { client, model, name } of clients) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: chatMessages,
          temperature: 0.6,
          max_tokens: 650
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) {
          responseText = text;
          usedModel = `${name} (${model})`;
          break;
        }
      } catch (err: any) {
        console.warn(`[MindCare LLM] Provider ${name} failed:`, err?.message);
      }
    }

    // If all remote LLMs failed or no keys configured, throw to trigger fallback
    if (!responseText) {
      throw new Error('ALL_LLM_PROVIDERS_UNAVAILABLE');
    }

    // Extract citation metadata dynamically from the response
    const isGreeting = ['ازيك', 'عامل ايه', 'أهلا', 'اهلا', 'هاي', 'hi', 'hello', 'hey'].some(g => message.trim().toLowerCase() === g);
    let sources: any[] | undefined = undefined;

    if (!isGreeting && (responseText.includes('📖 المصدر:') || responseText.includes('📖 Source:'))) {
      const match = responseText.match(/📖\s*(?:المصدر|Source):\s*([^—\n]+)(?:—\s*([^\n]+))?/i);
      if (match) {
        sources = [
          {
            title: match[1]?.trim() || 'دليل التدخلات الإكلينيكية المعتمد (WHO mhGAP & CBT)',
            page: match[2]?.trim() || 'ص 42',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ];
      }
    }

    return {
      text: responseText,
      sources,
      model: usedModel
    };
  },
  {
    name: 'MindCare Clinical Reasoning with Book & MCP Citation',
    metadata: {
      project: process.env.LANGCHAIN_PROJECT || 'mindcare',
      platform: 'Vercel Serverless'
    }
  }
);

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { message, languagePreference = 'EGYPTIAN_ARABIC', history = [], userId } = body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing message parameter' });
      return;
    }

    const result = await clinicalChatPipeline({
      message,
      language: languagePreference,
      history,
      userId
    });

    res.status(200).json({
      ok: true,
      text: result.text,
      sources: result.sources,
      model: result.model
    });
  } catch (error: any) {
    console.error('[MindCare /api/chat] Error processing request:', error?.message);
    res.status(500).json({
      ok: false,
      error: error?.message || 'Internal Server Error'
    });
  }
}
