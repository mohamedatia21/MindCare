import React, { useEffect } from 'react';
import { X, Clock, CalendarBlank, ChatCircleDots, Plus, Trash } from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';
import type { ChatMessage } from './ChatView';

export interface SessionRecord {
  id: string;
  date: string;
  summary: string;
  duration: string;
  topic?: string;
  messages?: ChatMessage[];
}

interface SessionHistoryProps {
  isVisible: boolean;
  onClose: () => void;
  sessions?: SessionRecord[];
  onSelectSession?: (session: SessionRecord) => void;
  onNewSession?: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ 
  isVisible, 
  onClose, 
  sessions = [],
  onSelectSession,
  onNewSession,
  onDeleteSession
}) => {
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
      <div className="mc-drawer-panel" role="dialog" aria-modal="true" aria-label={isRTL ? 'سجل الجلسات' : 'Session History'}>
        <div className="mc-drawer-header">
          <div>
            <h2 className="mc-drawer-title">
              {isRTL ? 'سجل الجلسات العلاجية' : 'Session Reflections'}
            </h2>
            <p className="mc-drawer-subtitle">
              {isRTL ? 'مراجعة الحوارات والتوجيهات السابقة' : 'Review past insights and grounding moments'}
            </p>
          </div>
          <button className="mc-btn-icon" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>
            <X size={20} />
          </button>
        </div>

        {/* ─── New Session Action Bar ─── */}
        <div style={{ padding: 'var(--s-4) var(--s-6)', borderBottom: '1px solid var(--mc-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="mc-btn-presence-toggle"
            style={{ width: '100%', justifyContent: 'center', padding: '10px var(--s-4)', fontSize: 'var(--text-sm)' }}
            onClick={() => {
              onNewSession?.();
              onClose();
            }}
          >
            <Plus size={16} weight="bold" />
            <span>{isRTL ? 'بدء محادثة جديدة وتخزين السابقة' : 'Start New Session'}</span>
          </button>
        </div>

        <div className="mc-drawer-body">
          {sessions.length === 0 ? (
            <div className="mc-drawer-empty">
              <ChatCircleDots size={36} weight="duotone" style={{ opacity: 0.4, marginBottom: 'var(--s-3)' }} />
              <p>{isRTL ? 'لا توجد جلسات سابقة مسجلة بعد.' : 'No recorded sessions yet.'}</p>
              <span>{isRTL ? 'ستظهر جلساتك وملاحظاتك هنا بعد إتمامها.' : 'Completed sessions and insights will appear here.'}</span>
            </div>
          ) : (
            <div className="mc-session-list">
              {sessions.map((s) => (
                <div 
                  key={s.id} 
                  className="mc-session-entry"
                  style={{ cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease-out)' }}
                  onClick={() => {
                    onSelectSession?.(s);
                    onClose();
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div className="mc-session-entry-meta">
                      <span className="mc-session-tag">
                        <CalendarBlank size={12} />
                        <span>{s.date}</span>
                      </span>
                      <span className="mc-session-tag duration">
                        <Clock size={12} />
                        <span>{s.duration}</span>
                      </span>
                      {s.topic && (
                        <span className="mc-session-tag topic">
                          <span>{s.topic}</span>
                        </span>
                      )}
                    </div>
                    {onDeleteSession && (
                      <button
                        className="mc-btn-icon"
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                        title={isRTL ? 'حذف الجلسة' : 'Delete session'}
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                  <p className="mc-session-entry-summary bidi-text">
                    {s.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
