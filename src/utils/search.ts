import { Card } from '@/types';

/** True when the card matches the search box text: title, description, labels or checklist items. */
export function cardMatchesSearch(card: Card, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    card.title.toLowerCase().includes(q) ||
    (card.description || '').toLowerCase().includes(q) ||
    card.labels.some((l) => l.name.toLowerCase().includes(q)) ||
    card.checklist.some((item) => item.text.toLowerCase().includes(q))
  );
}

/** The quick-filter chips above the board. Active chips are combined with AND. */
export interface CardFilters {
  mine: boolean;
  overdue: boolean;
  dueSoon: boolean;
  highPriority: boolean;
}

export const NO_FILTERS: CardFilters = { mine: false, overdue: false, dueSoon: false, highPriority: false };

export function hasActiveFilters(filters: CardFilters): boolean {
  return filters.mine || filters.overdue || filters.dueSoon || filters.highPriority;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function cardMatchesFilters(
  card: Card,
  filters: CardFilters,
  ctx: { userId?: string | null; doneCardIds: Set<string> }
): boolean {
  if (filters.mine && !(ctx.userId && card.assigneeIds.includes(ctx.userId))) return false;
  if (filters.highPriority && card.priority !== 'urgent' && card.priority !== 'high') return false;

  if (filters.overdue || filters.dueSoon) {
    // Finished cards are neither overdue nor due
    if (!card.dueDate || ctx.doneCardIds.has(card.id)) return false;
    const due = new Date(card.dueDate).getTime();
    const now = Date.now();
    const isOverdue = due < now;
    const isDueSoon = due >= now && due - now <= WEEK_MS;
    // With both chips on, show cards that are either overdue or due this week
    if (filters.overdue && filters.dueSoon) return isOverdue || isDueSoon;
    if (filters.overdue) return isOverdue;
    return isDueSoon;
  }
  return true;
}
