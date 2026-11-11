'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Theme } from '@/types';

export type Appearance = 'kordit' | 'classic' | 'material';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function isAppearance(value: unknown): value is Appearance {
  return value === 'kordit' || value === 'classic' || value === 'material';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [theme, setTheme] = useState<Theme>('light');
  const [appearance, setAppearanceState] = useState<Appearance>('kordit');
  const themeRef = useRef<Theme>('light');
  const appearanceRef = useRef<Appearance>('kordit');
  const interactedRef = useRef(false);

  const applyPreference = useCallback((nextTheme: Theme, nextAppearance: Appearance) => {
    themeRef.current = nextTheme;
    appearanceRef.current = nextAppearance;
    setTheme(nextTheme);
    setAppearanceState(nextAppearance);
    localStorage.setItem('kordit_theme', nextTheme);
    localStorage.setItem('kordit_appearance', nextAppearance);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.setAttribute('data-appearance', nextAppearance);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const savedTheme = localStorage.getItem('kordit_theme');
      const localTheme: Theme = isTheme(savedTheme)
        ? savedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const savedAppearance = localStorage.getItem('kordit_appearance');
      const localAppearance: Appearance = isAppearance(savedAppearance) ? savedAppearance : 'kordit';
      applyPreference(localTheme, localAppearance);

      if (status !== 'authenticated') return;

      try {
        const response = await fetch('/api/ui-preferences', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { preference?: { theme?: unknown; appearance?: unknown } | null };
        const serverPreference = data.preference;

        if (serverPreference && isTheme(serverPreference.theme) && isAppearance(serverPreference.appearance)) {
          if (!interactedRef.current) applyPreference(serverPreference.theme, serverPreference.appearance);
          return;
        }

        await fetch('/api/ui-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: themeRef.current, appearance: appearanceRef.current }),
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') console.warn('UI preferences will remain local until sync is available.');
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [applyPreference, status]);

  const persistPreference = useCallback((nextTheme: Theme, nextAppearance: Appearance) => {
    if (status !== 'authenticated') return;
    void fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: nextTheme, appearance: nextAppearance }),
    }).catch(() => console.warn('UI preferences will remain local until sync is available.'));
  }, [status]);

  function toggleTheme() {
    interactedRef.current = true;
    const next = themeRef.current === 'dark' ? 'light' : 'dark';
    applyPreference(next, appearanceRef.current);
    persistPreference(next, appearanceRef.current);
  }

  function setAppearance(next: Appearance) {
    interactedRef.current = true;
    applyPreference(themeRef.current, next);
    persistPreference(themeRef.current, next);
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
