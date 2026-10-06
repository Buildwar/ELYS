import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type CyberTheme = 'cyan' | 'emerald' | 'amber' | 'magenta' | 'violet';

interface ThemeContextType {
  theme: CyberTheme;
  setTheme: (theme: CyberTheme) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [theme, setThemeState] = useState<CyberTheme>(() => {
    return (localStorage.getItem('elys_theme') as CyberTheme) || 'cyan';
  });
  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('elys_lang') || 'es';
  });

  const setTheme = (newTheme: CyberTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('elys_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const setLanguage = (newLang: string) => {
    setLanguageState(newLang);
    localStorage.setItem('elys_lang', newLang);
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
