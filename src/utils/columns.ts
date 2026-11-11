import { Board, Column } from '@/types';

const DONE_TITLES = new Set(['done', 'completed', 'complete', 'finished', 'closed']);

/**
 * A column counts as the "done" column when it is named Done / Completed /
 * Complete / Finished / Closed (any capitalisation). Cards in it are treated as
 * finished: no overdue styling and no reminders.
 */
export function isDoneColumn(column: Pick<Column, 'title'>): boolean {
  return DONE_TITLES.has(column.title.trim().toLowerCase());
}

/** Ids of every card sitting in a done column of this board. */
export function getDoneCardIds(board: Board): Set<string> {
  const ids = new Set<string>();
  for (const col of board.columns) {
    if (isDoneColumn(col)) col.cardIds.forEach((id) => ids.add(id));
  }
  return ids;
}
