'use client';
import { useEffect, useState } from 'react';
import styles from './UndoRedoToast.module.css';

interface Props {
  message: string | null;
  kind?: 'info' | 'error';
  /** Optional button inside the toast, e.g. "Undo" */
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}

export default function UndoRedoToast({ message, kind = 'info', action, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, action ? 6000 : kind === 'error' ? 5000 : 2500);
      return () => clearTimeout(t);
    }
  }, [message, kind, action, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`${styles.toast} ${kind === 'error' ? styles.error : ''} ${action ? styles.withAction : ''} ${visible ? styles.show : styles.hide}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {kind === 'error' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v5M12 16.5v.01"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M9 14L4 9l5-5"/>
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
        </svg>
      )}
      {message}
      {action && (
        <button className={styles.actionBtn} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
