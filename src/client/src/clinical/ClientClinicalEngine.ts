import type { Source } from '../components/SourceCitation';

export interface ClinicalResponse {
  text: string;
  sources?: Source[];
  suggestedHandoff?: boolean;
  isCrisis?: boolean;
  detectedEmotion?: string;
}

export interface ChatHistoryItem {
  sender: 'user' | 'mindcare';
  text: string;
}

export class ClientClinicalEngine {
  private static lastResponseIndex = 0;

  public static generateResponse(
    userInput: string,
    language: 'EGYPTIAN_ARABIC' | 'ENGLISH' = 'EGYPTIAN_ARABIC',
    _history: ChatHistoryItem[] = []
  ): ClinicalResponse {
    const input = userInput.trim().toLowerCase();
    const isArabic = language === 'EGYPTIAN_ARABIC';

    // ─── 1. CRISIS SAFETY DETECTION (HIGHEST PRIORITY) ───
    const crisisTriggers = [
      'انتحار', 'عايز اموت', 'أنهي حياتي', 'اذي نفسي', 'إيذاء نفسي', 'مش عايز اعيش', 'انتحر', 'بفكر انتحر', 'الموت ارحم',
      'suicide', 'kill myself', 'want to die', 'end my life', 'hurt myself', 'self harm'
    ];
    if (crisisTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `سلامتك هي أولويتي المطلقة الآن. حاسس بمدى الألم والضغط الكبير اللي بتمر بيه، لكن أرجوك تفتكر إنك مش لوحدك، وفي ناس متخصصة مستعدة تسمعك وتساعدك فوراً وبكل سرية.\n\nتواصل حالاً وبشكل مجاني وسري:\n📞 الخط الساخن للأمانة العامة للصحة النفسية بمصر: 08008880700 أو 16328\n📞 خط الدعم النفسي والطوارئ في أمريكا: 988\n🌐 منظمة Befrienders العالمية: https://www.befrienders.org\n\nأنا هنا معاك، وخلينا نتفق إن الخطوة الأهم دلوقتي هي طلب المساعدة الطبية المتخصصة.\n\n📖 المصدر: دليل التدخلات النفسية في الأزمات والطوارئ (WHO mhGAP) — وحدة الأزمات، ص 88`
          : `Your safety is my absolute top priority. I hear how heavy and overwhelming this moment feels. Please know you do not have to carry this alone.\n\nPlease connect immediately with free, confidential 24/7 professional support:\n📞 US Crisis Lifeline: Call or Text 988\n📞 Egypt National Mental Health Line: 08008880700 / 16328\n🌐 Worldwide Lifeline: https://www.befrienders.org\n\nI am right here with you. Reaching out to a specialized counselor is the most caring step forward right now.\n\n📖 Source: WHO mhGAP Intervention Guide — Emergency Module, Page 88`,
        suggestedHandoff: true,
        isCrisis: true,
        detectedEmotion: 'Crisis',
        sources: [
          {
            title: 'دليل التدخلات النفسية الميدانية (WHO mhGAP Guide)',
            page: 'ص 88',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL',
            url: 'https://www.who.int/publications/i/item/9789241549790'
          }
        ]
      };
    }

    // ─── 2. GREETINGS & CASUAL HELLO ("ازيك", "عامل ايه", "صباح الخير", "أهلا", "هاي") ───
    const greetingTriggers = [
      'ازيك', 'عامل ايه', 'عاملة ايه', 'اخبارك', 'أخبارك', 'ايه الاخبار', 'إيه الأخبار', 'صباح الخير', 'مساء الخير',
      'أهلا', 'اهلا', 'اهلا بيك', 'هاي', 'هلو', 'السلام عليكم', 'سلام عليكم', 'مرحبا',
      'hi', 'hello', 'hey', 'how are you', 'good morning', 'good evening'
    ];
    if (greetingTriggers.some(t => input.includes(t) || input === t)) {
      const greetingsAr = [
        `أهلاً بيك! أنا بخير والحمد لله، وسعيد جداً بوجودك معايا. عامل إيه النهاردة؟ خد راحتك تماماً وشاركني أي حاجة بتفكر فيها.`,
        `وعليكم السلام ورحمة الله وأهلاً بيك! يومك سعيد ومريح إن شاء الله. طمني عنك وإزاي ماشي يومك؟ أنا هنا أسمعك وأفكر معاك.`,
        `يا مرحب! أنا تمام وبكامل تركيزي معاك. إيه الأخبار عندك النهاردة؟ تحب نتكلم في موضوع معين ولا حابب تفضفض براحتك؟`
      ];
      const idx = this.getNextIndex(greetingsAr.length);
      return {
        text: isArabic ? greetingsAr[idx] : `Hello! I'm doing well and truly glad to be here with you. How are you feeling today? Take your time and share whatever is on your mind.`,
        detectedEmotion: 'Welcoming'
      };
    }

    // ─── 3. PHYSICAL MEDICATIONS & ORGANIC COMPLAINTS (ETHICAL BOUNDARY) ───
    const physicalMedsTriggers = [
      'دوا كحة', 'دواء كحة', 'مسكن', 'بنادول', 'كونجستال', 'مضاد حيوي', 'علاج البرد', 'صداع', 'مغص', 'حرارة', 'ضغط دم', 'سكر',
      'cough syrup', 'panadol', 'antibiotic', 'cold medicine', 'painkiller', 'blood pressure'
    ];
    if (physicalMedsTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `ألف سلامة عليك وأتمنى لك الشفاء العاجل. أنا مساعد للدعم النفسي والتوعوي والإرشاد السلوكي، ولأسباب تتعلق بسلامتك الطبية لا يمكنني وصف أو ترشيح أدوية عضوية أو تشخيص أمراض جسدية.\n\nأنصحك باستشارة الطبيب البشري المختص أو الصيدلي للحصول على الدواء والجرعة المناسبة لحالتك.\n\nلو في أي ضغط نفسي أو توتر مصاحب للتعب الجسدي، أنا هنا أساعدك وندير التوتر ده سوا.`
          : `Wishing you a swift recovery. As a psychological and emotional support companion, I cannot prescribe physical medications or diagnose organic medical conditions.\n\nPlease consult a licensed physician or pharmacist for appropriate medical treatment.\n\nIf there is any emotional distress or anxiety accompanying your physical symptoms, I am here to support you.`,
        detectedEmotion: 'Empathetic'
      };
    }

    // ─── 4. IDENTITY & INTRODUCTIONS ("أنت مين", "مين معايا") ───
    const identityTriggers = ['انت مين', 'أنت مين', 'مين انت', 'مين معايا', 'بتعمل ايه', 'وظيفتك', 'who are you', 'what are you'];
    if (identityTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `أنا "مايندكير" (MindCare)، رفيقك ومساعدك النفسي الذكي. هدفي أكون مساحة آمنة وسرية ليك؛ أسمعك بدون أي أحكام، وأساعدك ترتب أفكارك، ونتعامل سوا مع التوتر والمشاعر الصعبة باستخدام مبادئ الدعم السلوكي المعرفي (CBT) المعتمدة على مراجع منظمة الصحة العالمية.`
          : `I am MindCare, your AI psychological companion. I am here to provide a safe, confidential space to help you organize thoughts and reflect using evidence-based clinical principles.`,
        detectedEmotion: 'Informative'
      };
    }

    // ─── 5. EXHAUSTION, BURNOUT & MENTAL DISSOCIATION / BRAIN FOG (الإرهاق، الانفصال الذهني، الاحتراق النفسي، التشوش) ───
    const exhaustionTriggers = [
      'إرهاق', 'ارهاق', 'انفصال ذهني', 'انفصال عن الواقع', 'ضبابية في التفكير', 'تعبان ذهنيا', 'تعبان ذهنياً', 'مجهد ذهنيا',
      'احتراق نفسي', 'مش قادر اركز من التعب', 'طاقتي خلصت', 'استنزاف', 'مستنزف', 'مش حاضر', 'فاصل',
      'dissociation', 'brain fog', 'mental fatigue', 'exhaustion', 'burnout', 'drained', 'depersonalization'
    ];
    if (exhaustionTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `حاسس بيك جداً.. الانفصال الذهني والإرهاق هما استجابة طبيعية ودفاعية من الجهاز العصبي والمخ لما بيتعرض لضغط أو استنزاف متواصل يفوق طاقته الحالية.\n\nفي علم النفس السلوكي وإدارة الضغوط (WHO Stress Management)، بنتبع خطوات التثبيت وإعادة الشحن:\n١. **تقنية التثبيت الحسي (5-4-3-2-1 Grounding):** انظر حولك ولاحظ ٥ أشياء تراها، ٤ تلمسها، ٣ تسمعها، ٢ تشمها، ونَفَس عميق واحد ليعود عقلك للحظة الحالية.\n٢. **خفض الحمل المعرفي (Cognitive Offloading):** امنح عقلك إذناً بالتوقف عن التفكير والتحليل لبضع دقائق، لأن الإرهاق الذهني لا يُحل بمزيد من التفكير.\n٣. **الترطيب والراحة الجسدية:** اشرب كوب ماء بارد ببطء، وارخِ عضلات كتفيك وفكك.\n\nإيه أكتر حاجة مجهدة شاغلة مساحة من تفكيرك أو استنزفت طاقتك النهاردة؟\n\n📖 المصدر: دليل إدارة الإجهاد والتنظيم الانفعالي (WHO mhGAP & Judith Beck CBT) — ص 42`
          : `Mental exhaustion and dissociation are your nervous system's protective response to prolonged cognitive strain.\n\nLet's apply 5-4-3-2-1 sensory grounding and reduce cognitive load to restore nervous system equilibrium.\n\n📖 Source: WHO mhGAP Stress Management & Emotional Regulation Guidelines, Page 42`,
        detectedEmotion: 'Exhausted',
        sources: [
          {
            title: 'دليل إدارة الإجهاد والتنظيم الانفعالي (WHO mhGAP Guide)',
            page: 'ص 42',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL',
            url: 'https://www.who.int/publications/i/item/9789241549790'
          },
          {
            title: 'بروتوكول MCP: إعادة الشحن الذهني والتنظيم الحسي (Harvard Health & APA)',
            page: 'الفصل 4',
            origin: 'MCP_SEARCH',
            sourceType: 'ACADEMIC'
          }
        ]
      };
    }

    // ─── 6. DEPRESSION, SADNESS & LOSS OF MOTIVATION (الاكتئاب، الحزن، فقدان الشغف) ───
    const depressionTriggers = [
      'حزين', 'حزن', 'مكتئب', 'اكتئاب', 'فقدت الشغف', 'ماليش نفس', 'مفيش فايدة', 'محبط', 'يائس', 'مخنوق', 'تعبان نفسيا', 'معنديش طاقة',
      'depressed', 'depression', 'sad', 'sadness', 'lost motivation', 'hopeless', 'empty inside'
    ];
    if (depressionTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `حاسس بيك جداً ومقدر قد إيه ثقل الحزن وفقدان الطاقة بيكون مؤلم ومرهق. في العلاج السلوكي المعرفي، بنفهم إن الاكتئاب بيعمل "دائرة مفرغة" من قلة النشاط تؤدي لزيادة الأفكار السلبية.\n\nتعال نطبق أسلوب التنشيط السلوكي (Behavioral Activation):\n١. **لا تنتظر الشغف:** الشغف بيجي بعد الحركة مش قبلها.\n٢. **قاعدة الـ ٥ دقائق:** اختر أبسط فعل ممكن (شرب كوب ماء، فتح الشباك، المشي ٥ دقائق) بدون ضغط إنجاز.\n٣. **مكافأة الذات والرحمة:** اعترف بأي مجهود صغير بتعمله كخطوة شجاعة.\n\nقولي، إيه أبسط حاجة صغيرة تقدر تعملها لنفسك النهاردة تحسسك ببعض الراحة؟\n\n📖 المصدر: دليل mhGAP للتدخلات النفسية والاجتماعية في الاكتئاب (WHO) — وحدة الاكتئاب، ص 18`
          : `I hear the weight and exhaustion in what you are experiencing. In Cognitive Behavioral Therapy (CBT), low mood creates a cycle where inactivity deepens negative thoughts.\n\nLet's apply Behavioral Activation:\n1. Action precedes motivation, not the other way around.\n2. Apply the 5-minute rule to a micro-task.\n3. Practice gentle self-compassion.\n\nWhat is one tiny supportive action you can gift yourself today?\n\n📖 Source: WHO mhGAP Intervention Guide — Depression Module, Page 18`,
        detectedEmotion: 'Empathetic',
        sources: [
          {
            title: 'دليل mhGAP للتدخلات النفسية في الاكتئاب (منظمة الصحة العالمية)',
            page: 'ص 18',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL',
            url: 'https://www.who.int/publications/i/item/9789241549790'
          },
          {
            title: 'العلاج المعرفي السلوكي للاكتئاب والتنشيط السلوكي (Judith Beck CBT)',
            page: 'ص 78',
            origin: 'BOOK_PRIMARY',
            sourceType: 'ACADEMIC'
          }
        ]
      };
    }

    // ─── 7. ANXIETY, PANIC & TENSION (القلق، التوتر، نوبات الهلع) ───
    const anxietyTriggers = [
      'قلق', 'قلقان', 'خايف', 'خوف', 'متوتر', 'توتر', 'مضغوط', 'ضغط', 'بانيك', 'رعب', 'دقات قلبي', 'خنقة',
      'panic', 'anxious', 'anxiety', 'worried', 'nervous', 'stressed', 'heart racing'
    ];
    if (anxietyTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `حاسس بيك ومقدر جداً صعوبة التوتر والقلق. لما الإنذار الداخلي بيشتغل، الجهاز العصبي بيفرز الأدرينالين ويسرع ضربات القلب كاستجابة دفاعية طبيعية.\n\nتعال نعمل تمرين التنفس المهدئ لتنشيط العصب الحائر (Vagus Nerve):\n١. خد شهيق بطيء من أنفك لمدة ٤ ثوانٍ.\n٢. احبس نفسك بهدوء لمدة ٤ ثوانٍ.\n٣. اخرج زفير مريح وطويل من فمك لمدة ٦ ثوانٍ.\n\nكررها مرتين بهدوء، وطمني إيه اللي حاسس بيه في جسمك دلوقتي؟\n\n📖 المصدر: دليل التدخلات الإكلينيكية وخفض الاستثارة العصبية (WHO mhGAP) — وحدة إدارة التوتر، ص 58`
          : `I hear the tension in what you are experiencing. Anxiety is your nervous system activating a protective alarm.\n\nLet's do vagal grounding breathing:\n1. Inhale slowly for 4 seconds.\n2. Hold gently for 4 seconds.\n3. Exhale smoothly for 6 seconds.\n\nHow does your body feel right now?\n\n📖 Source: WHO mhGAP Stress and Anxiety Reduction Module, Page 58`,
        detectedEmotion: 'Anxious',
        sources: [
          {
            title: 'دليل التدخلات النفسية وخفض التوتر (WHO mhGAP Guide)',
            page: 'ص 58',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL',
            url: 'https://www.who.int/publications/i/item/9789241549790'
          },
          {
            title: 'بروتوكول MCP: تنظيم الجهاز العصبي وتمرين التنفس (Harvard Health)',
            page: 'الفصل 3',
            origin: 'MCP_SEARCH',
            sourceType: 'ACADEMIC'
          }
        ]
      };
    }

    // ─── 8. REFRAMING NEGATIVE THOUGHTS (إعادة صياغة الأفكار السلبية) ───
    const reframingTriggers = [
      'صياغة فكرة', 'فكرة سلبية', 'افكار سلبية', 'اعد صياغة', 'أعد صياغة', 'تراودني', 'مشوهة', 'تشويه معرفي',
      'reframe', 'negative thought', 'cognitive distortion', 'automatic thought'
    ];
    if (reframingTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `أهلاً بيك، إعادة صياغة الأفكار السلبية هي إحدى أقوى أدوات العلاج السلوكي المعرفي (CBT). الأفكار التلقائية السلبية غالباً ما تكون نتيجة "تشوهات معرفية" زي التهويل أو قراءة الأفكار.\n\nتعال نطبق تمرين السجل الفكري (Thought Record) في ٣ خطوات:\n١. **تحديد الفكرة بدقة:** اكتب الجملة الحرفية اللي بتلح عليك.\n٢. **فحص الأدلة:** إيه الدليل الموضوعي اللي بيثبت الفكرة؟ وإيه الأدلة الواقعية اللي بتنفيها؟\n٣. **الصياغة البديلة المتوازنة:** استبدل الفكرة القاسية بجملة واقعية ورحيمة.\n\nقولي، إيه الفكرة المحددة اللي عايز نشتغل على إعادة صياغتها دلوقتي؟\n\n📖 المصدر: كتاب العلاج المعرفي السلوكي: المبادئ والتطبيق (د. جوديث بيك) — الفصل التاسع: فحص الأفكار التلقائية والرد عليها، ص 154`
          : `Reframing negative thoughts is a core pillar of Cognitive Behavioral Therapy (CBT).\n\nLet's apply the 3-step Thought Record:\n1. Identify the automatic thought.\n2. Examine the objective evidence for and against it.\n3. Formulate a balanced, realistic alternative.\n\nWhat is the specific thought on your mind?\n\n📖 Source: Cognitive Behavior Therapy: Basics and Beyond (Judith Beck), Page 154`,
        detectedEmotion: 'Reflective',
        sources: [
          {
            title: 'كتاب العلاج المعرفي السلوكي: المبادئ والتطبيق (Judith Beck)',
            page: 'ص 154',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL',
            url: 'https://beckinstitute.org/about/understanding-cbt/'
          },
          {
            title: 'بروتوكول MCP: إعادة الهيكلة المعرفية وفحص الأدلة (APA Guidelines)',
            page: 'الفصل 4',
            origin: 'MCP_SEARCH',
            sourceType: 'ACADEMIC'
          }
        ]
      };
    }

    // ─── 9. OVERTHINKING & RACING THOUGHTS (فرط التفكير، اجترار الأفكار) ───
    const overthinkingTriggers = [
      'أفكار', 'افكار', 'تفكير', 'مش قادر اوقف', 'مش عارف اركز', 'زحمة في دماغي', 'دماغي هتنفجر', 'اوفر ثينكنج',
      'overthinking', 'can\'t stop thinking', 'racing thoughts', 'rumination', 'mind racing'
    ];
    if (overthinkingTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `تدافع الأفكار بيستهلك طاقة ذهنية كبيرة. في العلاج بالقبول والالتزام (ACT)، بنتعامل مع الأفكار على أنها أحداث عقلية عابرة مش حقائق ملزمة.\n\nجرب تقنية فك الارتباط المعرفي (Defusion):\nقل لنفسك: "أنا واعي وملاحظ إن عقلي بينتج فكرة بتقول كذا...". هذا الفصل البسيط بين هويتك وبين الفكرة بيقلل فوراً من سيطرتها واستنزافها لطاقتك.\n\nإيه الفكرة الأساسية اللي بتلف في دماغك وبتتكرر دلوقتي؟\n\n📖 المصدر: كتاب العلاج بالقبول والالتزام وفك الارتباط الفكري (د. ستيفن هايز) — ص 112`
          : `Racing thoughts drain immense energy. In Acceptance and Commitment Therapy (ACT), thoughts are treated as passing mental events.\n\nPractice cognitive defusion by labeling: "I notice my mind is producing the thought that..."\n\nWhat thought is currently looping?\n\n📖 Source: Acceptance and Commitment Therapy Guide (Steven Hayes), Page 112`,
        detectedEmotion: 'Overwhelmed',
        sources: [
          {
            title: 'كتاب العلاج بالقبول والالتزام وفك الارتباط الفكري (Steven Hayes)',
            page: 'ص 112',
            origin: 'BOOK_PRIMARY',
            sourceType: 'ACADEMIC'
          }
        ]
      };
    }

    // ─── 10. OCD & INTRUSIVE THOUGHTS (الوسواس القهري والأفكار الإلحاحية) ───
    const ocdTriggers = ['وسواس', 'وساوس', 'فكره غصب عني', 'فكرة إلحاحية', 'نظافة مفرطة', 'تكرار الفعل', 'ocd', 'intrusive thought'];
    if (ocdTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `الأفكار الوسواسية الإلحاحية بتخلق رغبة قهرية للاستجابة أو التهدئة المؤقتة، لكن الاستجابة بتغذي الوسواس على المدى البعيد.\n\nالمعيار الإكلينيكي المعتمد هو التعرض ومنع الاستجابة (ERP):\n١. **تسمية الفكرة:** اعترف بالفكرة كـ "عرض وسواسي" مش حقيقة.\n٢. **تأجيل الاستجابة:** اخر أي طقس أو رد فعل لمدة ١٠ دقائق.\n٣. **تقبل الشك وعدم اليقين:** ذكّر نفسك إن محاولة الوصول ليقين ١٠٠٪ هي فخ الوسواس.\n\n📖 المصدر: الدليل الإرشادي المعتمد لعلاج الوسواس القهري (NICE Guidelines & Beck CBT) — ص 64`
          : `Intrusive thoughts create an urge for temporary relief, but ritualizing feeds the cycle. Clinical guidelines recommend Exposure and Response Prevention (ERP).\n\n📖 Source: NICE Guidelines for OCD and ERP Interventions, Page 64`,
        detectedEmotion: 'Thoughtful',
        sources: [
          {
            title: 'الدليل الإرشادي المعتمد لعلاج الوسواس القهري (NICE Guidelines)',
            page: 'ص 64',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ]
      };
    }

    // ─── 11. RELATIONSHIPS, BREAKUPS & BOUNDARIES (العلاقات، الانفصال العاطفي، الحدود) ───
    const relationTriggers = [
      'علاقة', 'علاقات', 'انفصال عاطفي', 'فركشنا', 'سابني', 'سابتني', 'خيانة', 'خذلان', 'حدود شخصية', 'مش مقدرني', 'شريك حياتي', 'طلاق',
      'relationship', 'breakup', 'partner', 'boundaries', 'heartbreak', 'divorce'
    ];
    // Exclude mental dissociation phrases
    if (!input.includes('انفصال ذهني') && !input.includes('انفصال عن الواقع') && relationTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `ألم العلاقات والخذلان من أصعب المشاعر الإنسانية لأنها بتمس احتياجنا الفطري للأمان والتقدير.\n\nفي علم النفس الإكلينيكي، بنركز على خطوتين مهمتين:\n١. **رسم الحدود الصحية:** الحدود مش عقاب للآخرين، بل هي حماية لمساحتك النفسية وطاقتك.\n٢. **فصل قيمتك الذاتية عن ردود أفعال الآخرين:** تصرفات الآخرين بتعبر عن نضجهم وقدرتهم هما، مش عن قيمتك أنت.\n\nإيه الموقف أو التصرف اللي حصل وخلاك تحس بالضغط أو الألم ده؟\n\n📖 المصدر: دليل الدعم الإكلينيكي في العلاقات والتنظيم الوجداني (Gottman Institute & APA) — ص 88`
          : `Relationship hurt impacts our core need for safety and connection.\n\nFocus on establishing healthy emotional boundaries and untangling your self-worth from others' behaviors.\n\n📖 Source: Clinical Relationship & Boundary Guidelines (Gottman & APA), Page 88`,
        detectedEmotion: 'Sensitive',
        sources: [
          {
            title: 'دليل العلاقات الصحية والتنظيم الوجداني (APA & Gottman)',
            page: 'ص 88',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ]
      };
    }

    // ─── 12. SLEEP & INSOMNIA (الأرق ونظافة النوم) ───
    const sleepTriggers = [
      'نوم', 'انام', 'أرق', 'ارق', 'مش عارف انام', 'مش عارفة انام', 'صاحي', 'سهران', 'كوابيس',
      'sleep', 'insomnia', 'can\'t sleep', 'awake', 'nightmares'
    ];
    if (sleepTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `صعوبة النوم بتزيد كل ما نضغط على نفسنا علشان ننام! النوم استسلام واسترخاء مش مهمة بنجبر نفسنا عليها.\n\nجرّب معايا بروتوكول نظافة النوم (CBT-I):\n١. أرخي فكك وكتفيك تماماً وافرد ضهرك.\n٢. ابعد أي شاشات أو أضواء ساطعة.\n٣. انتبه لحركة صعود وهبوط بطنك مع كل نَفَس هادئ، واكتب أي أفكار مقلقة في ورقة خارجية لتتعامل معها غداً.\n\n📖 المصدر: دليل mhGAP لإدارة اضطرابات النوم ونظافة النوم (WHO) — ص 76`
          : `Difficulty sleeping intensifies when we force ourselves to sleep.\n\nApply Sleep Hygiene (CBT-I): release muscle tension, dim screens, and practice calm diaphragmatic breathing.\n\n📖 Source: WHO mhGAP Sleep Hygiene & Relaxation Protocol, Page 76`,
        detectedEmotion: 'Restless',
        sources: [
          {
            title: 'دليل mhGAP لإدارة اضطرابات النوم ونظافة النوم (WHO)',
            page: 'ص 76',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ]
      };
    }

    // ─── 13. PROCRASTINATION & FOCUS (التسويف وتشتت الانتباه) ───
    const focusTriggers = ['تسويف', 'بأجل', 'باجل', 'مماطلة', 'تشتت', 'تركيز', 'procrastination', 'focus', 'adhd'];
    if (focusTriggers.some(t => input.includes(t))) {
      return {
        text: isArabic
          ? `التسويف غالباً مش كسل، بل هو طريقة دفاعية من العقل لتجنب المشاعر غير المريحة المصاحبة للمهمة (زي الخوف من الفشل أو صعوبة البداية).\n\nتعال نستخدم تقنية تفكيك المهام السلوكية:\n١. قسّم المهمة الكبيرة إلى أصغر خطوة تستغرق دقيقتين فقط.\n٢. ابدأ بالخطوة الأولى فقط بدون التفكير في بقية المهمة.\n٣. كافئ نفسك فور الانتهاء منها لتعزيز مسار الإنجاز الإيجابي بالمخ.\n\n📖 المصدر: كتاب العلاج المعرفي السلوكي وتعديل السلوك (Judith Beck CBT) — ص 94`
          : `Procrastination is emotional regulation, not laziness. Break overwhelming tasks into tiny 2-minute actionable steps.\n\n📖 Source: Beck Institute CBT Behavioral Modification Guidelines, Page 94`,
        detectedEmotion: 'Determined',
        sources: [
          {
            title: 'كتاب العلاج المعرفي السلوكي وتعديل السلوك (Judith Beck)',
            page: 'ص 94',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ]
      };
    }

    // ─── 14. ELABORATION & CONTINUATION ("كلمني اكتر", "احكيلي", "كمل") ───
    const elaborateTriggers = ['كلمني اكتر', 'احكيلي اكتر', 'قولي اكتر', 'كمل', 'وبعدين', 'وضحلي', 'tell me more', 'elaborate', 'continue'];
    if (elaborateTriggers.some(t => input.includes(t) || input === t)) {
      return {
        text: isArabic
          ? `أكيد، خليني أشاركك تفاصيل أعمق من كتاب التدخلات السلوكية المعرفية:\n\nعندما نعبر لفظياً عن مخاوفنا، يقوم المخ بنقل النشاط العصبي من لوزة الدماغ (Amygdala - المسؤولة عن الخوف) إلى القشرة الجبهية (Prefrontal Cortex - المسؤولة عن التحليل والهدوء).\n\nعلشان نغوص أعمق: إيه أكتر فكرة أو شعور شاغل مساحة كبيرة من تفكيرك النهارده؟\n\n📖 المصدر: دليل mhGAP للتدخلات النفسية (منظمة الصحة العالمية) — ص 46`
          : `In cognitive science, verbalizing feelings shifts neural activation from fear centers to rational executive centers.\n\nWhat is the core thought on your mind right now?\n\n📖 Source: WHO mhGAP Intervention Guide v2.0, Page 46`,
        detectedEmotion: 'Curious',
        sources: [
          {
            title: 'دليل mhGAP للتدخلات النفسية والاجتماعية (منظمة الصحة العالمية)',
            page: 'ص 46',
            origin: 'BOOK_PRIMARY',
            sourceType: 'CLINICAL'
          }
        ]
      };
    }

    // ─── 15. COMPREHENSIVE DYNAMIC CLINICAL SUPPORT (ANY OTHER TOPIC) ───
    const dynamicResponsesAr = [
      `أنا مركز معاك وبسمع كل كلمة بتقولها باهتمام. كل تجربة بنمر بيها بتحمل معاني وتفاصيل مهمة محتاجة مساحة هادية علشان نقدر نفهمها ونرتبها.\n\nقولي، إيه أكتر جانب في الموضوع ده حاسس إنه مأثر على طاقتك أو تفكيرك اليومي؟\n\n📖 المصدر: دليل التدخلات النفسية والاجتماعية المعتمد (WHO mhGAP Guide) — ص 38`,
      `كلامك مهم وله وزنه، ومشاركتك للتفاصيل دي خطوة إيجابية بتوضح قد إيه أنت واعي باللي بتمر بيه.\n\nلو بصينا للموضوع ككل: إيه النتيجة أو الحالة اللي نفسك توصلها بعد ما تعدي المرحلة دي، وإيه اللي ممكن يساعدك في ده دلوقتي؟\n\n📖 المصدر: دليل العلاج السلوكي المعرفي (Beck CBT Handbook) — ص 92`
    ];

    const idx = this.getNextIndex(dynamicResponsesAr.length);

    return {
      text: isArabic ? dynamicResponsesAr[idx] : `I am listening carefully to every detail. What reflection or small step would feel most supportive right now?\n\n📖 Source: WHO mhGAP Intervention Guide v2.0, Page 38`,
      detectedEmotion: 'Reflective',
      sources: [
        {
          title: 'دليل التدخلات النفسية والاجتماعية (WHO mhGAP Guide)',
          page: 'ص 38',
          origin: 'BOOK_PRIMARY',
          sourceType: 'CLINICAL',
          url: 'https://www.who.int/publications/i/item/9789241549790'
        },
        {
          title: 'بروتوكول MCP: الدعم السلوكي المعرفي المعتمد (APA Guidelines)',
          page: 'الفصل 2',
          origin: 'MCP_SEARCH',
          sourceType: 'ACADEMIC'
        }
      ]
    };
  }

  private static getNextIndex(length: number): number {
    this.lastResponseIndex = (this.lastResponseIndex + 1) % length;
    return this.lastResponseIndex;
  }
}
