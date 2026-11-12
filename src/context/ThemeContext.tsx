'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Theme } from '@/types';


interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [theme, setTheme] = useState<Theme>('light');
  const themeRef = useRef<Theme>('light');
  const interactedRef = useRef(false);

  const applyPreference = useCallback((nextTheme: Theme) => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    localStorage.setItem('kordit_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const savedTheme = localStorage.getItem('kordit_theme');
      const localTheme: Theme = isTheme(savedTheme)
        ? savedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      // Appearance presets were removed; clear the old saved choice
      localStorage.removeItem('kordit_appearance');
      applyPreference(localTheme);

      if (status !== 'authenticated') return;

      try {
        const response = await fetch('/api/ui-preferences', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { preference?: { theme?: unknown } | null };
        const serverPreference = data.preference;

        if (serverPreference && isTheme(serverPreference.theme)) {
          if (!interactedRef.current) applyPreference(serverPreference.theme);
          return;
        }

        await fetch('/api/ui-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: themeRef.current }),
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

  const persistPreference = useCallback((nextTheme: Theme) => {
    if (status !== 'authenticated') return;
    void fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: nextTheme }),
    }).catch(() => console.warn('UI preferences will remain local until sync is available.'));
  }, [status]);

  function toggleTheme() {
    interactedRef.current = true;
    const next = themeRef.current === 'dark' ? 'light' : 'dark';
    applyPreference(next);
    persistPreference(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
