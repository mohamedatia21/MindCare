import { useState } from 'react';
import { 
  Smiley, 
  TrendUp, 
  Plus, 
  Lightbulb, 
  CalendarBlank,
  ChatCircleText
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface MoodEntry {
  id: string;
  timestamp: string;
  mood: string;
  score: number; // 1 to 5
  note?: string;
  tags?: string[];
}

interface MoodViewProps {
  onStartChatWithContext?: (context: string) => void;
}

export function MoodView({ onStartChatWithContext }: MoodViewProps) {
  const { isRTL } = useLanguage();
  const [entries, setEntries] = useState<MoodEntry[]>([
    {
      id: '1',
      timestamp: isRTL ? 'اليوم، ٩:٣٠ ص' : 'Today, 9:30 AM',
      mood: isRTL ? 'هادئ ومستقر' : 'Grounded & Calm',
      score: 4,
      note: isRTL ? 'بدأت اليوم بتمارين تنفس وشربت قهوة بهدوء.' : 'Started the day with gentle breathing and quiet morning routine.',
      tags: isRTL ? ['روتين صباحي', 'تنفس'] : ['Morning', 'Breathing']
    },
    {
      id: '2',
      timestamp: isRTL ? 'أمس، ٨:١٥ م' : 'Yesterday, 8:15 PM',
      mood: isRTL ? 'أفكار متزاحمة' : 'Reflective / Racing Thoughts',
      score: 3,
      note: isRTL ? 'شعرت ببعض الضغط بسبب اقتراب موعد تسليم المشروع.' : 'Felt slight deadline pressure regarding upcoming project deliverable.',
      tags: isRTL ? ['عمل', 'توتر'] : ['Work', 'Stress']
    },
    {
      id: '3',
      timestamp: isRTL ? '١٨ أكتوبر' : 'Oct 18',
      mood: isRTL ? 'صافي الذهن' : 'Clear & Energetic',
      score: 5,
      note: isRTL ? 'جلسة مشي ممتعة وإنجاز جيد في المهام.' : 'Refreshing walk outdoors and strong mental clarity.',
      tags: isRTL ? ['رياضة', 'وضوح'] : ['Outdoors', 'Focus']
    }
  ]);

  const [selectedScore, setSelectedScore] = useState<number>(4);
  const [currentNote, setCurrentNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const moodLevels = [
    { score: 1, label: isRTL ? 'ثقيل جداً' : 'Very Heavy', color: 'var(--mc-crisis)' },
    { score: 2, label: isRTL ? 'مشتت / قلق' : 'Overwhelmed', color: 'var(--mc-warm)' },
    { score: 3, label: isRTL ? 'محايد' : 'Neutral', color: 'var(--mc-text-tertiary)' },
    { score: 4, label: isRTL ? 'هادئ' : 'Calm', color: 'var(--mc-safe)' },
    { score: 5, label: isRTL ? 'ممتاز وصافٍ' : 'Clear & Joyful', color: 'var(--mc-accent)' }
  ];

  const handleSaveEntry = () => {
    const selectedObj = moodLevels.find(m => m.score === selectedScore);
    const newEntry: MoodEntry = {
      id: Date.now().toString(),
      timestamp: isRTL ? 'الآن' : 'Just now',
      mood: selectedObj ? selectedObj.label : (isRTL ? 'هادئ' : 'Calm'),
      score: selectedScore,
      note: currentNote.trim() || undefined,
      tags: isRTL ? ['فحص يومي'] : ['Daily Check-in']
    };
    setEntries([newEntry, ...entries]);
    setCurrentNote('');
    setIsAdding(false);
  };

  return (
    <div className="mc-home-container">
      {/* ─── Header & Overview ─── */}
      <section className="mc-home-hero" style={{ textAlign: 'start', alignItems: 'flex-start' }}>
        <div className="mc-home-greeting-label">
          <span>{isRTL ? 'مساحة المشاعر' : 'Emotional Wellbeing'}</span>
          <span>•</span>
          <span>{isRTL ? 'أنماط ووعي ذاتي' : 'Patterns & Trajectory'}</span>
        </div>
        <h1 className="mc-home-greeting">
          {isRTL ? 'مسار مشاعرك ورحلتك' : 'Your Emotional Trajectory'}
        </h1>
        <p className="mc-home-quote" style={{ marginInline: '0', maxWidth: '640px' }}>
          {isRTL 
            ? 'ملاحظة المشاعر بوعي بدون إطلاق أحكام هي أول خطوة نحو التنظيم الانفعالي.'
            : 'Observing your emotions with gentle awareness without judgment is the cornerstone of emotional regulation.'
          }
        </p>
      </section>

      {/* ─── Quick Check-in Interaction Card ─── */}
      <div className="mc-pathway-item" style={{ cursor: 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
            <Smiley size={22} weight="duotone" style={{ color: 'var(--mc-accent)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
              {isRTL ? 'تسجيل الشعور الحالي' : 'Log Current State'}
            </h3>
          </div>
          {!isAdding && (
            <button 
              className="mc-btn-voice-pill" 
              onClick={() => setIsAdding(true)}
            >
              <Plus size={14} />
              <span>{isRTL ? 'إضافة ملاحظة' : 'Add Note'}</span>
            </button>
          )}
        </div>

        {/* 5-point Emotional Scale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBlock: 'var(--s-3)', width: '100%' }}>
          {moodLevels.map((lvl) => (
            <button
              key={lvl.score}
              type="button"
              className={`mc-spectrum-chip ${selectedScore === lvl.score ? 'active' : ''}`}
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'column',
                padding: '8px 2px',
                borderRadius: 'var(--r-md)',
                backgroundColor: selectedScore === lvl.score ? 'var(--mc-bg-elevated)' : 'var(--mc-bg-surface)',
                borderColor: selectedScore === lvl.score ? 'var(--mc-accent)' : 'var(--mc-border)',
                borderWidth: selectedScore === lvl.score ? 2 : 1,
                boxSizing: 'border-box',
                whiteSpace: 'normal',
                gap: 2
              }}
              onClick={() => setSelectedScore(lvl.score)}
            >
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: lvl.color }}>{lvl.score}</span>
              <span style={{ fontSize: '10px', color: 'var(--mc-text-secondary)', textAlign: 'center', lineHeight: 1.15, wordBreak: 'break-word' }}>
                {lvl.label}
              </span>
            </button>
          ))}
        </div>

        {isAdding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            <textarea
              className="mc-chat-input-field bidi-text"
              style={{ 
                backgroundColor: 'var(--mc-bg-surface)', 
                padding: 'var(--s-3)', 
                borderRadius: 'var(--r-sm)', 
                border: '1px solid var(--mc-border)',
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder={isRTL ? 'ما الذي أثر على شعورك الآن؟ (اختياري)...' : 'What is influencing this feeling right now? (Optional)...'}
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
              <button className="mc-btn-voice-pill" onClick={() => setIsAdding(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                className="mc-btn-presence-toggle" 
                style={{ padding: '8px 20px', fontSize: 'var(--text-xs)' }}
                onClick={handleSaveEntry}
              >
                {isRTL ? 'حفظ الفحص' : 'Save Check-in'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Trend Observation (Non-clinical framing) ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            <TrendUp size={16} style={{ display: 'inline', marginInlineEnd: 6 }} />
            {isRTL ? 'رؤى الأنماط (استكشافية غير تشخيصية)' : 'Observed Trends (Exploratory)'}
          </span>
        </div>

        <div className="mc-pathway-item" style={{ backgroundColor: 'var(--mc-bg-elevated)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-accent)', marginBottom: 'var(--s-2)' }}>
            <Lightbulb size={18} weight="fill" />
            <strong style={{ fontSize: 'var(--text-sm)' }}>
              {isRTL ? 'ملاحظة إيجابية' : 'Gentle Pattern Insight'}
            </strong>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', lineHeight: 'var(--leading-normal)' }}>
            {isRTL 
              ? 'تظهر سجلاتك استقراراً أكبر في الأيام التي تمارس فيها تمارين التنفس الصباحي. يمكنك الاستمرار في هذا الروتين لتعزيز هدوئك.'
              : 'Your check-ins show higher stability on days following morning grounding. Maintaining this routine may continue supporting your emotional resilience.'
            }
          </p>
          {onStartChatWithContext && (
            <button
              className="mc-btn-voice-pill"
              style={{ marginTop: 'var(--s-3)', alignSelf: 'flex-start' }}
              onClick={() => onStartChatWithContext(isRTL ? 'أريد استكشاف أنماط توتري الصباحي وكيفية تحسينها.' : 'I would like to explore my morning anxiety patterns and how to improve them.')}
            >
              <ChatCircleText size={16} />
              <span>{isRTL ? 'تحدث مع مايندكير حول هذا النمط' : 'Reflect on this with MindCare'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Recent Mood History ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            {isRTL ? 'سجل الفحوصات السابقة' : 'Recent Check-in Timeline'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {entries.map((entry) => (
            <div key={entry.id} className="mc-session-entry" style={{ cursor: 'default' }}>
              <div className="mc-session-entry-meta">
                <span className="mc-session-tag">
                  <CalendarBlank size={12} />
                  <span>{entry.timestamp}</span>
                </span>
                <span className="mc-session-tag topic">
                  <span>{entry.mood}</span>
                </span>
                {entry.tags?.map((t, idx) => (
                  <span key={idx} className="mc-session-tag duration">
                    <span>{t}</span>
                  </span>
                ))}
              </div>
              {entry.note && (
                <p className="mc-session-entry-summary bidi-text" style={{ fontSize: 'var(--text-sm)' }}>
                  {entry.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
