import React from 'react';
import { 
  House, 
  ChatCircleText, 
  Feather, 
  Heartbeat, 
  BookBookmark, 
  ShieldCheck, 
  GearSix,
  ClockCounterClockwise,
  Smiley,
  LockKey
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

export type NavItem = 
  | 'home' 
  | 'chat' 
  | 'mood' 
  | 'journal' 
  | 'wellness' 
  | 'history' 
  | 'safety' 
  | 'privacy' 
  | 'settings';

interface SidebarProps {
  activeNav: NavItem;
  onNavigate: (nav: NavItem) => void;
}

export function Sidebar({ activeNav, onNavigate }: SidebarProps) {
  const { isRTL } = useLanguage();

  const primaryItems: { id: NavItem; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: isRTL ? 'الرئيسية' : 'Home', icon: <House size={18} weight={activeNav === 'home' ? 'fill' : 'regular'} /> },
    { id: 'chat', label: isRTL ? 'محادثة علاجية' : 'Talk', icon: <ChatCircleText size={18} weight={activeNav === 'chat' ? 'fill' : 'regular'} /> },
  ];

  const supportItems: { id: NavItem; label: string; icon: React.ReactNode }[] = [
    { id: 'mood', label: isRTL ? 'مسار المشاعر' : 'Mood & Trajectory', icon: <Smiley size={18} weight={activeNav === 'mood' ? 'fill' : 'regular'} /> },
    { id: 'journal', label: isRTL ? 'مذكرات خاصة' : 'Journal', icon: <BookBookmark size={18} weight={activeNav === 'journal' ? 'fill' : 'regular'} /> },
    { id: 'wellness', label: isRTL ? 'تهدئة وتنفس' : 'Wellness & Calm', icon: <Heartbeat size={18} weight={activeNav === 'wellness' ? 'fill' : 'regular'} /> },
    { id: 'history', label: isRTL ? 'سجل الجلسات' : 'History', icon: <ClockCounterClockwise size={18} weight={activeNav === 'history' ? 'fill' : 'regular'} /> },
  ];

  const safetyItems: { id: NavItem; label: string; icon: React.ReactNode }[] = [
    { id: 'safety', label: isRTL ? 'مركز الأمان' : 'Safety & Crisis', icon: <ShieldCheck size={18} weight={activeNav === 'safety' ? 'fill' : 'regular'} /> },
    { id: 'privacy', label: isRTL ? 'الخصوصية والشفافية' : 'Privacy & Trust', icon: <LockKey size={18} weight={activeNav === 'privacy' ? 'fill' : 'regular'} /> },
  ];

  return (
    <aside className="mc-sidebar" aria-label={isRTL ? 'التنقل الرئيسي' : 'Main Navigation'}>
      {/* ─── Logo & Brand Lockup ─── */}
      <div className="mc-sidebar-brand" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
        <img src="/logo.jpg" alt="MindCare Logo" className="mc-sidebar-logo" />
        <div className="mc-sidebar-brand-text">
          <span className="mc-sidebar-title">MindCare</span>
          <span className="mc-sidebar-subtitle">
            {isRTL ? 'رعاية إنسانية داعمة' : 'Compassionate Human Care'}
          </span>
        </div>
      </div>

      {/* ─── Primary Navigation Flow ─── */}
      <nav className="mc-sidebar-nav">
        <span className="mc-sidebar-section-title">
          {isRTL ? 'المساحات الأساسية' : 'Spaces'}
        </span>
        {primaryItems.map((item) => (
          <button
            key={item.id}
            className={`mc-sidebar-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            <span className="mc-sidebar-icon">{item.icon}</span>
            <span className="mc-sidebar-label">{item.label}</span>
          </button>
        ))}

        <span className="mc-sidebar-section-title" style={{ marginTop: 'var(--s-4)' }}>
          {isRTL ? 'الدعم والعافية' : 'Support & Practice'}
        </span>
        {supportItems.map((item) => (
          <button
            key={item.id}
            className={`mc-sidebar-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            <span className="mc-sidebar-icon">{item.icon}</span>
            <span className="mc-sidebar-label">{item.label}</span>
          </button>
        ))}

        <span className="mc-sidebar-section-title" style={{ marginTop: 'var(--s-4)' }}>
          {isRTL ? 'الأمان والخصوصية' : 'Trust & Safety'}
        </span>
        {safetyItems.map((item) => (
          <button
            key={item.id}
            className={`mc-sidebar-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeNav === item.id ? 'page' : undefined}
          >
            <span className="mc-sidebar-icon">{item.icon}</span>
            <span className="mc-sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ─── Footer: Settings ─── */}
      <div className="mc-sidebar-footer">
        <button
          className={`mc-sidebar-item ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="mc-sidebar-icon"><GearSix size={18} /></span>
          <span className="mc-sidebar-label">{isRTL ? 'الإعدادات' : 'Settings'}</span>
        </button>
      </div>
    </aside>
  );
}
