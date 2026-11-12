'use client';
/**
 * Dropdown menu used by the header's board (⋯) and account menus, so both look and
 * behave the same: Escape and outside click close it, arrow keys move between items.
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './HeaderMenu.module.css';

interface MenuProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export function HeaderMenu({ label, onClose, children }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled), [role="menuitemradio"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length - 1 : at - 1);
    items[next].focus();
  }

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div ref={ref} className={styles.menu} role="menu" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
        {children}
      </div>
    </>
  );
}

export function HeaderMenuLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}

export function HeaderMenuDivider() {
  return <div className={styles.divider} role="separator" />;
}

interface ItemProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  id?: string;
  onSelect: () => void;
}

export function HeaderMenuItem({ icon, label, hint, danger, disabled, id, onSelect }: ItemProps) {
  return (
    <button type="button" role="menuitem" id={id} disabled={disabled} className={`${styles.item} ${danger ? styles.danger : ''}`} onClick={onSelect}>
      {icon}
      <span className={styles.itemLabel}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </button>
  );
}

/** Name, email and avatar at the top of the account menu */
export function HeaderMenuUser({ name, email, avatar }: { name: string; email?: string | null; avatar: ReactNode }) {
  return (
    <div className={styles.user}>
      {avatar}
      <div className={styles.userText}>
        <div className={styles.userName}>{name}</div>
        {email && <div className={styles.userEmail}>{email}</div>}
      </div>
    </div>
  );
}

/** A row with a two-way switch, e.g. Theme: Light | Dark */
export function HeaderMenuSwitch<T extends string>({ icon, label, value, options, onChange }: {
  icon: ReactNode; label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return (
    <div className={styles.switchRow} role="group" aria-label={label}>
      {icon}
      <span className={styles.itemLabel}>{label}</span>
      <span className={styles.segment}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="menuitemradio"
            aria-checked={value === o.value}
            className={`${styles.segmentBtn} ${value === o.value ? styles.segmentOn : ''}`}
            onClick={() => { if (value !== o.value) onChange(o.value); }}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}
