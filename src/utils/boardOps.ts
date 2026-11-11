import { Board, Card, Column } from '@/types';

/**
 * A small, serialisable description of a change to one board.
 * Undo/redo works by diffing the board before and after an action into these
 * operations, then applying them both to the local state and on the server.
 * Only what the action touched is changed, so a collaborator's edits elsewhere
 * on the board survive an undo.
 */
export type BoardOp =
  | { type: 'upsertColumn'; column: Omit<Column, 'cardIds'>; index: number }
  | { type: 'upsertCard'; card: Card; columnId: string }
  | { type: 'deleteCard'; cardId: string }
  | { type: 'deleteColumn'; columnId: string }
  | { type: 'setCardOrder'; columnId: string; cardIds: string[] }
  | { type: 'setColumnOrder'; columnIds: string[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function columnMeta(col: Column): Omit<Column, 'cardIds'> {
  return { id: col.id, title: col.title, color: col.color, icon: col.icon ?? '', wipLimit: col.wipLimit ?? 0 };
}

/** Operations that turn `from` into `to` (columns and cards only). */
export function diffBoards(from: Board, to: Board): BoardOp[] {
  const ops: BoardOp[] = [];
  const fromCols = new Map(from.columns.map((c) => [c.id, c]));
  const toColIds = new Set(to.columns.map((c) => c.id));

  to.columns.forEach((col, index) => {
    const prev = fromCols.get(col.id);
    if (!prev || !same(columnMeta(prev), columnMeta(col))) {
      ops.push({ type: 'upsertColumn', column: columnMeta(col), index });
    }
  });

  const columnOfCard = new Map<string, string>();
  to.columns.forEach((col) => col.cardIds.forEach((id) => columnOfCard.set(id, col.id)));
  for (const [cardId, card] of Object.entries(to.cards)) {
    const columnId = columnOfCard.get(cardId);
    if (!columnId) continue;
    if (!from.cards[cardId] || !same(from.cards[cardId], card)) {
      ops.push({ type: 'upsertCard', card, columnId });
    }
  }

  for (const cardId of Object.keys(from.cards)) {
    if (!to.cards[cardId]) ops.push({ type: 'deleteCard', cardId });
  }
  for (const col of from.columns) {
    if (!toColIds.has(col.id)) ops.push({ type: 'deleteColumn', columnId: col.id });
  }

  for (const col of to.columns) {
    const prev = fromCols.get(col.id);
    if (!prev || !same(prev.cardIds, col.cardIds)) {
      ops.push({ type: 'setCardOrder', columnId: col.id, cardIds: col.cardIds });
    }
  }

  const fromOrder = from.columns.map((c) => c.id);
  const toOrder = to.columns.map((c) => c.id);
  if (!same(fromOrder, toOrder)) ops.push({ type: 'setColumnOrder', columnIds: toOrder });

  return ops;
}

/** Apply operations to a board. The board may have moved on since the ops were computed. */
export function applyOps(board: Board, ops: BoardOp[]): Board {
  let columns = board.columns.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
  const cards: Record<string, Card> = { ...board.cards };

  for (const op of ops) {
    switch (op.type) {
      case 'upsertColumn': {
        const existing = columns.find((c) => c.id === op.column.id);
        if (existing) Object.assign(existing, op.column);
        else columns.splice(Math.min(op.index, columns.length), 0, { ...op.column, cardIds: [] });
        break;
      }
      case 'upsertCard': {
        cards[op.card.id] = op.card;
        if (!columns.some((c) => c.cardIds.includes(op.card.id))) {
          columns.find((c) => c.id === op.columnId)?.cardIds.push(op.card.id);
        }
        break;
      }
      case 'deleteCard': {
        delete cards[op.cardId];
        columns.forEach((c) => { c.cardIds = c.cardIds.filter((id) => id !== op.cardId); });
        break;
      }
      case 'deleteColumn': {
        const col = columns.find((c) => c.id === op.columnId);
        col?.cardIds.forEach((id) => delete cards[id]);
        columns = columns.filter((c) => c.id !== op.columnId);
        break;
      }
      case 'setCardOrder': {
        const target = columns.find((c) => c.id === op.columnId);
        if (!target) break;
        const wanted = op.cardIds.filter((id) => cards[id]);
        const wantedSet = new Set(wanted);
        columns.forEach((c) => {
          if (c.id !== op.columnId) c.cardIds = c.cardIds.filter((id) => !wantedSet.has(id));
        });
        // Cards that arrived in this column since (e.g. from a collaborator) stay at the end
        const leftovers = target.cardIds.filter((id) => !wantedSet.has(id));
        target.cardIds = [...wanted, ...leftovers];
        break;
      }
      case 'setColumnOrder': {
        const rank = new Map(op.columnIds.map((id, i) => [id, i]));
        columns = [...columns].sort(
          (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        );
        break;
      }
    }
  }

  return { ...board, columns, cards };
}

/** Replace a temporary card id with the real one everywhere in a board snapshot. */
export function remapCardId(board: Board, oldId: string, newId: string): Board {
  if (!board.cards[oldId]) return board;
  const cards = { ...board.cards };
  cards[newId] = { ...cards[oldId], id: newId };
  delete cards[oldId];
  return {
    ...board,
    cards,
    columns: board.columns.map((c) =>
      c.cardIds.includes(oldId) ? { ...c, cardIds: c.cardIds.map((id) => (id === oldId ? newId : id)) } : c
    ),
  };
}

/** Replace a temporary column id with the real one in a board snapshot. */
export function remapColumnId(board: Board, oldId: string, newId: string): Board {
  if (!board.columns.some((c) => c.id === oldId)) return board;
  return { ...board, columns: board.columns.map((c) => (c.id === oldId ? { ...c, id: newId } : c)) };
}
