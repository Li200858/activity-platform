import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { zh, en } from '../i18n/translations';

const STORAGE_KEY = 'activity_platform_lang';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (e) {}
    return 'zh';
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
  }, []);

  const dict = useMemo(() => (lang === 'en' ? en : zh), [lang]);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let v = dict;
    for (const k of keys) {
      v = v?.[k];
      if (v == null) return key;
    }
    return typeof v === 'string' ? v : key;
  }, [dict]);

  const value = useMemo(() => ({ lang, setLang, t, isEn: lang === 'en' }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
