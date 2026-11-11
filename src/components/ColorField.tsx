'use client';
import { useState } from 'react';
import { isHexColor } from '@/utils/boardBackground';
import styles from './ColorField.module.css';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/** A native colour picker paired with a hex text box */
export default function ColorField({ label, value, onChange }: Props) {
  // While typing, show what was typed (it may not be a full hex yet); otherwise show the value
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;

  return (
    <label className={styles.colorField}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorInput}
          value={isHexColor(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} colour picker`}
        />
        <input
          className={`input ${styles.hexInput}`}
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} hex code`}
          aria-invalid={!isHexColor(text)}
          onChange={(e) => {
            let next = e.target.value.trim();
            if (next && !next.startsWith('#')) next = `#${next}`;
            setDraft(next);
            if (isHexColor(next)) onChange(next.toUpperCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </span>
    </label>
  );
}
