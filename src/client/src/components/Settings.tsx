import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, SpeakerHigh, Eye, Globe, SignOut, User } from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
  isVisible: boolean;
  onClose: () => void;
  onConsentManage: () => void;
  languagePref: 'ENGLISH' | 'EGYPTIAN_ARABIC';
  onLanguagePrefChange: (pref: 'ENGLISH' | 'EGYPTIAN_ARABIC') => void;
  onLogout?: () => void;
  userEmail?: string;
  userName?: string;
}

export const Settings: React.FC<SettingsProps> = ({ 
  isVisible, 
  onClose, 
  onConsentManage, 
  languagePref, 
  onLanguagePrefChange,
  onLogout,
  userEmail,
  userName
}) => {
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState('1.0');
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

  return (
    <div className="mc-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mc-drawer-panel" role="dialog" aria-modal="true" aria-label={isRTL ? 'الإعدادات' : 'Settings'}>
        <div className="mc-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
            <img 
              src="/logo.jpg" 
              alt="MindCare" 
              style={{ 
                width: 38, 
                height: 38, 
                borderRadius: 10, 
                objectFit: 'cover', 
                boxShadow: '0 4px 12px rgba(18, 100, 163, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
              }} 
            />
            <div>
              <h2 className="mc-drawer-title">{isRTL ? 'تفضيلات التطبيق' : 'Preferences & Care'}</h2>
              <p className="mc-drawer-subtitle">{isRTL ? 'إدارة اللغة، الصوت، والخصوصية' : 'Manage language, voice cadence, and privacy'}</p>
            </div>
          </div>
          <button className="mc-btn-icon" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>
            <X size={20} />
          </button>
        </div>

        <div className="mc-drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
          {/* ─── Language & Dialect ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
              <Globe size={18} weight="duotone" style={{ color: 'var(--mc-accent)' }} />
              <span className="mc-pathways-title">{isRTL ? 'لغة الرفيق الصوتي' : 'Language & Dialect'}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              <button
                type="button"
                className={`mc-chat-suggestion-pill ${languagePref === 'ENGLISH' ? 'active' : ''}`}
                style={{
                  backgroundColor: languagePref === 'ENGLISH' ? 'var(--mc-bg-elevated)' : 'var(--mc-bg-surface)',
                  borderColor: languagePref === 'ENGLISH' ? 'var(--mc-accent)' : 'var(--mc-border)',
                }}
                onClick={() => onLanguagePrefChange('ENGLISH')}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-sm)' }}>English (US)</strong>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>Empathetic clinical pacing</span>
                </div>
                {languagePref === 'ENGLISH' && <span className="mc-spectrum-dot calm" />}
              </button>

              <button
                type="button"
                className={`mc-chat-suggestion-pill ${languagePref === 'EGYPTIAN_ARABIC' ? 'active' : ''}`}
                style={{
                  backgroundColor: languagePref === 'EGYPTIAN_ARABIC' ? 'var(--mc-bg-elevated)' : 'var(--mc-bg-surface)',
                  borderColor: languagePref === 'EGYPTIAN_ARABIC' ? 'var(--mc-accent)' : 'var(--mc-border)',
                }}
                onClick={() => onLanguagePrefChange('EGYPTIAN_ARABIC')}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-sm)' }}>اللهجة المصرية (Egyptian Arabic)</strong>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)' }}>تفاعل حميمي وطبيعي</span>
                </div>
                {languagePref === 'EGYPTIAN_ARABIC' && <span className="mc-spectrum-dot calm" />}
              </button>
            </div>
          </div>

          {/* ─── Voice Cadence ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
              <SpeakerHigh size={18} weight="duotone" style={{ color: 'var(--mc-accent)' }} />
              <span className="mc-pathways-title">{isRTL ? 'سرعة الصوت والنبرة' : 'Voice Cadence'}</span>
            </div>

            <div style={{ padding: 'var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s-2)', fontSize: 'var(--text-xs)' }}>
                <span>{isRTL ? 'سرعة الإلقاء' : 'Speech Pace'}</span>
                <span style={{ fontWeight: 600, color: 'var(--mc-accent)' }}>{voiceSpeed}×</span>
              </div>
              <input
                type="range"
                min="0.7" max="1.3" step="0.1"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--mc-accent)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* ─── Accessibility ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
              <Eye size={18} weight="duotone" style={{ color: 'var(--mc-accent)' }} />
              <span className="mc-pathways-title">{isRTL ? 'إمكانية الوصول' : 'Accessibility & Motion'}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--s-3) var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>{isRTL ? 'تقليل الحركة والانتقالات' : 'Reduced Motion'}</span>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  style={{ accentColor: 'var(--mc-accent)', width: 16, height: 16 }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--s-3) var(--s-4)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--mc-border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>{isRTL ? 'تباين بصري عالٍ' : 'High Contrast Interface'}</span>
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  style={{ accentColor: 'var(--mc-accent)', width: 16, height: 16 }}
                />
              </label>
            </div>
          </div>

          {/* ─── Privacy & Consent ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
              <ShieldCheck size={18} weight="duotone" style={{ color: 'var(--mc-safe)' }} />
              <span className="mc-pathways-title">{isRTL ? 'الخصوصية والموافقة' : 'Privacy & Data Consent'}</span>
            </div>

            <button
              type="button"
              className="mc-btn-voice-pill"
              style={{ width: '100%', justifyContent: 'center', padding: 'var(--s-3)' }}
              onClick={onConsentManage}
            >
              {isRTL ? 'إدارة خيارات الخصوصية وتخزين البيانات' : 'Manage Data & Storage Preferences'}
            </button>
          </div>

          {/* ─── Account & Session Logout ─── */}
          {onLogout && (
            <div style={{ paddingTop: 'var(--s-2)', borderTop: '1px solid var(--mc-border)' }}>
              {userEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)', padding: 'var(--s-2) var(--s-3)', backgroundColor: 'var(--mc-bg-surface)', borderRadius: 'var(--r-md)' }}>
                  <User size={16} weight="duotone" style={{ color: 'var(--mc-text-tertiary)' }} />
                  <div style={{ overflow: 'hidden' }}>
                    {userName && <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--mc-text)' }}>{userName}</span>}
                    <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--mc-text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{userEmail}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="mc-btn-voice-pill"
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  padding: 'var(--s-3)', 
                  color: 'var(--mc-crisis)', 
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)'
                }}
                onClick={onLogout}
              >
                <SignOut size={16} weight="bold" />
                <span>{isRTL ? 'تسجيل الخروج من الحساب (Log Out)' : 'Log Out of Account'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
