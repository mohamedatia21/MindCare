import React from 'react';
import { AIEntity } from './AIEntity';
import { Microphone, WaveformSlash, SpeakerHigh } from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface PresenceViewProps {
  backendState: string;
  isVoiceActive: boolean;
  onToggleVoice: () => void;
  audioAmplitude?: number;
  liveSubtitle?: string;
  languagePref?: 'EGYPTIAN_ARABIC' | 'ENGLISH';
  onToggleLanguage?: () => void;
}

export function PresenceView({
  backendState,
  isVoiceActive,
  onToggleVoice,
  audioAmplitude = 0,
  liveSubtitle = '',
  languagePref = 'EGYPTIAN_ARABIC',
  onToggleLanguage
}: PresenceViewProps) {
  const isEnglish = languagePref === 'ENGLISH';

  const getLocalizedState = (state: string) => {
    if (isEnglish) {
      switch (state) {
        case 'LISTENING': return 'Listening... speak naturally in English';
        case 'THINKING': return 'Thinking and reflecting...';
        case 'SPEAKING': return 'MindCare is speaking...';
        case 'CRISIS_PROTOCOL': return 'Safety Protocol';
        case 'IDLE': return 'Ready for English voice dialogue';
        default: return state;
      }
    }
    switch (state) {
      case 'LISTENING': return 'جارٍ الاستماع إليك... تحدث بحرية';
      case 'THINKING': return 'معالجة وتفكير...';
      case 'SPEAKING': return 'مايندكير يتحدث الآن...';
      case 'CRISIS_PROTOCOL': return 'بروتوكول الأمان والسلامة';
      case 'IDLE': return 'جاهز للمحادثة الصوتية';
      default: return state;
    }
  };

  return (
    <div className="mc-presence-fullscreen">
      <div className="mc-presence-canvas-frame">
        <AIEntity 
          state={backendState} 
          audioActive={isVoiceActive || backendState === 'SPEAKING' || audioAmplitude > 0.05} 
          amplitude={audioAmplitude} 
        />
      </div>

      <div className="mc-presence-ambient-controls">
        {/* Live Subtitle Transcript Banner */}
        {liveSubtitle && (
          <div 
            style={{
              padding: '10px 20px',
              maxWidth: '85%',
              marginInline: 'auto',
              marginBottom: '12px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px',
              color: '#f8fafc',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {liveSubtitle}
          </div>
        )}

        {/* Live Audio Visualizer Bars */}
        {(isVoiceActive || backendState === 'SPEAKING') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '28px', marginBottom: '8px' }}>
            {[0.4, 0.8, 1.2, 0.9, 0.5, 1.1, 0.7].map((factor, idx) => {
              const height = Math.max(6, Math.min(26, (audioAmplitude * factor * 35) + 6));
              return (
                <div
                  key={idx}
                  style={{
                    width: '4px',
                    height: `${height}px`,
                    backgroundColor: backendState === 'SPEAKING' ? 'var(--mc-accent)' : 'var(--mc-emerald)',
                    borderRadius: '4px',
                    transition: 'height 0.08s ease'
                  }}
                />
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="mc-presence-state-pill">
            <span className={`mc-status-indicator ${isVoiceActive ? 'connecting' : backendState === 'SPEAKING' ? 'speaking' : ''}`} />
            {backendState === 'SPEAKING' ? <SpeakerHigh size={16} /> : null}
            <span>{getLocalizedState(backendState)}</span>
          </div>

          {onToggleLanguage && (
            <button
              onClick={onToggleLanguage}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease'
              }}
              title={isEnglish ? 'Switch to Egyptian Arabic' : 'التبديل إلى الإنجليزية'}
            >
              <span>{isEnglish ? '🇺🇸 English' : '🇪🇬 مصري'}</span>
            </button>
          )}
        </div>

        <button
          className={`mc-btn-presence-toggle ${isVoiceActive ? 'active' : ''}`}
          onClick={onToggleVoice}
        >
          {isVoiceActive ? (
            <>
              <WaveformSlash size={20} weight="fill" />
              <span>{isEnglish ? 'End Voice Session' : 'إيقاف الصوت'}</span>
            </>
          ) : (
            <>
              <Microphone size={20} weight="fill" />
              <span>{isEnglish ? 'Begin Voice Dialogue (English)' : 'بدء المحادثة الصوتية الحية'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}


