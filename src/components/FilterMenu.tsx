'use client';
import { useEffect } from 'react';
import { AlertCircle, CalendarClock, Check, Flame, User } from 'lucide-react';
import { CardFilters, NO_FILTERS, hasActiveFilters } from '@/utils/search';
import styles from './FilterMenu.module.css';

interface Props {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  /** Cards shown after search + filters, and the total on the board */
  shown: number;
  total: number;
  /** Where the Filter button is; the menu opens under it on desktop */
  anchorRect?: DOMRect | null;
  onClose: () => void;
}

const OPTIONS: { key: keyof CardFilters; label: string; icon: React.ReactNode }[] = [
  { key: 'mine', label: 'Assigned to me', icon: <User size={14} /> },
  { key: 'overdue', label: 'Overdue', icon: <AlertCircle size={14} /> },
  { key: 'dueSoon', label: 'Due this week', icon: <CalendarClock size={14} /> },
  { key: 'highPriority', label: 'High priority', icon: <Flame size={14} /> },
];

const MENU_WIDTH = 230;

export default function FilterMenu({ filters, onChange, shown, total, anchorRect, onClose }: Props) {
  const active = hasActiveFilters(filters);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Desktop: directly under the Filter button. Phones: the stylesheet makes it a bottom sheet.
  const anchored = !!anchorRect && anchorRect.width > 0 && typeof window !== 'undefined' && window.innerWidth > 768;
  const position: React.CSSProperties = anchored
    ? {
        top: anchorRect.bottom + 8,
        left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - MENU_WIDTH - 8)),
        right: 'auto',
      }
    : {};

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.menu} role="menu" aria-label="Filter cards" style={position}>
        <div className={styles.heading}>Show only</div>
        {OPTIONS.map((opt) => {
          const on = filters[opt.key];
          return (
            <button
              key={opt.key}
              role="menuitemcheckbox"
              aria-checked={on}
              className={`${styles.item} ${on ? styles.itemActive : ''}`}
              onClick={() => onChange({ ...filters, [opt.key]: !on })}
            >
              <span className={styles.itemIcon}>{opt.icon}</span>
              <span className={styles.itemLabel}>{opt.label}</span>
              {on && <Check size={14} />}
            </button>
          );
        })}
        <div className={styles.footer}>
          <span className={styles.count} aria-live="polite">
            {active ? `${shown} of ${total} card${total === 1 ? '' : 's'}` : `${total} card${total === 1 ? '' : 's'}`}
          </span>
          <button className={styles.clear} onClick={() => onChange(NO_FILTERS)} disabled={!active}>
            Clear
          </button>
        </div>
      </div>
    </>
  );
}
