import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'ENGLISH' | 'EGYPTIAN_ARABIC';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('mc-lang');
    return (saved as Language) || 'EGYPTIAN_ARABIC';
  });

  const isRTL = language === 'EGYPTIAN_ARABIC';

  useEffect(() => {
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', isRTL ? 'ar-EG' : 'en-US');
    localStorage.setItem('mc-lang', language);
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return { language: 'ENGLISH' as Language, setLanguage: () => {}, isRTL: false };
  }
  return context;
}
