'use client';
import { AlertCircle, CalendarClock, Flame, User, X } from 'lucide-react';
import { CardFilters, NO_FILTERS, hasActiveFilters } from '@/utils/search';
import styles from './FilterBar.module.css';

interface Props {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  /** Cards shown after search + filters, and the total on the board */
  shown: number;
  total: number;
}

const CHIPS: { key: keyof CardFilters; label: string; icon: React.ReactNode }[] = [
  { key: 'mine', label: 'Assigned to me', icon: <User size={12} /> },
  { key: 'overdue', label: 'Overdue', icon: <AlertCircle size={12} /> },
  { key: 'dueSoon', label: 'Due this week', icon: <CalendarClock size={12} /> },
  { key: 'highPriority', label: 'High priority', icon: <Flame size={12} /> },
];

export default function FilterBar({ filters, onChange, shown, total }: Props) {
  const active = hasActiveFilters(filters);

  return (
    <div className={styles.bar} role="group" aria-label="Quick filters">
      {CHIPS.map((chip) => (
        <button
          key={chip.key}
          className={`${styles.chip} ${filters[chip.key] ? styles.chipActive : ''}`}
          aria-pressed={filters[chip.key]}
          onClick={() => onChange({ ...filters, [chip.key]: !filters[chip.key] })}
        >
          {chip.icon}
          {chip.label}
        </button>
      ))}
      {active && (
        <>
          <button className={styles.clear} onClick={() => onChange(NO_FILTERS)}>
            <X size={12} /> Clear
          </button>
          <span className={styles.count} aria-live="polite">
            {shown} of {total} card{total === 1 ? '' : 's'}
          </span>
        </>
      )}
    </div>
  );
}
