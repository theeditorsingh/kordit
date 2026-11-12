import type { Board, Card, Column } from '@/types';

export interface AssignedCard {
  card: Card;
  board: Board;
  column: Column;
}

export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const DUE_GROUPS: { id: DueGroup; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'later', label: 'Later' },
  { id: 'none', label: 'No due date' },
];

/** Open (not completed) cards assigned to `userId` across all boards, in board/column order. */
export function getAssignedOpenCards(boards: Board[], userId: string | null | undefined): AssignedCard[] {
  if (!userId) return [];
  const out: AssignedCard[] = [];
  for (const board of boards) {
    if (board.isArchived) continue;
    for (const column of board.columns) {
      for (const id of column.cardIds) {
        const card = board.cards[id];
        if (card && !card.completedAt && card.assigneeIds.includes(userId)) out.push({ card, board, column });
      }
    }
  }
  return out;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Which due group a date falls in, relative to `now` (local calendar days). */
export function dueGroupOf(dueDate: string | null, now: Date = new Date()): DueGroup {
  if (!dueDate) return 'none';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'none';
  const today = startOfDay(now);
  const day = startOfDay(due);
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  // Overdue: an earlier day, or today at a time that has passed (when a time was set)
  const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
  if (days < 0 || (days === 0 && hasTime && due.getTime() < now.getTime())) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

/** Cards bucketed by due group; each bucket sorted by due date (undated keep board order). */
export function groupByDue(items: AssignedCard[], now: Date = new Date()): Record<DueGroup, AssignedCard[]> {
  const groups: Record<DueGroup, AssignedCard[]> = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const item of items) groups[dueGroupOf(item.card.dueDate, now)].push(item);
  for (const id of ['overdue', 'today', 'week', 'later'] as const) {
    groups[id].sort((a, b) => new Date(a.card.dueDate!).getTime() - new Date(b.card.dueDate!).getTime());
  }
  return groups;
}

/** Board URL, opening a card when `cardId` is given (Card.tsx opens `?card=`). */
export function boardHref(board: Pick<Board, 'slug' | 'ownerUsername'>, fallbackUsername?: string | null, cardId?: string) {
  const owner = board.ownerUsername || fallbackUsername;
  if (!owner) return null;
  return `/${owner}/${board.slug}${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}`;
}
