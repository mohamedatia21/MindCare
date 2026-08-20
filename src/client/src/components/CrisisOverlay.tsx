import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ShieldCheck, HandHeart, ArrowRight } from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

interface CrisisResource {
  name: string;
  nameAr?: string;
  phone: string;
  description: string;
  descriptionAr?: string;
}

const STATIC_RESOURCES: Record<string, CrisisResource[]> = {
  'EG': [
    {
      name: 'General Secretariat of Mental Health (Egypt)',
      nameAr: 'الأمانة العامة للصحة النفسية وعلاج الإدمان (مصر)',
      phone: '08008880700',
      description: '24/7 Free confidential mental health crisis hotline in Egypt',
      descriptionAr: 'الخط الساخن المجاني للاستشارات والدعم النفسي على مدار 24 ساعة'
    },
    {
      name: 'Emergency Psychological Counseling',
      nameAr: 'الخط الساخن للدعم النفسي والطوارئ',
      phone: '16328',
      description: 'National helpline for urgent emotional crisis support',
      descriptionAr: 'دعم فوري للطوارئ والأزمات النفسية الحادة'
    }
  ],
  'US': [
    {
      name: '988 Suicide & Crisis Lifeline',
      nameAr: 'شريان الحياة للأزمات والدعم 988',
      phone: '988',
      description: 'Call or text 988 for 24/7 free and confidential support in the US',
      descriptionAr: 'اتصال أو رسائل نصية مجانية ومتاحة 24/7'
    }
  ],
  'Global': [
    {
      name: 'Befrienders Worldwide',
      nameAr: 'منظمة بفريندز الدولية لدعم الأزمات',
      phone: 'https://www.befrienders.org/',
      description: 'Find a trusted free helpline by country worldwide',
      descriptionAr: 'دليل شامل لخطوط الدعم النفسي المجانية حول العالم'
    }
  ]
};

interface CrisisOverlayProps {
  isActive: boolean;
  region?: string;
  onDismiss?: () => void;
}

export const CrisisOverlay: React.FC<CrisisOverlayProps> = ({
  isActive,
  region = 'EG',
  onDismiss
}) => {
  const { isRTL } = useLanguage();
  const resources = STATIC_RESOURCES[region] || STATIC_RESOURCES['EG'];

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mc-drawer-overlay"
          style={{ justifyContent: 'center', alignItems: 'center', padding: 'var(--s-3)' }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="crisis-title"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mc-login-card"
            style={{ maxWidth: 540, textAlign: 'start', padding: 'clamp(16px, 4vw, 32px)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-full)', backgroundColor: 'var(--mc-crisis-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mc-crisis)' }}>
                <HandHeart size={24} weight="duotone" />
              </div>
              <div>
                <span className="mc-sidebar-subtitle" style={{ color: 'var(--mc-crisis)' }}>
                  {isRTL ? 'بروتوكول الأمان الفوري' : 'Immediate Safety Protocol'}
                </span>
                <h2 id="crisis-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--mc-text)' }}>
                  {isRTL ? 'لست مضطراً لمواجهة هذا بمفردك' : "You don't have to handle this moment alone."}
                </h2>
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--mc-text-secondary)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--s-6)' }}>
              {isRTL 
                ? 'سلامتك هي أولويتنا المطلقة. يرجى التواصل فوراً مع أحد خطوط الدعم المتخصصة المجانية المتاحة على مدار الساعة:'
                : 'Your safety is our utmost priority. Please reach out to one of these free, confidential, 24/7 professional support services:'
              }
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', width: '100%', marginBottom: 'var(--s-6)' }}>
              {resources.map((res, idx) => (
                <a
                  key={idx}
                  href={`tel:${res.phone}`}
                  className="mc-pathway-item"
                  style={{ minHeight: 'auto', padding: 'var(--s-4)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
                        {isRTL && res.nameAr ? res.nameAr : res.name}
                      </strong>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)' }}>
                        {isRTL && res.descriptionAr ? res.descriptionAr : res.description}
                      </span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--mc-safe)', fontWeight: 700, fontSize: 'var(--text-base)' }}>
                      <Phone size={18} weight="fill" />
                      <span>{res.phone}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-3)' }}>
              <button
                type="button"
                className="mc-btn-presence-toggle"
                style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}
                onClick={onDismiss}
              >
                {isRTL ? 'أنا بخير، المتابعة إلى المحادثة' : 'I am safe to continue'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
