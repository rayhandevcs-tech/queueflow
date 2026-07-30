"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Language } from "./types";
import { getStoredLanguage, setStoredLanguage } from "./storage";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("bn");

  useEffect(() => {
    // One-time hydration-safe sync from localStorage: SSR/first paint always renders
    // the "bn" default, then this reads the real stored preference client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguageState(getStoredLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setStoredLanguage(lang);
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
