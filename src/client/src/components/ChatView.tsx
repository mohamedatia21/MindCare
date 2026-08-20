import React, { useRef, useEffect } from 'react';
import { 
  Microphone, 
  PaperPlaneTilt, 
  Feather, 
  HandHeart,
  WaveformSlash,
  ArrowRight,
  Plus,
  ArrowSquareOut
} from '@phosphor-icons/react';
import { AIEntity } from './AIEntity';
import { SourceCitation, type Source } from './SourceCitation';
import { useLanguage } from '../contexts/LanguageContext';

export interface ChatMessage {
  id?: string;
  sender: 'user' | 'mindcare';
  text: string;
  timestamp: string;
  sources?: Source[];
  suggestedHandoff?: boolean;
}

interface ChatViewProps {
  messages: ChatMessage[];
  inputText: string;
  onInputChange: (text: string) => void;
  onSendMessage: (text?: string) => void;
  onToggleVoice: () => void;
  onNewChat?: () => void;
  isVoiceActive: boolean;
  isConnected: boolean;
  backendState: string;
  isStreaming: boolean;
  onRetry?: () => void;
  onHandoffClick?: () => void;
}

// ─── Rich Message Formatter with Clickable Linkification ───
function renderFormattedMessage(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const isCitationLine = /^(المصدر|المصادر|Source|Sources)\s*:/i.test(line.trim());
    const parts = line.split(urlRegex);

    return (
      <span key={lineIdx} style={{ display: 'block', minHeight: line.trim() === '' ? '12px' : 'auto', marginBlockEnd: '4px' }}>
        {isCitationLine && (
          <span style={{ fontWeight: 600, color: 'var(--mc-accent)', marginInlineEnd: 6 }}>
            {line.match(/^(المصدر|المصادر|Source|Sources)\s*:/i)?.[0]}
          </span>
        )}
        {parts.map((part, partIdx) => {
          if (part.match(urlRegex)) {
            const cleanUrl = part.replace(/[.,;)]+$/, '');
            const trailing = part.slice(cleanUrl.length);
            return (
              <React.Fragment key={partIdx}>
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mc-inline-link"
                  style={{
                    color: 'var(--mc-accent)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginInline: '2px',
                    padding: '2px 8px',
                    backgroundColor: 'var(--mc-accent-light)',
                    borderRadius: 'var(--r-sm)',
                    wordBreak: 'break-all',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{cleanUrl}</span>
                  <ArrowSquareOut size={14} style={{ flexShrink: 0 }} />
                </a>
                {trailing}
              </React.Fragment>
            );
          }
          if (isCitationLine && partIdx === 0) {
            const afterPrefix = part.replace(/^(المصدر|المصادر|Source|Sources)\s*:\s*/i, '');
            return <span key={partIdx}>{afterPrefix}</span>;
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </span>
    );
  });
}

export function ChatView({
  messages,
  inputText,
  onInputChange,
  onSendMessage,
  onToggleVoice,
  onNewChat,
  isVoiceActive,
  backendState,
  isStreaming,
  onHandoffClick
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, isRTL } = useLanguage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const englishSuggestions = [
    "I'm feeling a wave of anxiety right now.",
    "Can you guide me through a 4-7-8 calming breath?",
    "Help me challenge a catastrophic thought I can't shake.",
    "I've been feeling disconnected and drained today."
  ];

  const arabicSuggestions = [
    "أشعر بموجة مفاجئة من القلق والتوتر الآن.",
    "هل يمكنك إرشادي خلال تمرين تنفس مهدئ ومساعدتي على النوم؟",
    "ساعدني في إعادة صياغة فكرة سلبية تراودني باستمرار.",
    "أشعر بالإرهاق والانفصال الذهني اليوم."
  ];

  const suggestions = isRTL ? arabicSuggestions : englishSuggestions;

  return (
    <div className="mc-chat-container">
      {/* ─── Top Session Control Bar ─── */}
      <div className="mc-chat-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', minWidth: 0 }}>
          <img 
            src="/logo.jpg" 
            alt="MindCare" 
            style={{ 
              width: 24, 
              height: 24, 
              borderRadius: 6, 
              objectFit: 'cover', 
              boxShadow: '0 2px 8px rgba(18, 100, 163, 0.15)',
              flexShrink: 0
            }} 
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', minWidth: 0 }}>
            <span className="mc-spectrum-dot calm" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--mc-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isRTL ? 'جلسة إكلينيكية نشطة' : 'Active Session'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {onNewChat && (
            <button
              type="button"
              className="mc-btn-voice-pill"
              onClick={onNewChat}
              title={isRTL ? 'حفظ الجلسة وبدء جلسة جديدة' : 'Save and start new session'}
              style={{ padding: '5px 10px' }}
            >
              <Plus size={14} weight="bold" />
              <span>{isRTL ? 'جديدة' : 'New'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Conversational Reading Scroll ─── */}
      <div className="mc-chat-messages-scroll">
        {messages.length === 0 ? (
          <div className="mc-chat-empty-serene">
            <div className="mc-chat-empty-entity">
              <AIEntity state={backendState} audioActive={false} />
            </div>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)', padding: '4px 12px', borderRadius: 'var(--r-full)', background: 'rgba(18, 100, 163, 0.08)', border: '1px solid rgba(18, 100, 163, 0.15)', marginBottom: 'var(--s-3)' }}>
              <img src="/logo.jpg" alt="MindCare" style={{ width: 18, height: 18, borderRadius: 4 }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--mc-accent)' }}>MindCare Sanctuary</span>
            </div>

            <h2>
              {isRTL ? 'أنا هنا للاستماع إليك ومشاركتك' : 'I am here. Take your time.'}
            </h2>
            <p>
              {isRTL 
                ? 'مساحة آمنة وخاصة للحوار والتنظيم الانفعالي القائم على الأدلة الإكلينيكية.'
                : 'A calm, confidential space to unpack your thoughts and practice grounded emotional regulation.'
              }
            </p>

            <div className="mc-chat-suggestions">
              {suggestions.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="mc-chat-suggestion-pill"
                  onClick={() => onSendMessage(prompt)}
                >
                  <span className="bidi-text">{prompt}</span>
                  <ArrowRight size={14} style={{ opacity: 0.6 }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`mc-msg-row ${msg.sender}`}>
              <div className="mc-msg-content">
                <div className="mc-msg-header">
                  {msg.sender === 'mindcare' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--mc-accent)' }}>
                      <HandHeart size={14} weight="fill" />
                      MindCare
                    </span>
                  ) : (
                    <span>{isRTL ? 'أنت' : 'You'}</span>
                  )}
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className={msg.sender === 'user' ? 'mc-msg-body-user bidi-text' : 'mc-msg-body-mindcare bidi-text'}>
                  {renderFormattedMessage(msg.text)}
                </div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <SourceCitation sources={msg.sources} />
                )}

                {/* Suggested Professional Handoff */}
                {msg.suggestedHandoff && onHandoffClick && (
                  <div className="mc-handoff-banner">
                    <HandHeart size={20} weight="duotone" />
                    <div>
                      <strong>
                        {isRTL ? 'التواصل مع دعم إكلينيكي متخصص' : 'Connect with Professional Support'}
                      </strong>
                      <p>
                        {isRTL 
                          ? 'في بعض اللحظات، يكون التحدث مع معالج بشري خطوة شديدة الأهمية والفائدة.'
                          : 'Sometimes speaking with a specialized human clinician is the most caring step forward.'
                        }
                      </p>
                    </div>
                    <button
                      className="mc-btn-handoff"
                      onClick={onHandoffClick}
                    >
                      {isRTL ? 'استعراض خطوط الدعم' : 'View Helplines'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Conversational Input Dock ─── */}
      <div className="mc-chat-input-dock">
        <div className="mc-chat-input-wrapper">
          <button
            type="button"
            className={`mc-btn-voice-toggle ${isVoiceActive ? 'active' : ''}`}
            onClick={onToggleVoice}
            title={isVoiceActive ? (isRTL ? 'إيقاف الصوت' : 'Mute Voice') : (isRTL ? 'بدء الصوت' : 'Start Voice')}
          >
            {isVoiceActive ? <WaveformSlash size={20} weight="fill" /> : <Microphone size={20} />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'EGYPTIAN_ARABIC' ? 'ENGLISH' : 'EGYPTIAN_ARABIC')}
            title={language === 'EGYPTIAN_ARABIC' ? 'التبديل إلى الإنجليزية' : 'التبديل إلى اللهجة المصرية'}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--r-full)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--mc-text)',
              border: '1px solid var(--mc-border-subtle)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {language === 'EGYPTIAN_ARABIC' ? '🇪🇬 مصري' : '🇺🇸 EN'}
          </button>

          <input
            type="text"
            className="mc-chat-input-field bidi-text"
            placeholder={isVoiceActive ? (isRTL ? 'الاستماع لصوتك جارٍ...' : 'Listening to your voice...') : (isRTL ? 'اكتب ما يدور في خاطرك بحرية...' : 'Type what feels present for you...')}
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            type="button"
            className="mc-btn-send"
            disabled={!inputText.trim()}
            onClick={() => onSendMessage()}
            title={isRTL ? 'إرسال' : 'Send'}
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
