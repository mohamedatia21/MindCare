import { useState, useEffect } from 'react';
import { 
  Wind, 
  Heartbeat, 
  MoonStars, 
  Compass, 
  Lightbulb, 
  Play, 
  Pause, 
  ArrowRight, 
  CheckCircle, 
  HandHeart 
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

type WellnessSpace = 'calm' | 'ground' | 'focus' | 'sleep' | 'reflect';

interface WellnessViewProps {
  initialSpace?: WellnessSpace;
  onStartChatWithContext?: (context: string) => void;
}

export function WellnessView({ initialSpace = 'calm', onStartChatWithContext }: WellnessViewProps) {
  const { isRTL } = useLanguage();
  const [activeSpace, setActiveSpace] = useState<WellnessSpace>(initialSpace);

  // ─── 4-7-8 Breath Pacer State ───
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [phaseSeconds, setPhaseSeconds] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  // ─── 5-4-3-2-1 Grounding State ───
  const [groundStep, setGroundStep] = useState(0);

  // Breath pacing timer
  useEffect(() => {
    if (!isBreathing) return;

    const interval = setInterval(() => {
      setPhaseSeconds((prev) => {
        if (prev > 1) return prev - 1;

        // Transition between phases
        if (breathPhase === 'Inhale') {
          setBreathPhase('Hold');
          return 7;
        } else if (breathPhase === 'Hold') {
          setBreathPhase('Exhale');
          return 8;
        } else {
          setBreathPhase('Inhale');
          setCyclesCompleted((c) => c + 1);
          return 4;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isBreathing, breathPhase]);

  const groundingSteps = isRTL ? [
    { count: 5, label: 'أشياء تراها حولك الآن', desc: 'انظر حول الغرفة ولاحظ ٥ أشياء: شكل إضاءة، لون جدار، نمط نسيج، زاوية طاولة...' },
    { count: 4, label: 'أشياء يمكنك لمسها والإحساس بها', desc: 'المس ملابسك، ملمس كرسيك، برودة سطح المكتب، ملمس قدميك على الأرض...' },
    { count: 3, label: 'أصوات تسمعها في البيئة المحيطة', desc: 'استمع بدقة: صوت هواء، صوت ساعة، صوت حركة خافتة في الخارج...' },
    { count: 2, label: 'روائح يمكنك تمييزها', desc: 'تنفس بعمق ولاحظ: رائحة قهوة، رائحة الورق، أو هواء الغرفة المنعش...' },
    { count: 1, label: 'مذاق أو إحساس فموي', desc: 'لاحظ طعم فمك الحالي، أو تناول رشفة ماء بوعي كامل...' },
  ] : [
    { count: 5, label: 'Things you can SEE', desc: 'Look around your room: notice a light reflection, a texture on the wall, a plant leaf...' },
    { count: 4, label: 'Things you can TOUCH', desc: 'Feel the fabric of your shirt, the cool table surface, your feet grounded on the floor...' },
    { count: 3, label: 'Things you can HEAR', desc: 'Listen attentively: a distant car, the hum of air conditioning, your own breath...' },
    { count: 2, label: 'Things you can SMELL', desc: 'Breathe gently: the scent of coffee, room air, or essential oils around you...' },
    { count: 1, label: 'Thing you can TASTE', desc: 'Notice the sensation in your mouth, or take a mindful sip of fresh water...' },
  ];

  return (
    <div className="mc-home-container">
      {/* ─── Header ─── */}
      <section className="mc-home-hero" style={{ textAlign: 'start', alignItems: 'flex-start' }}>
        <div className="mc-home-greeting-label">
          <span>{isRTL ? 'مساحة العافية' : 'Wellness & Somatic Care'}</span>
          <span>•</span>
          <span>{isRTL ? 'تنظيم فوري للجهاز العصبي' : 'Nervous System Stabilization'}</span>
        </div>
        <h1 className="mc-home-greeting">
          {isRTL ? 'تمارين التهدئة والتثبيت' : 'Somatic Grounding & Regulation'}
        </h1>
        <p className="mc-home-quote" style={{ marginInline: '0', maxWidth: '640px' }}>
          {isRTL 
            ? 'أدوات مثبتة إكلينيكياً لخفض استثارة الجهاز العصبي الودي واستعادة التوازن الفسيولوجي.'
            : 'Clinically grounded somatic protocols to down-regulate sympathetic arousal and restore physiological equilibrium.'
          }
        </p>
      </section>

      {/* ─── Space Switcher Tabs ─── */}
      <div className="mc-spectrum-chips" style={{ justifyContent: 'flex-start' }}>
        <button
          className={`mc-spectrum-chip ${activeSpace === 'calm' ? 'active' : ''}`}
          onClick={() => { setActiveSpace('calm'); setIsBreathing(false); }}
        >
          <Heartbeat size={16} />
          <span>{isRTL ? 'تنفس ٤-٧-٨' : '4-7-8 Breathing'}</span>
        </button>

        <button
          className={`mc-spectrum-chip ${activeSpace === 'ground' ? 'active' : ''}`}
          onClick={() => { setActiveSpace('ground'); setGroundStep(0); }}
        >
          <Wind size={16} />
          <span>{isRTL ? 'تثبيت ٥-٤-٣-٢-١' : '5-4-3-2-1 Sensory'}</span>
        </button>

        <button
          className={`mc-spectrum-chip ${activeSpace === 'focus' ? 'active' : ''}`}
          onClick={() => setActiveSpace('focus')}
        >
          <Compass size={16} />
          <span>{isRTL ? 'تركيز المربع' : 'Box Breathing'}</span>
        </button>

        <button
          className={`mc-spectrum-chip ${activeSpace === 'sleep' ? 'active' : ''}`}
          onClick={() => setActiveSpace('sleep')}
        >
          <MoonStars size={16} />
          <span>{isRTL ? 'استرخاء النوم' : 'NSDR Wind-Down'}</span>
        </button>
      </div>

      {/* ─── Space 1: 4-7-8 Breathing Pacer ─── */}
      {activeSpace === 'calm' && (
        <div className="mc-pathway-item" style={{ alignItems: 'center', textAlign: 'center', padding: 'clamp(24px, 5vw, 48px) var(--s-4)', cursor: 'default' }}>
          <div 
            style={{
              width: isBreathing ? (breathPhase === 'Hold' ? '190px' : breathPhase === 'Inhale' ? '220px' : '130px') : '160px',
              height: isBreathing ? (breathPhase === 'Hold' ? '190px' : breathPhase === 'Inhale' ? '220px' : '130px') : '160px',
              borderRadius: 'var(--r-full)',
              background: 'radial-gradient(circle, var(--mc-accent-light) 0%, rgba(18, 100, 163, 0.04) 100%)',
              border: '2px solid var(--mc-accent)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 3.8s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: 'var(--s-6)'
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--mc-accent)', fontWeight: 700 }}>
              {isBreathing ? (
                isRTL ? (breathPhase === 'Inhale' ? 'شهيق' : breathPhase === 'Hold' ? 'حبس' : 'زفير') : breathPhase
              ) : (
                isRTL ? 'جاهز' : 'Ready'
              )}
            </span>
            <span style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, color: 'var(--mc-text)', marginTop: 4 }}>
              {isBreathing ? phaseSeconds : '4-7-8'}
            </span>
          </div>

          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--s-2)' }}>
            {isRTL ? 'بروتوكول التنفس ٤-٧-٨' : '4-7-8 Parasympathetic Reset'}
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', maxWidth: '440px', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--s-6)' }}>
            {isRTL 
              ? 'شهيق عبر الأنف ٤ ثوانٍ، حبس النفس ٧ ثوانٍ، زفير بطيء ومريح عبر الفم ٨ ثوانٍ.'
              : 'Inhale through nose for 4s, hold gently for 7s, exhale smoothly through mouth for 8s.'
            }
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <button
              className="mc-btn-presence-toggle"
              onClick={() => setIsBreathing(!isBreathing)}
            >
              {isBreathing ? (
                <>
                  <Pause size={18} weight="fill" />
                  <span>{isRTL ? 'إيقاف مؤقت' : 'Pause Pacer'}</span>
                </>
              ) : (
                <>
                  <Play size={18} weight="fill" />
                  <span>{isRTL ? 'بدء التمرين' : 'Start Breathing'}</span>
                </>
              )}
            </button>
            {cyclesCompleted > 0 && (
              <span className="mc-session-tag">
                <span>{cyclesCompleted} {isRTL ? 'دورات مكتملة' : 'cycles completed'}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Space 2: 5-4-3-2-1 Sensory Grounding ─── */}
      {activeSpace === 'ground' && (
        <div className="mc-pathway-item" style={{ padding: 'var(--s-8) var(--s-6)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-full)', backgroundColor: 'var(--mc-safe-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mc-safe)', fontWeight: 800, fontSize: 'var(--text-xl)' }}>
              {groundingSteps[groundStep].count}
            </div>
            <div>
              <span className="mc-sidebar-subtitle" style={{ color: 'var(--mc-safe)' }}>
                {isRTL ? `الخطوة ${groundStep + 1} من ٥` : `Step ${groundStep + 1} of 5`}
              </span>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                {groundingSteps[groundStep].label}
              </h3>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-base)', color: 'var(--mc-text)', lineHeight: 'var(--leading-loose)', marginBottom: 'var(--s-8)', padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)' }}>
            {groundingSteps[groundStep].desc}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="mc-btn-voice-pill"
              disabled={groundStep === 0}
              onClick={() => setGroundStep(prev => Math.max(0, prev - 1))}
            >
              {isRTL ? 'السابق' : 'Previous'}
            </button>

            {groundStep < groundingSteps.length - 1 ? (
              <button
                className="mc-btn-presence-toggle"
                style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}
                onClick={() => setGroundStep(prev => prev + 1)}
              >
                <span>{isRTL ? 'التالي' : 'Next Step'}</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="mc-btn-presence-toggle"
                style={{ padding: '10px 24px', fontSize: 'var(--text-sm)', backgroundColor: 'var(--mc-safe)' }}
                onClick={() => {
                  setGroundStep(0);
                  if (onStartChatWithContext) {
                    onStartChatWithContext(isRTL ? 'أتممت تمرين التثبيت الحسي 5-4-3-2-1 وأشعر بهدوء أكبر.' : 'I completed the 5-4-3-2-1 sensory grounding exercise and feel more settled.');
                  }
                }}
              >
                <CheckCircle size={18} weight="fill" />
                <span>{isRTL ? 'إتمام ومشاركة الشعور' : 'Complete & Reflect'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Space 3: Box Breathing ─── */}
      {activeSpace === 'focus' && (
        <div className="mc-pathway-item" style={{ padding: 'var(--s-8) var(--s-6)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-accent)', marginBottom: 'var(--s-3)' }}>
            <Compass size={24} weight="duotone" />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {isRTL ? 'تنفس المربع لتعزيز التركيز (Box Breathing)' : 'Box Breathing for Mental Clarity'}
            </h3>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--s-6)' }}>
            {isRTL 
              ? 'تقنية معتمدة عالمياً لإعادة شحذ الانتباه والتخلص من التشتت والارتباك.'
              : 'A structured 4-4-4-4 rhythm to sharpen executive attention and eliminate mental clutter.'
            }
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-6)' }}>
            <div className="mc-session-entry" style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
              <strong>٤ ثوانٍ</strong>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>{isRTL ? 'شهيق بطيء' : 'Slow Inhale'}</span>
            </div>
            <div className="mc-session-entry" style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
              <strong>٤ ثوانٍ</strong>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>{isRTL ? 'حبس هادئ' : 'Calm Hold'}</span>
            </div>
            <div className="mc-session-entry" style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
              <strong>٤ ثوانٍ</strong>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>{isRTL ? 'زفير مريح' : 'Smooth Exhale'}</span>
            </div>
            <div className="mc-session-entry" style={{ textAlign: 'center', padding: 'var(--s-4)' }}>
              <strong>٤ ثوانٍ</strong>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>{isRTL ? 'حبس فارغ' : 'Empty Pause'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Space 4: NSDR Wind-Down ─── */}
      {activeSpace === 'sleep' && (
        <div className="mc-pathway-item" style={{ padding: 'var(--s-8) var(--s-6)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-warm)', marginBottom: 'var(--s-3)' }}>
            <MoonStars size={24} weight="duotone" />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {isRTL ? 'استرخاء النوم العميق (NSDR Protocol)' : 'Non-Sleep Deep Rest (NSDR) Wind-Down'}
            </h3>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', lineHeight: 'var(--leading-loose)', marginBottom: 'var(--s-6)' }}>
            {isRTL 
              ? 'بروتوكول تفريغ الشحنات العصبية والمسح الجسدي التدريجي لتهيئة الدماغ لموجات دلتا والنوم العميق.'
              : 'Progressive somatic scan and cognitive offloading to transition brainwave states toward restorative deep sleep.'
            }
          </p>
          {onStartChatWithContext && (
            <button
              className="mc-btn-presence-toggle"
              onClick={() => onStartChatWithContext(isRTL ? 'أريد جلسة صوتية موجهة للاسترخاء والتحضير للنوم العميق.' : 'Guide me through a calming somatic body scan to prepare for deep restful sleep.')}
            >
              <HandHeart size={18} weight="fill" />
              <span>{isRTL ? 'بدء جلسة نوم موجهة صوتياً' : 'Begin Guided Sleep Dialogue'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
