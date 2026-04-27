'use client';
import { useEffect, useState } from 'react';
import styles from './UndoRedoToast.module.css';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export default function UndoRedoToast({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`${styles.toast} ${visible ? styles.show : styles.hide}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M9 14L4 9l5-5"/>
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
      </svg>
      {message}
    </div>
  );
}
