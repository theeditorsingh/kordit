import { Card, ColumnSettings, ColumnSort, Priority } from '@/types';

export const SORT_OPTIONS: { value: ColumnSort; label: string; note: string }[] = [
  { value: 'manual', label: 'Manual (drag to arrange)', note: '' },
  { value: 'dueDate', label: 'Due date, soonest first', note: 'Sorted by due date' },
  { value: 'priority', label: 'Priority, highest first', note: 'Sorted by priority' },
  { value: 'newest', label: 'Newest first', note: 'Sorted by newest' },
];

const SORTS: ColumnSort[] = ['manual', 'dueDate', 'priority', 'newest'];
const PRIORITIES: Priority[] = ['none', 'urgent', 'high', 'medium', 'low'];
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Keeps only known settings with valid values. Used on the server before saving and when loading. */
export function sanitizeColumnSettings(input: unknown): ColumnSettings {
  const out: ColumnSettings = {};
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;

  if (typeof raw.sortBy === 'string' && SORTS.includes(raw.sortBy as ColumnSort) && raw.sortBy !== 'manual') {
    out.sortBy = raw.sortBy as ColumnSort;
  }
  if (typeof raw.defaultPriority === 'string' && PRIORITIES.includes(raw.defaultPriority as Priority) && raw.defaultPriority !== 'none') {
    out.defaultPriority = raw.defaultPriority as Priority;
  }
  const label = raw.defaultLabel as Record<string, unknown> | null | undefined;
  if (label && typeof label === 'object' && typeof label.name === 'string' && typeof label.color === 'string') {
    const name = label.name.trim().slice(0, 50);
    if (name && HEX.test(label.color)) {
      out.defaultLabel = { id: typeof label.id === 'string' ? label.id.slice(0, 64) : name, name, color: label.color };
    }
  }
  if (raw.autoComplete === true) out.autoComplete = true;
  return out;
}

/** Cards in the order the column is set to show them. Manual keeps the given (dragged) order. */
export function sortCards(cards: Card[], sortBy: ColumnSort | undefined): Card[] {
  if (!sortBy || sortBy === 'manual') return cards;
  const sorted = [...cards];
  if (sortBy === 'dueDate') {
    // Cards without a due date go last
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });
  } else if (sortBy === 'priority') {
    sorted.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));
  } else if (sortBy === 'newest') {
    sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }
  return sorted;
}
