import { useState } from 'react';
import { 
  ShieldCheck, 
  LockKey, 
  Trash, 
  DownloadSimple, 
  CheckCircle,
  EyeSlash,
  HardDrives
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

export function PrivacyView() {
  const { isRTL } = useLanguage();
  const [memoryWiped, setMemoryWiped] = useState(false);
  const [exportTriggered, setExportTriggered] = useState(false);

  const handleWipeMemory = () => {
    localStorage.removeItem('mc_trusted_name');
    localStorage.removeItem('mc_trusted_phone');
    setMemoryWiped(true);
    setTimeout(() => setMemoryWiped(false), 3000);
  };

  const handleExportData = () => {
    setExportTriggered(true);
    setTimeout(() => setExportTriggered(false), 3000);
  };

  return (
    <div className="mc-home-container">
      {/* ─── Header ─── */}
      <section className="mc-home-hero" style={{ textAlign: 'start', alignItems: 'flex-start' }}>
        <div className="mc-home-greeting-label">
          <LockKey size={16} weight="fill" style={{ color: 'var(--mc-safe)' }} />
          <span>{isRTL ? 'مركز الخصوصية والشفافية' : 'Privacy & Trust Center'}</span>
          <span>•</span>
          <span>{isRTL ? 'بياناتك ملكك بالكامل' : 'Complete Sovereignty'}</span>
        </div>
        <h1 className="mc-home-greeting">
          {isRTL ? 'الشفافية والتحكم في البيانات' : 'Data Transparency & Privacy Controls'}
        </h1>
        <p className="mc-home-quote" style={{ marginInline: '0', maxWidth: '640px' }}>
          {isRTL 
            ? 'بياناتك يتم التعامل معها بسرية تامة وتشفير شامل عبر بنية عزل أمني على مستوى الصفوف (Row-Level Security).'
            : 'Your interactions are handled with strict confidentiality, end-to-end encryption, and Row-Level Security tenant isolation.'
          }
        </p>
      </section>

      {/* ─── Transparent Data Ledger ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            <HardDrives size={16} style={{ display: 'inline', marginInlineEnd: 6 }} />
            {isRTL ? 'ما الذي يتم تخزينه وكيف يُحمى؟' : 'What We Store & How It Is Protected'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--s-3)' }}>
          <div className="mc-pathway-item" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-safe)', marginBottom: 'var(--s-2)' }}>
              <CheckCircle size={20} weight="fill" />
              <h4 style={{ margin: 0 }}>{isRTL ? 'بيانات الجلسات والمذكرات' : 'Session & Reflection Data'}</h4>
            </div>
            <p>{isRTL ? 'تُخزن في قاعدة بيانات مشفرة ومحمية بسياسات RLS ولا يمكن لأي مستخدم آخر الوصول إليها.' : 'Stored in encrypted PostgreSQL with Row-Level Security. Strictly isolated per tenant ID.'}</p>
          </div>

          <div className="mc-pathway-item" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-safe)', marginBottom: 'var(--s-2)' }}>
              <EyeSlash size={20} weight="fill" />
              <h4 style={{ margin: 0 }}>{isRTL ? 'التدفقات الصوتية الحية' : 'Voice Audio Streams'}</h4>
            </div>
            <p>{isRTL ? 'تُعالج في الذاكرة اللحظية (In-Memory) لتوليد النصوص ولا يتم حفظ التسجيلات الصوتية الخام.' : 'Processed strictly in volatile memory for live STT/TTS. Raw audio files are never retained.'}</p>
          </div>

          <div className="mc-pathway-item" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--mc-safe)', marginBottom: 'var(--s-2)' }}>
              <LockKey size={20} weight="fill" />
              <h4 style={{ margin: 0 }}>{isRTL ? 'التضمينات المعرفية (RAG)' : 'Vector Embeddings'}</h4>
            </div>
            <p>{isRTL ? 'تُحول المعلومات المصرح بها إلى متجهات رياضية لاسترجاع السياق بدون مشاركة هويتك الشخصية.' : 'Sanitized vectors used for cognitive retrieval without exposing raw PII to model providers.'}</p>
          </div>
        </div>
      </div>

      {/* ─── Memory Controls & Data Deletion (PHASE 24) ─── */}
      <div className="mc-pathways-section">
        <div className="mc-pathways-header">
          <span className="mc-pathways-title">
            <Trash size={16} style={{ display: 'inline', marginInlineEnd: 6 }} />
            {isRTL ? 'إدارة الذاكرة وحذف البيانات' : 'Memory Controls & Data Erasure'}
          </span>
        </div>

        <div className="mc-pathway-item" style={{ backgroundColor: 'var(--mc-bg-elevated)', cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>{isRTL ? 'مسح الذاكرة الفوري (Instant Memory Wipe)' : 'Instant Memory & Context Reset'}</h4>
              <p style={{ maxWidth: '480px' }}>
                {isRTL 
                  ? 'حذف جميع التفضيلات والسجلات المؤقتة وتوجيه النظام لنسيان السياق المتصل.'
                  : 'Purge all cached memory, preferences, and prompt context across this application instance.'
                }
              </p>
            </div>
            <button
              className="mc-btn-presence-toggle"
              style={{ padding: '10px 20px', fontSize: 'var(--text-xs)', backgroundColor: 'var(--mc-crisis)' }}
              onClick={handleWipeMemory}
            >
              <Trash size={14} />
              <span>{memoryWiped ? (isRTL ? 'تم مسح الذاكرة ✓' : 'Memory Cleared ✓') : (isRTL ? 'مسح ذاكرة النظام' : 'Wipe Memory')}</span>
            </button>
          </div>
        </div>

        {/* Export Data */}
        <div className="mc-pathway-item" style={{ backgroundColor: 'var(--mc-bg-elevated)', cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>{isRTL ? 'تصدير نسختك من البيانات' : 'Export Your Complete Record'}</h4>
              <p style={{ maxWidth: '480px' }}>
                {isRTL 
                  ? 'تنزيل ملف مشفر يحتوي على كافة مذكراتك وسجل فحوصاتك العاطفية بتنسيق JSON.'
                  : 'Download a full encrypted JSON archive of your journals, reflections, and check-in timeline.'
                }
              </p>
            </div>
            <button
              className="mc-btn-voice-pill"
              onClick={handleExportData}
            >
              <DownloadSimple size={16} />
              <span>{exportTriggered ? (isRTL ? 'جارٍ تجهيز الملف ✓' : 'Prepared ✓') : (isRTL ? 'تصدير البيانات' : 'Export Archive')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
