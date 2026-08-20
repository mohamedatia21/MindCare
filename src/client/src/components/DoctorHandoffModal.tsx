import React, { useState, useEffect } from 'react';
import { 
  HandHeart, 
  X, 
  ShieldCheck, 
  CheckCircle, 
  UserCheck, 
  LockKey,
  Info
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface DoctorHandoffModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmHandoff: (payload: { shareSummary: boolean; shareMoodTrend: boolean; providerId: string }) => void;
  suggestedProvider?: string;
  minimizedSummary?: string;
}

export const DoctorHandoffModal: React.FC<DoctorHandoffModalProps> = ({
  isVisible,
  onClose,
  onConfirmHandoff,
  suggestedProvider = 'الأمانة العامة للصحة النفسية (الاستشارات المتخصصة)',
  minimizedSummary = 'ملخص الأعراض الرئيسية (موجة توتر وقلق مسائي، تفكير متكرر) دون تفاصيل المحادثات الكاملة.'
}) => {
  const { isRTL } = useLanguage();
  const [shareSummary, setShareSummary] = useState(true);
  const [shareMoodTrend, setShareMoodTrend] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const handleApprove = () => {
    onConfirmHandoff({ shareSummary, shareMoodTrend, providerId: suggestedProvider });
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="mc-drawer-overlay" style={{ justifyContent: 'center', alignItems: 'center', padding: 'var(--s-3)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        className="mc-login-card" 
        style={{ width: '100%', maxWidth: 540, textAlign: 'start', padding: 'clamp(16px, 4vw, 32px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
      >
        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: 'var(--s-8) var(--s-4)' }}>
            <CheckCircle size={48} weight="fill" style={{ color: 'var(--mc-safe)', margin: '0 auto var(--s-4)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--s-2)' }}>
              {isRTL ? 'تم تأكيد التوجيه ومشاركة البيانات المصرح بها فقط' : 'Handoff Confirmed with Minimal Consented Data'}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)' }}>
              {isRTL ? 'سيتم التواصل معك عبر القناة المعتمدة لتقديم الرعاية المتخصصة.' : 'You will be connected through verified clinical channels.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--r-full)', backgroundColor: 'var(--mc-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mc-accent)' }}>
                  <HandHeart size={22} weight="duotone" />
                </div>
                <div>
                  <span className="mc-sidebar-subtitle" style={{ color: 'var(--mc-accent)' }}>
                    {isRTL ? 'توجيه إكلينيكي اختياري بموافقتك' : 'Consent-Based Professional Handoff'}
                  </span>
                  <h2 id="handoff-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                    {isRTL ? 'مشاركة المعلومات مع الأخصائي' : 'Share Information with Specialist'}
                  </h2>
                </div>
              </div>
              <button className="mc-btn-icon" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>
                <X size={20} />
              </button>
            </div>

            {/* Prompt Statement */}
            <div className="mc-clinical-footnote" style={{ backgroundColor: 'var(--mc-accent-light)', borderInlineStartColor: 'var(--mc-accent)', marginBottom: 'var(--s-5)' }}>
              <p className="bidi-text" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--mc-text)' }}>
                {isRTL 
                  ? '«في رأيي إن وجود متخصص يساعدك بشكل أعمق هيكون خطوة مفيدة. تحب نوصلك بأخصائي؟»'
                  : '“I believe having a human specialist support you on a deeper level would be beneficial. Would you like us to connect you?”'
                }
              </p>
            </div>

            {/* Explicit Contract Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
              {/* What will be shared */}
              <div style={{ padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)' }}>
                <strong style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', marginBottom: 'var(--s-2)' }}>
                  {isRTL ? 'سيتم مشاركة (الحد الأدنى الضروري فقط):' : 'Information to be shared (Strict Minimum):'}
                </strong>
                
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-2)', cursor: 'pointer', marginBottom: 'var(--s-2)' }}>
                  <input
                    type="checkbox"
                    checked={shareSummary}
                    onChange={(e) => setShareSummary(e.target.checked)}
                    style={{ accentColor: 'var(--mc-accent)', marginTop: 3 }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
                    • {minimizedSummary}
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shareMoodTrend}
                    onChange={(e) => setShareMoodTrend(e.target.checked)}
                    style={{ accentColor: 'var(--mc-accent)', marginTop: 3 }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
                    • {isRTL ? 'متوسط مؤشر التوتر خلال الأسبوع الأخير (بدون المذكرات الخاصة).' : 'Average anxiety trend over past week (excluding private journals).'}
                  </span>
                </label>
              </div>

              {/* Why & With Whom */}
              <div style={{ padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)' }}>
                <div style={{ marginBottom: 'var(--s-3)' }}>
                  <strong style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                    {isRTL ? 'السبب:' : 'Purpose:'}
                  </strong>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)' }}>
                    • {isRTL ? 'تزويد الأخصائي بالسياق الأولي لمساعدتك دون الحاجة لتكرار شرح المشكلة من البداية.' : 'Provide clinical continuity so you do not have to repeat your initial story from scratch.'}
                  </span>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                    {isRTL ? 'مع من:' : 'Shared with:'}
                  </strong>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', fontWeight: 600 }}>
                    • {suggestedProvider}
                  </span>
                </div>
              </div>

              {/* Strict Non-Sharing Guarantee */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-safe)', fontSize: 'var(--text-xs)' }}>
                <LockKey size={16} weight="fill" />
                <span>{isRTL ? 'لا يتم إرسال المحادثات الكاملة أو المذكرات الشخصية نهائياً.' : 'Full dialogue transcripts and personal journals are NEVER shared.'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-3)' }}>
              <button 
                type="button" 
                className="mc-btn-voice-pill" 
                onClick={onClose}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="mc-btn-presence-toggle"
                style={{ padding: '10px 24px', fontSize: 'var(--text-sm)', backgroundColor: 'var(--mc-accent)' }}
                onClick={handleApprove}
                disabled={!shareSummary && !shareMoodTrend}
              >
                {isRTL ? 'موافقة ومشاركة' : 'Approve & Share'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
