import { useState } from 'react';
import { 
  ChatCircleText, 
  Heartbeat, 
  ArrowRight,
  Microphone,
  PaperPlaneTilt,
  Wind,
  MoonStars,
  Compass,
  Lightbulb
} from '@phosphor-icons/react';
import { AIEntity } from './AIEntity';
import { useLanguage } from '../contexts/LanguageContext';
import type { NavItem } from './Sidebar';

interface HomeViewProps {
  onNavigate: (nav: NavItem) => void;
  onStartChat: (initialPrompt?: string) => void;
  onStartVoice?: () => void;
  userName?: string;
  backendState?: string;
}

export function HomeView({ 
  onNavigate, 
  onStartChat, 
  onStartVoice,
  userName = 'Friend',
  backendState = 'IDLE'
}: HomeViewProps) {
  const [inputText, setInputText] = useState('');
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const { isRTL } = useLanguage();

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const finalPrompt = selectedFocus 
      ? `[${selectedFocus}] ${inputText.trim()}`
      : inputText.trim();
    onStartChat(finalPrompt);
  };

  const handleSpectrumClick = (mood: string) => {
    const focusPrefix = selectedFocus ? ` (${selectedFocus})` : '';
    const prompt = isRTL 
      ? `أشعر بأنني ${mood} اليوم${focusPrefix}. أريد التحدث حول هذا الأمر.`
      : `I am feeling ${mood.toLowerCase()} right now${focusPrefix}. I'd like to explore this with you.`;
    onStartChat(prompt);
  };

  const handlePathwayClick = (pathwayName: string, defaultPrompt: string) => {
    onStartChat(defaultPrompt);
  };

  const spectrumOptions = isRTL ? [
    { label: 'هادئ ومستقر', class: 'calm' },
    { label: 'أفكار متزاحمة', class: 'reflective' },
    { label: 'متوتر ومشتت', class: 'overwhelmed' },
    { label: 'مجهد ذهنياً', class: 'tired' },
    { label: 'صافي الذهن', class: 'clear' },
  ] : [
    { label: 'Grounded', class: 'calm' },
    { label: 'Reflective', class: 'reflective' },
    { label: 'Overwhelmed', class: 'overwhelmed' },
    { label: 'Tired', class: 'tired' },
    { label: 'Clear', class: 'clear' },
  ];

  const focusTags = isRTL ? [
    'القلق والتوتر',
    'النوم والراحة',
    'التركيز والعمل',
    'العلاقات والتواصل',
    'إرهاق المشاعر'
  ] : [
    'Anxiety',
    'Sleep & Rest',
    'Focus & Work',
    'Relationships',
    'Emotional Drain'
  ];

  return (
    <div className="mc-home-container">
      {/* ─── Editorial Hero & Living 3D Volumetric Presence ─── */}
      <section className="mc-home-hero">
        <div 
          className="mc-home-entity-focal"
          onClick={() => onNavigate('chat')}
          title={isRTL ? 'بدء محادثة علاجية' : 'Start Therapeutic Dialogue'}
        >
          <AIEntity state={backendState} audioActive={false} />
        </div>

        <div className="mc-home-greeting-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)', padding: '6px 14px', borderRadius: 'var(--r-full)', background: 'rgba(18, 100, 163, 0.08)', border: '1px solid rgba(18, 100, 163, 0.16)' }}>
          <img src="/logo.jpg" alt="MindCare" style={{ width: 20, height: 20, borderRadius: 5, objectFit: 'cover' }} />
          <span style={{ fontWeight: 700, color: 'var(--mc-text)' }}>MindCare</span>
          <span>•</span>
          <span>{isRTL ? 'الرفيق الإكلينيكي الهادئ' : 'Calm Intelligence'}</span>
        </div>

        <h1 className="mc-home-greeting bidi-text">
          {isRTL ? (
            <>أهلاً بك، <span dir="auto">{userName}</span></>
          ) : (
            <>Good day, <span dir="auto">{userName}</span></>
          )}
        </h1>

        <p className="mc-home-quote">
          {isRTL 
            ? '«ما هو الشعور الأكثر حضوراً في داخلك اليوم؟»'
            : '“What feels most present for you today?”'
          }
        </p>

        {/* Conversational Starter Bar */}
        <form className="mc-home-prompt-bar" onSubmit={handlePromptSubmit}>
          <input
            type="text"
            className="mc-home-prompt-input bidi-text"
            placeholder={isRTL ? 'اكتب ما يدور في بالك، أو ابدأ بالتحدث...' : 'Express what is on your mind, or start speaking...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="mc-home-prompt-actions">
            {onStartVoice && (
              <button 
                type="button" 
                className="mc-btn-voice-pill"
                onClick={onStartVoice}
                title={isRTL ? 'بدء محادثة صوتية فورية' : 'Start Instant Voice'}
              >
                <Microphone size={16} weight="fill" />
                <span>{isRTL ? 'صوت' : 'Voice'}</span>
              </button>
            )}
            <button 
              type="submit" 
              className="mc-btn-primary-circle"
              disabled={!inputText.trim()}
              title={isRTL ? 'إرسال' : 'Send'}
            >
              <PaperPlaneTilt size={18} weight="fill" />
            </button>
          </div>
        </form>
      </section>

      {/* ─── Emotion & Context Tagging ─── */}
      <section className="mc-spectrum-section">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-2)' }}>
          <span className="mc-spectrum-label">
            {isRTL ? 'فحص عاطفي سريع' : 'Gentle check-in'}
          </span>
          <div className="mc-spectrum-chips">
            {spectrumOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="mc-spectrum-chip"
                onClick={() => handleSpectrumClick(opt.label)}
              >
                <span className={`mc-spectrum-dot ${opt.class}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional Focus Context Area */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', marginTop: 'var(--s-2)' }}>
          {focusTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`mc-session-tag ${selectedFocus === tag ? 'topic' : ''}`}
              style={{ cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)' }}
              onClick={() => setSelectedFocus(prev => prev === tag ? null : tag)}
            >
              <span>{tag}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── 5 Intentional Therapeutic Spaces ─── */}
      <section className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            {isRTL ? 'المساحات العلاجية الموجهة' : 'Intentional Therapeutic Spaces'}
          </span>
        </div>

        <div className="mc-pathways-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {/* Pathway 1: Calm */}
          <div 
            className="mc-pathway-item" 
            onClick={() => handlePathwayClick('Calm', isRTL ? 'أريد جلسة تهدئة موجهة لخفض التوتر.' : 'Guide me through an anxiety de-escalation exercise.')}
          >
            <div>
              <div className="mc-pathway-icon-row">
                <Heartbeat size={22} weight="duotone" />
                <ArrowRight size={16} />
              </div>
              <h4>{isRTL ? 'تهدئة (Calm)' : 'Calm'}</h4>
              <p>
                {isRTL 
                  ? 'خفض استثارة الجهاز العصبي وتفكيك نوبات القلق الحادة.'
                  : 'Nervous system de-escalation and anxiety grounding.'
                }
              </p>
            </div>
          </div>

          {/* Pathway 2: Ground */}
          <div 
            className="mc-pathway-item" 
            onClick={() => handlePathwayClick('Ground', isRTL ? 'دعنا نقوم بتمرين تثبيت حسي 5-4-3-2-1.' : 'Let us do a 5-4-3-2-1 somatic grounding exercise.')}
          >
            <div>
              <div className="mc-pathway-icon-row">
                <Wind size={22} weight="duotone" />
                <ArrowRight size={16} />
              </div>
              <h4>{isRTL ? 'تثبيت حسي (Ground)' : 'Ground'}</h4>
              <p>
                {isRTL 
                  ? 'بروتوكول 5-4-3-2-1 الحسي لإعادة الاتصال باللحظة الراهنة.'
                  : 'Somatosensory grounding to reconnect with the physical present.'
                }
              </p>
            </div>
          </div>

          {/* Pathway 3: Reflect */}
          <div 
            className="mc-pathway-item" 
            onClick={() => handlePathwayClick('Reflect', isRTL ? 'ساعدني في تفكيك فكرة سلبية متكررة وإعادة صياغتها.' : 'Help me deconstruct and cognitively reframe a persistent negative thought.')}
          >
            <div>
              <div className="mc-pathway-icon-row">
                <Lightbulb size={22} weight="duotone" />
                <ArrowRight size={16} />
              </div>
              <h4>{isRTL ? 'تأمل وإعادة صياغة (Reflect)' : 'Reflect'}</h4>
              <p>
                {isRTL 
                  ? 'تفكيك التشوهات المعرفية وإعادة هيكلة أنماط التفكير.'
                  : 'Cognitive reframing and structured thought deconstruction.'
                }
              </p>
            </div>
          </div>

          {/* Pathway 4: Focus */}
          <div 
            className="mc-pathway-item" 
            onClick={() => handlePathwayClick('Focus', isRTL ? 'أشعر بالتشتت، ساعدني في ترتيب مهامي واستعادة تركيزي.' : 'I feel scattered. Help me prioritize my next steps and restore focus.')}
          >
            <div>
              <div className="mc-pathway-icon-row">
                <Compass size={22} weight="duotone" />
                <ArrowRight size={16} />
              </div>
              <h4>{isRTL ? 'تركيز ووضوح (Focus)' : 'Focus'}</h4>
              <p>
                {isRTL 
                  ? 'تنظيم الأولويات واستعادة الوضوح الذهني التنفيذي.'
                  : 'Restoring executive clarity and manageable task pacing.'
                }
              </p>
            </div>
          </div>

          {/* Pathway 5: Sleep */}
          <div 
            className="mc-pathway-item" 
            onClick={() => handlePathwayClick('Sleep', isRTL ? 'أريد جلسة استرخاء مسائية واستعداد للنوم العميق.' : 'Guide me through a bedtime wind-down and relaxation routine.')}
          >
            <div>
              <div className="mc-pathway-icon-row">
                <MoonStars size={22} weight="duotone" />
                <ArrowRight size={16} />
              </div>
              <h4>{isRTL ? 'استرخاء ونوم (Sleep)' : 'Sleep'}</h4>
              <p>
                {isRTL 
                  ? 'تهدئة ما قبل النوم وتفريغ الشحنات الذهنية لراحة عميقة.'
                  : 'Bedtime cognitive offloading and deep restful relaxation.'
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Clinical Safeguard Footnote ─── */}
      <div className="mc-clinical-footnote">
        <Heartbeat size={18} weight="duotone" style={{ flexShrink: 0, marginTop: 2 }} />
        <p className="bidi-text">
          {isRTL
            ? 'مايندكير يقدم إسعافات نفسية أولية وتوجيهاً سلوكياً آمناً مدعوماً بالأدلة الإكلينيكية. هذه المساحة داعمة ومحمية وليست بديلاً عن الرعاية الطبية أو خدمات الطوارئ.'
            : 'MindCare provides evidence-based psychological first aid and emotional regulation. This space is private, supportive, and does not substitute psychiatric care or emergency medical services.'
          }
        </p>
      </div>
    </div>
  );
}
