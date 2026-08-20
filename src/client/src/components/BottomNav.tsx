import React from 'react';
import { 
  House, 
  ChatCircleText, 
  Feather, 
  Heartbeat, 
  ShieldCheck 
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';
import type { NavItem } from './Sidebar';

interface BottomNavProps {
  activeNav: NavItem;
  onNavigate: (nav: NavItem) => void;
}

export function BottomNav({ activeNav, onNavigate }: BottomNavProps) {
  const { isRTL } = useLanguage();

  const items: { id: NavItem; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: isRTL ? 'الرئيسية' : 'Home', icon: <House size={20} weight={activeNav === 'home' ? 'fill' : 'regular'} /> },
    { id: 'chat', label: isRTL ? 'محادثة' : 'Talk', icon: <ChatCircleText size={20} weight={activeNav === 'chat' ? 'fill' : 'regular'} /> },
    { id: 'wellness', label: isRTL ? 'تهدئة' : 'Wellness', icon: <Heartbeat size={20} weight={activeNav === 'wellness' ? 'fill' : 'regular'} /> },
    { id: 'safety', label: isRTL ? 'أمان' : 'Safety', icon: <ShieldCheck size={20} weight={activeNav === 'safety' ? 'fill' : 'regular'} /> },
  ];

  return (
    <nav className="mc-bottom-nav" aria-label={isRTL ? 'التنقل السفلي' : 'Mobile Navigation'}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`mc-bottom-nav-item ${activeNav === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={activeNav === item.id ? 'page' : undefined}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
