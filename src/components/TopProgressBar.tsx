'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
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

  const cleanup = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (doneTimeoutRef.current) {
      clearTimeout(doneTimeoutRef.current);
      doneTimeoutRef.current = null;
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
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin) && !anchor.target) {
        start();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [start]);

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
