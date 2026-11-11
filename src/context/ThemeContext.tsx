'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '@/types';

export type Appearance = 'kordit' | 'classic' | 'material';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [appearance, setAppearanceState] = useState<Appearance>('kordit');

  useEffect(() => {
    const saved = localStorage.getItem('kordit_theme') as Theme | null;
    // No saved choice yet: follow the system setting
    const initial: Theme = saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    const storedAppearance = localStorage.getItem('kordit_appearance');
    const nextAppearance: Appearance = storedAppearance === 'classic' || storedAppearance === 'material' ? storedAppearance : 'kordit';
    setAppearanceState(nextAppearance);
    document.documentElement.setAttribute('data-appearance', nextAppearance);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('kordit_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }

  function setAppearance(next: Appearance) {
    setAppearanceState(next);
    localStorage.setItem('kordit_appearance', next);
    document.documentElement.setAttribute('data-appearance', next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
