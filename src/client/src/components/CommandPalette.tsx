import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlass, 
  House, 
  ChatCircleText, 
  Feather, 
  Heartbeat, 
  BookBookmark, 
  ShieldCheck, 
  LockKey, 
  GearSix,
  Wind,
  MoonStars,
  Smiley
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';
import type { NavItem } from './Sidebar';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (nav: NavItem) => void;
  onStartChat: (prompt?: string) => void;
}

export function CommandPalette({ isOpen, onClose, onNavigate, onStartChat }: CommandPaletteProps) {
  const { isRTL } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: CommandItem[] = [
    {
      id: 'home',
      title: isRTL ? 'الرئيسية (Home)' : 'Home Overview',
      category: isRTL ? 'تنقل' : 'Navigation',
      icon: <House size={18} />,
      action: () => { onNavigate('home'); onClose(); }
    },
    {
      id: 'talk',
      title: isRTL ? 'محادثة علاجية (Talk)' : 'Start Therapeutic Dialogue',
      category: isRTL ? 'محادثة' : 'Dialogue',
      icon: <ChatCircleText size={18} />,
      action: () => { onNavigate('chat'); onClose(); }
    },
    {
      id: 'mood',
      title: isRTL ? 'تسجيل فحص عاطفي (Log Mood)' : 'Log Emotional Check-in',
      category: isRTL ? 'مشاعر' : 'Wellbeing',
      icon: <Smiley size={18} />,
      action: () => { onNavigate('mood'); onClose(); }
    },
    {
      id: 'journal',
      title: isRTL ? 'مذكرات وتأملات خاصة (Journal)' : 'Private Journal & Reflections',
      category: isRTL ? 'مذكرات' : 'Reflect',
      icon: <BookBookmark size={18} />,
      action: () => { onNavigate('journal'); onClose(); }
    },
    {
      id: 'breathing',
      title: isRTL ? 'تمرين تنفس ٤-٧-٨ (4-7-8 Breathing)' : '4-7-8 Breathing Pacer',
      category: isRTL ? 'عافية' : 'Wellness',
      icon: <Heartbeat size={18} />,
      action: () => { onNavigate('wellness'); onClose(); }
    },
    {
      id: 'grounding',
      title: isRTL ? 'تثبيت حسي ٥-٤-٣-٢-١ (5-4-3-2-1 Sensory)' : '5-4-3-2-1 Somatic Grounding',
      category: isRTL ? 'عافية' : 'Wellness',
      icon: <Wind size={18} />,
      action: () => { onNavigate('wellness'); onClose(); }
    },
    {
      id: 'sleep',
      title: isRTL ? 'استرخاء النوم العميق (NSDR Sleep)' : 'NSDR Sleep Wind-Down',
      category: isRTL ? 'عافية' : 'Wellness',
      icon: <MoonStars size={18} />,
      action: () => { onNavigate('wellness'); onClose(); }
    },
    {
      id: 'safety',
      title: isRTL ? 'مركز الأمان وخطوط الطوارئ (Safety Center)' : 'Safety Center & 24/7 Helplines',
      category: isRTL ? 'أمان' : 'Safety',
      icon: <ShieldCheck size={18} />,
      action: () => { onNavigate('safety'); onClose(); }
    },
    {
      id: 'privacy',
      title: isRTL ? 'الخصوصية وإدارة الذاكرة (Privacy Center)' : 'Privacy & Memory Controls',
      category: isRTL ? 'خصوصية' : 'Privacy',
      icon: <LockKey size={18} />,
      action: () => { onNavigate('privacy'); onClose(); }
    },
    {
      id: 'settings',
      title: isRTL ? 'الإعدادات واللغة (Settings)' : 'Settings & Language',
      category: isRTL ? 'إعدادات' : 'Preferences',
      icon: <GearSix size={18} />,
      action: () => { onNavigate('settings'); onClose(); }
    }
  ];

  const filtered = items.filter(i => 
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent will toggle
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mc-drawer-overlay" style={{ justifyContent: 'center', alignItems: 'flex-start', padding: 'clamp(12px, 5vh, 48px) var(--s-3)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        className="mc-login-card" 
        style={{ width: '100%', maxWidth: 580, padding: 0, overflow: 'hidden', textAlign: 'start', maxHeight: '88dvh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
      >
        {/* ─── Search Cover Header with Logo ─── */}
        <div style={{
          padding: 'var(--s-4) var(--s-5)',
          background: 'linear-gradient(135deg, rgba(18, 100, 163, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)',
          borderBottom: '1px solid var(--mc-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-3)'
        }}>
          <img 
            src="/logo.jpg" 
            alt="MindCare" 
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 10, 
              objectFit: 'cover', 
              boxShadow: '0 4px 12px rgba(18, 100, 163, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
            }} 
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--mc-text)' }}>
              {isRTL ? 'بحث وأدوات MindCare' : 'MindCare Search & Tools'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--mc-text-tertiary)' }}>
              {isRTL ? 'تنقل فوري بين المساحات الإكلينيكية وتمارين التهدئة' : 'Instant navigation across clinical spaces & wellness tools'}
            </div>
          </div>
        </div>

        {/* Search Field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-5)', borderBottom: '1px solid var(--mc-border)' }}>
          <MagnifyingGlass size={20} style={{ color: 'var(--mc-accent)', flexShrink: 0 }} />
          <input
            type="text"
            autoFocus
            className="mc-chat-input-field bidi-text"
            placeholder={isRTL ? 'ابحث في المساحات، التمارين، والأدوات (Cmd+K)...' : 'Search spaces, exercises, and actions (Cmd+K)...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="mc-session-tag">ESC</span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: 'var(--s-2)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 'var(--s-8)', textAlign: 'center', color: 'var(--mc-text-tertiary)', fontSize: 'var(--text-sm)' }}>
              {isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching results found.'}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className="mc-sidebar-item"
                style={{
                  padding: 'var(--s-3) var(--s-4)',
                  backgroundColor: idx === selectedIndex ? 'var(--mc-bg-hover)' : 'transparent',
                  color: idx === selectedIndex ? 'var(--mc-text)' : 'var(--mc-text-secondary)',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--r-sm)'
                }}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                  <span style={{ color: idx === selectedIndex ? 'var(--mc-accent)' : 'inherit' }}>
                    {item.icon}
                  </span>
                  <span style={{ fontWeight: idx === selectedIndex ? 600 : 500, fontSize: 'var(--text-sm)' }}>
                    {item.title}
                  </span>
                </div>
                <span className="mc-session-tag duration" style={{ fontSize: '10px' }}>
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
