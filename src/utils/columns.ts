import { Board } from '@/types';

/** Ids of every card on this board that has been ticked off as completed. */
export function getDoneCardIds(board: Board): Set<string> {
  const ids = new Set<string>();
  for (const [id, card] of Object.entries(board.cards)) {
    if (card.completedAt) ids.add(id);
  }
  return ids;
}
