import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, LockKey } from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConsentManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onConsentChange: (preferences: { dataCollection: boolean; clinicalAnalysis: boolean }) => void;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({ isVisible, onClose, onConsentChange }) => {
  const [dataCollection, setDataCollection] = useState(true);
  const [clinicalAnalysis, setClinicalAnalysis] = useState(true);
  const { isRTL } = useLanguage();

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

  const handleSave = () => {
    onConsentChange({ dataCollection, clinicalAnalysis });
    onClose();
  };

  return (
    <div className="mc-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mc-drawer-panel" role="dialog" aria-modal="true" aria-label={isRTL ? 'إدارة الموافقة والبيانات' : 'Data & Consent Preferences'}>
        <div className="mc-drawer-header">
          <div>
            <h2 className="mc-drawer-title">{isRTL ? 'الخصوصية والموافقة' : 'Data & Consent'}</h2>
            <p className="mc-drawer-subtitle">{isRTL ? 'تحكم كامل في كيفية معالجة بياناتك' : 'Full granular control over your clinical data'}</p>
          </div>
          <button className="mc-btn-icon" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>
            <X size={20} />
          </button>
        </div>

        <div className="mc-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
          <div className="mc-clinical-footnote">
            <LockKey size={20} weight="duotone" style={{ flexShrink: 0, marginTop: 2, color: 'var(--mc-safe)' }} />
            <p className="bidi-text">
              {isRTL
                ? 'بياناتك مشفرة ومحمية بتقنية أمان مستوى الصفوف (Row-Level Security). لا يتم بيع بياناتك أو مشاركتها مع أي جهات خارجية.'
                : 'Your data is encrypted end-to-end and protected by Row-Level Security. We never sell or share your clinical interactions with third parties.'
              }
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)', cursor: 'pointer', gap: 'var(--s-3)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
                  {isRTL ? 'تسجيل استمرارية الجلسات' : 'Session Continuity Memory'}
                </strong>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)' }}>
                  {isRTL ? 'السماح للرفيق بتذكر الموضوعات السابقة لتقديم سياق متصل.' : 'Allows MindCare to remember themes and insights across your visits.'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={dataCollection}
                onChange={(e) => setDataCollection(e.target.checked)}
                style={{ accentColor: 'var(--mc-accent)', width: 18, height: 18, marginTop: 2 }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)', cursor: 'pointer', gap: 'var(--s-3)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
                  {isRTL ? 'تحليل الأنماط المعرفية' : 'Cognitive Pattern Insights'}
                </strong>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)' }}>
                  {isRTL ? 'استخراج اتجاهات التوتر والمحفزات السلوكية لمساعدتك في فهم نفسك.' : 'Extracts anxiety trends and behavioral triggers to assist your self-reflection.'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={clinicalAnalysis}
                onChange={(e) => setClinicalAnalysis(e.target.checked)}
                style={{ accentColor: 'var(--mc-accent)', width: 18, height: 18, marginTop: 2 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s-3)', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 'var(--s-6)' }}>
            <button className="mc-btn-voice-pill" onClick={onClose}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              className="mc-btn-presence-toggle" 
              style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}
              onClick={handleSave}
            >
              {isRTL ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
