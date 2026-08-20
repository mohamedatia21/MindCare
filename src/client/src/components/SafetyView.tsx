import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Phone, 
  UserCirclePlus, 
  Heartbeat, 
  LockKey, 
  WarningCircle,
  FloppyDisk
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface SafetyViewProps {
  onTriggerCrisisProtocol?: () => void;
}

export function SafetyView({ onTriggerCrisisProtocol }: SafetyViewProps) {
  const { isRTL } = useLanguage();
  const [trustedName, setTrustedName] = useState(() => localStorage.getItem('mc_trusted_name') || '');
  const [trustedPhone, setTrustedPhone] = useState(() => localStorage.getItem('mc_trusted_phone') || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveTrusted = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mc_trusted_name', trustedName);
    localStorage.setItem('mc_trusted_phone', trustedPhone);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="mc-home-container">
      {/* ─── Header ─── */}
      <section className="mc-home-hero" style={{ textAlign: 'start', alignItems: 'flex-start' }}>
        <div className="mc-home-greeting-label">
          <ShieldCheck size={16} weight="fill" style={{ color: 'var(--mc-crisis)' }} />
          <span>{isRTL ? 'مركز الأمان والسلامة' : 'Safety & Crisis Center'}</span>
          <span>•</span>
          <span>{isRTL ? 'دعم فوري وموارد موثوقة' : '24/7 Emergency Support'}</span>
        </div>
        <h1 className="mc-home-greeting">
          {isRTL ? 'مساحة الأمان والدعم الإكلينيكي' : 'Clinical Safety & Crisis Resources'}
        </h1>
        <p className="mc-home-quote" style={{ marginInline: '0', maxWidth: '640px' }}>
          {isRTL 
            ? 'سلامتك هي أولويتنا المطلقة. صُمم هذا المركز لتوفير وصول سريع لجهات الدعم البشري المتخصص.'
            : 'Your safety is our absolute priority. This center provides immediate access to verified clinical human support.'
          }
        </p>
      </section>

      {/* ─── Immediate Emergency Hotlines ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            {isRTL ? 'خطوط الدعم النفسي المجانية المعتمدة' : 'Verified 24/7 Crisis Helplines'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--s-3)' }}>
          <a href="tel:08008880700" className="mc-pathway-item" style={{ minHeight: 'auto', padding: 'var(--s-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-2)' }}>
              <span className="mc-session-tag topic">{isRTL ? 'مصر (مجاني)' : 'Egypt (Toll-Free)'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mc-safe)', fontWeight: 700 }}>
                <Phone size={16} weight="fill" />
                <span>08008880700</span>
              </div>
            </div>
            <h4>{isRTL ? 'الأمانة العامة للصحة النفسية' : 'General Secretariat of Mental Health'}</h4>
            <p>{isRTL ? 'خدمة استشارات ودعم طوارئ على مدار الساعة تحت إشراف وزارة الصحة.' : 'Official 24/7 crisis counseling supervised by Ministry of Health.'}</p>
          </a>

          <a href="tel:16328" className="mc-pathway-item" style={{ minHeight: 'auto', padding: 'var(--s-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-2)' }}>
              <span className="mc-session-tag topic">{isRTL ? 'مصر (طوارئ)' : 'Egypt (Helpline)'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mc-safe)', fontWeight: 700 }}>
                <Phone size={16} weight="fill" />
                <span>16328</span>
              </div>
            </div>
            <h4>{isRTL ? 'الخط الساخن للاستشارات النفسية' : 'National Psychological Helpline'}</h4>
            <p>{isRTL ? 'دعم فوري للحالات الحرجة والأزمات الانفعالية الحادة.' : 'Urgent immediate support for acute distress and crisis.'}</p>
          </a>

          <a href="tel:988" className="mc-pathway-item" style={{ minHeight: 'auto', padding: 'var(--s-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-2)' }}>
              <span className="mc-session-tag">{isRTL ? 'الولايات المتحدة' : 'United States'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mc-safe)', fontWeight: 700 }}>
                <Phone size={16} weight="fill" />
                <span>988</span>
              </div>
            </div>
            <h4>{isRTL ? 'شريان الحياة للأزمات 988' : '988 Suicide & Crisis Lifeline'}</h4>
            <p>{isRTL ? 'مكالمات ورسائل نصية مجانية وسرية على مدار 24/7.' : 'Free and confidential 24/7 support via call or text.'}</p>
          </a>
        </div>
      </div>

      {/* ─── Trusted Person Configuration ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            <UserCirclePlus size={16} style={{ display: 'inline', marginInlineEnd: 6 }} />
            {isRTL ? 'جهة اتصال موثوقة لحالات الطوارئ' : 'Designated Trusted Contact'}
          </span>
        </div>

        <form onSubmit={handleSaveTrusted} className="mc-pathway-item" style={{ backgroundColor: 'var(--mc-bg-elevated)', cursor: 'default' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', marginBottom: 'var(--s-4)', lineHeight: 'var(--leading-normal)' }}>
            {isRTL 
              ? 'يمكنك حفظ اسم ورقم شخص مقرب لتسهيل التواصل معه بضغطة واحدة في اللحظات الصعبة. يتم حفظ هذه البيانات محلياً على جهازك فقط.'
              : 'Save a close contact for rapid 1-tap connection during difficult moments. This information is stored locally on your device only.'
            }
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
            <input
              type="text"
              className="mc-chat-input-field bidi-text"
              style={{ backgroundColor: 'var(--mc-bg-surface)', padding: 'var(--s-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--mc-border)' }}
              placeholder={isRTL ? 'اسم الشخص الموثوق (مثلاً: سارة)...' : 'Trusted Contact Name (e.g. Sarah)...'}
              value={trustedName}
              onChange={(e) => setTrustedName(e.target.value)}
            />
            <input
              type="tel"
              className="mc-chat-input-field bidi-text"
              style={{ backgroundColor: 'var(--mc-bg-surface)', padding: 'var(--s-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--mc-border)' }}
              placeholder={isRTL ? 'رقم الهاتف...' : 'Phone Number...'}
              value={trustedPhone}
              onChange={(e) => setTrustedPhone(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {trustedPhone && (
              <a href={`tel:${trustedPhone}`} className="mc-btn-voice-pill" style={{ color: 'var(--mc-safe)', borderColor: 'var(--mc-safe)' }}>
                <Phone size={16} weight="fill" />
                <span>{isRTL ? `اتصال بـ ${trustedName || 'الشخص الموثوق'}` : `Call ${trustedName || 'Contact'}`}</span>
              </a>
            )}
            <button 
              type="submit" 
              className="mc-btn-presence-toggle"
              style={{ padding: '8px 20px', fontSize: 'var(--text-xs)', marginInlineStart: 'auto' }}
            >
              <FloppyDisk size={14} />
              <span>{isSaved ? (isRTL ? 'تم الحفظ بنجاح ✓' : 'Saved ✓') : (isRTL ? 'حفظ البيانات' : 'Save Contact')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ─── Clinical Safeguards Explanation ─── */}
      <div className="mc-clinical-footnote">
        <Heartbeat size={20} weight="duotone" style={{ flexShrink: 0, marginTop: 2, color: 'var(--mc-safe)' }} />
        <div className="bidi-text">
          <strong style={{ color: 'var(--mc-text)', display: 'block', marginBottom: 2 }}>
            {isRTL ? 'حدود المسؤولية الإكلينيكية' : 'Clinical Boundaries & Safeguard Guarantee'}
          </strong>
          <p>
            {isRTL
              ? 'مايندكير رفيق ذكاء اصطناعي داعم قائم على الأطر السلوكية المعرفية. لا يقوم النظام بتشخيص الاضطرابات أو وصف الأدوية أو الحلول محل الطبيب البشري.'
              : 'MindCare is an evidence-based supportive AI companion grounded in CBT/DBT frameworks. The system does not diagnose psychiatric conditions, prescribe medications, or replace human medical care.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
