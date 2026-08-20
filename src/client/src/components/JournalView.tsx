import { useState } from 'react';
import { 
  BookBookmark, 
  Plus, 
  MagnifyingGlass, 
  Trash, 
  HandHeart, 
  CalendarBlank,
  LockKey
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  tags?: string[];
  aiReflection?: string;
}

interface JournalViewProps {
  onStartChatWithContext?: (context: string) => void;
}

export function JournalView({ onStartChatWithContext }: JournalViewProps) {
  const { isRTL } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: '1',
      title: isRTL ? 'إعادة التفكير في ضغوط العمل' : 'Rethinking Work Boundaries',
      content: isRTL 
        ? 'لاحظت اليوم أنني أتحمل مسؤوليات إضافية بدون داعٍ خوفاً من إحباط زملائي. أحتاج لتعلم قول لا بهدوء وثقة.'
        : 'I realized today that I take on excessive tasks simply out of fear of disappointing my team. I need to practice setting calm, clear boundaries.',
      date: isRTL ? '١٩ أكتوبر ٢٠٢٦' : 'Oct 19, 2026',
      tags: isRTL ? ['حدود شخصية', 'عمل'] : ['Boundaries', 'Work'],
      aiReflection: isRTL 
        ? 'خطوة رائعة في الوعي الذاتي. وضع الحدود ليس أنانية بل حماية لطاقتك وقدرتك على العطاء.'
        : 'A valuable moment of clarity. Boundary-setting is not avoidance; it is an act of preserving your mental energy.'
    },
    {
      id: '2',
      title: isRTL ? 'لحظة امتنان مسائية' : 'Evening Gratitude & Decompression',
      content: isRTL 
        ? 'قضيت وقتاً هادئاً مع عائلتي وتحدثنا بدون هواتف. شعرت بسلام داخلي كنت أفتقده طوال الأسبوع.'
        : 'Spent quality offline time with family. Felt a sense of grounded tranquility that I had been missing all week.',
      date: isRTL ? '١٦ أكتوبر ٢٠٢٦' : 'Oct 16, 2026',
      tags: isRTL ? ['امتنان', 'عائلة'] : ['Gratitude', 'Connection']
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const filteredEntries = entries.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveEntry = () => {
    if (!newContent.trim()) return;
    const entry: JournalEntry = {
      id: Date.now().toString(),
      title: newTitle.trim() || (isRTL ? 'خواطر وتأملات' : 'Reflective Thought'),
      content: newContent.trim(),
      date: isRTL ? 'اليوم' : 'Today',
      tags: isRTL ? ['مذكرات خاصة'] : ['Personal Journal']
    };
    setEntries([entry, ...entries]);
    setNewTitle('');
    setNewContent('');
    setIsComposing(false);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  return (
    <div className="mc-home-container">
      {/* ─── Header ─── */}
      <section className="mc-home-hero" style={{ textAlign: 'start', alignItems: 'flex-start' }}>
        <div className="mc-home-greeting-label">
          <LockKey size={14} weight="fill" style={{ color: 'var(--mc-safe)' }} />
          <span>{isRTL ? 'مذكراتك المشفرة' : 'Private Reflections'}</span>
          <span>•</span>
          <span>{isRTL ? 'مساحة كتابة آمنة' : 'Encrypted Space'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
          <div>
            <h1 className="mc-home-greeting">
              {isRTL ? 'المذكرات والتأمل الذاتي' : 'Personal Journal & Reflections'}
            </h1>
            <p className="mc-home-quote" style={{ marginInline: '0', maxWidth: '640px' }}>
              {isRTL 
                ? 'تفريغ الأفكار كتابة يساعد الدماغ على تنظيم المشاعر وتقليل حدة التوتر.'
                : 'Writing out your thoughts helps externalize internal clutter and aids cognitive processing.'
              }
            </p>
          </div>
          {!isComposing && (
            <button 
              className="mc-btn-presence-toggle" 
              style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}
              onClick={() => setIsComposing(true)}
            >
              <Plus size={16} weight="bold" />
              <span>{isRTL ? 'كتابة تدوينة جديدة' : 'New Reflection'}</span>
            </button>
          )}
        </div>
      </section>

      {/* ─── Search & Filter Bar ─── */}
      <div className="mc-chat-input-wrapper" style={{ boxShadow: 'var(--shadow-subtle)' }}>
        <MagnifyingGlass size={18} style={{ color: 'var(--mc-text-tertiary)' }} />
        <input
          type="text"
          className="mc-chat-input-field bidi-text"
          placeholder={isRTL ? 'ابحث في مذكراتك وتأملاتك السابقة...' : 'Search your past entries and insights...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ─── Compose Modal / Form ─── */}
      {isComposing && (
        <div className="mc-pathway-item" style={{ backgroundColor: 'var(--mc-bg-elevated)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
            <BookBookmark size={20} weight="duotone" style={{ color: 'var(--mc-accent)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
              {isRTL ? 'تدوينة تأملية جديدة' : 'New Reflection Entry'}
            </h3>
          </div>

          <input
            type="text"
            className="mc-chat-input-field bidi-text"
            style={{ 
              backgroundColor: 'var(--mc-bg-surface)', 
              padding: 'var(--s-3)', 
              borderRadius: 'var(--r-sm)', 
              border: '1px solid var(--mc-border)',
              marginBottom: 'var(--s-3)',
              fontWeight: 600
            }}
            placeholder={isRTL ? 'عنوان التدوينة (اختياري)...' : 'Entry title (Optional)...'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <textarea
            className="mc-chat-input-field bidi-text"
            style={{ 
              backgroundColor: 'var(--mc-bg-surface)', 
              padding: 'var(--s-4)', 
              borderRadius: 'var(--r-sm)', 
              border: '1px solid var(--mc-border)',
              minHeight: '140px',
              resize: 'vertical',
              lineHeight: 'var(--leading-loose)'
            }}
            placeholder={isRTL ? 'اكتب ما تشعر به بحرية تامة وبدون قيود...' : 'Express whatever thoughts and sensations are present for you right now...'}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-4)' }}>
            <button className="mc-btn-voice-pill" onClick={() => setIsComposing(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              className="mc-btn-presence-toggle" 
              style={{ padding: '8px 24px', fontSize: 'var(--text-xs)' }}
              onClick={handleSaveEntry}
              disabled={!newContent.trim()}
            >
              {isRTL ? 'حفظ التدوينة' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Entry Timeline List ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
        {filteredEntries.length === 0 ? (
          <div className="mc-drawer-empty" style={{ paddingBlock: 'var(--s-16)' }}>
            <BookBookmark size={40} weight="duotone" style={{ opacity: 0.3, marginBottom: 'var(--s-3)' }} />
            <p>{isRTL ? 'لم يتم العثور على مذكرات مطابقة.' : 'No matching journal entries found.'}</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="mc-session-entry" style={{ padding: 'var(--s-6)', cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--s-3)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--mc-text)', marginBottom: 4 }}>
                    {entry.title}
                  </h3>
                  <div className="mc-session-entry-meta">
                    <span className="mc-session-tag">
                      <CalendarBlank size={12} />
                      <span>{entry.date}</span>
                    </span>
                    {entry.tags?.map((t, idx) => (
                      <span key={idx} className="mc-session-tag duration">
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="mc-btn-icon"
                  onClick={() => handleDeleteEntry(entry.id)}
                  title={isRTL ? 'حذف' : 'Delete'}
                  aria-label={isRTL ? 'حذف' : 'Delete'}
                >
                  <Trash size={16} />
                </button>
              </div>

              <p className="bidi-text" style={{ fontSize: 'var(--text-base)', color: 'var(--mc-text)', lineHeight: 'var(--leading-loose)', whiteSpace: 'pre-wrap', marginBottom: 'var(--s-4)' }}>
                {entry.content}
              </p>

              {/* Optional Compassionate Reflection Attachment */}
              {entry.aiReflection ? (
                <div className="mc-clinical-footnote" style={{ backgroundColor: 'var(--mc-accent-light)', borderInlineStartColor: 'var(--mc-accent)' }}>
                  <HandHeart size={18} weight="fill" style={{ color: 'var(--mc-accent)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: 'var(--mc-accent)', display: 'block', marginBottom: 2, fontSize: 'var(--text-xs)' }}>
                      {isRTL ? 'تأمل مقترح من مايندكير' : 'MindCare Compassionate Reflection'}
                    </strong>
                    <p style={{ color: 'var(--mc-text)', fontSize: 'var(--text-xs)' }}>
                      {entry.aiReflection}
                    </p>
                  </div>
                </div>
              ) : (
                onStartChatWithContext && (
                  <button
                    className="mc-btn-voice-pill"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => onStartChatWithContext(
                      isRTL 
                        ? `كتبت هذه الملاحظة في مذكراتي: "${entry.content}". هل يمكنك مساعدتي في التأمل فيها؟`
                        : `I wrote this in my journal: "${entry.content}". Could we explore this reflection together?`
                    )}
                  >
                    <HandHeart size={14} />
                    <span>{isRTL ? 'تأمل مع مايندكير حول هذه التدوينة' : 'Reflect on this with MindCare'}</span>
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
