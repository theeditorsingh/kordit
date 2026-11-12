'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import styles from './TopProgressBar.module.css';

let globalStart: (() => void) | null = null;
let globalDone: (() => void) | null = null;

export function startProgress() {
  globalStart?.();
}

export function doneProgress() {
  globalDone?.();
}

export default function TopProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const cleanup = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (doneTimeoutRef.current) {
      clearTimeout(doneTimeoutRef.current);
      doneTimeoutRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cleanup();
    setProgress(0);
    setVisible(true);

    let current = 0;
    trickleRef.current = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current > 90) current = 90;
      setProgress(current);
    }, 300);
    // Never leave the bar hanging if a navigation is cancelled or fails
    safetyRef.current = setTimeout(() => globalDone?.(), 8000);
  }, [cleanup]);

  const done = useCallback(() => {
    cleanup();
    setProgress(100);
    doneTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
  }, [cleanup]);

  useEffect(() => {
    globalStart = start;
    globalDone = done;
    return () => {
      globalStart = null;
      globalDone = null;
      cleanup();
    };
  }, [start, done, cleanup]);

  // Listen for route changes via Next.js navigation events
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor || !anchor.href || anchor.target || anchor.hasAttribute('download')) return;
      // New-tab clicks don't navigate this page
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or only ?query/#hash changes): no page load, so nothing would finish the bar
      if (url.pathname === window.location.pathname) return;
      start();
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [start]);

  // Finish when the route changes (every page, not only the board page)
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    if (!trickleRef.current) return; // nothing in progress
    const t = setTimeout(done, 0);
    return () => clearTimeout(t);
  }, [pathname, done]);

  // Auto-complete on page load
  useEffect(() => {
    if (visible) {
      done();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div className={styles.barContainer} aria-hidden="true">
      <div
        className={styles.bar}
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
      <div className={styles.glow} style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }} />
    </div>
  );
}
