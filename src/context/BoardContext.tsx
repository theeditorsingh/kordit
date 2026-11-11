'use client';
import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useState } from 'react';
import { AppState, Board, Card, Column, Member } from '@/types';
import {
  createBoardAction, createCardAction, createColumnAction, moveCardAction,
  deleteCardAction, bulkDeleteCardsAction, bulkMoveCardsAction, bulkCopyCardsAction,
  deleteBoardAction, inviteMemberAction, removeMemberAction, updateCardAction, moveColumnAction,
  updateColumnAction, deleteColumnAction, updateBoardAction, toggleBoardFavoriteAction,
  archiveBoardAction, saveBoardAsTemplateAction, applyBoardOpsAction
} from '@/actions/boardActions';
import { applyOps, diffBoards, remapCardId, remapColumnId } from '@/utils/boardOps';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import UndoRedoToast from '@/components/UndoRedoToast';
import { getMemberColor } from '@/utils/storage';

// Small stable hash so each member keeps the same avatar colour everywhere
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const UNDO_STACK_MAX = 30;

// Actions that should be tracked for undo/redo
const UNDOABLE_ACTIONS = new Set([
  'ADD_CARD', 'DELETE_CARD', 'MOVE_CARD', 'UPDATE_CARD',
  'ADD_COLUMN', 'DELETE_COLUMN', 'MOVE_COLUMN',
  'BULK_DELETE', 'BULK_MOVE',
]);

type Action =
  | { type: 'SET_ACTIVE_BOARD'; boardId: string }
  | { type: 'ADD_BOARD'; board: Board }
  | { type: 'UPDATE_BOARD_TITLE'; boardId: string; title: string }
  | { type: 'UPDATE_BOARD'; boardId: string; updates: Partial<Board> }
  | { type: 'DELETE_BOARD'; boardId: string }
  | { type: 'ADD_COLUMN'; boardId: string; column: Column }
  | { type: 'UPDATE_COLUMN_TITLE'; boardId: string; columnId: string; title: string }
  | { type: 'UPDATE_COLUMN'; boardId: string; columnId: string; updates: Partial<Column> }
  | { type: 'DELETE_COLUMN'; boardId: string; columnId: string }
  | { type: 'MOVE_COLUMN'; boardId: string; sourceIndex: number; destIndex: number }
  | { type: 'ADD_CARD'; boardId: string; columnId: string; card: Card }
  | { type: 'UPDATE_CARD'; boardId: string; card: Card }
  | { type: 'DELETE_CARD'; boardId: string; columnId: string; cardId: string }
  | { type: 'MOVE_CARD'; boardId: string; sourceColId: string; destColId: string; sourceIndex: number; destIndex: number; completedAt?: string }
  | { type: 'ADD_MEMBER'; boardId: string; member: Member }
  | { type: 'REMOVE_MEMBER'; boardId: string; memberId: string }
  | { type: 'UPDATE_BOARD_VISIBILITY'; boardId: string; visibility: 'Private' | 'Workspace' | 'Public' }
  | { type: 'UPDATE_MEMBER_ROLE'; boardId: string; memberId: string; role: 'Admin' | 'Member' }
  | { type: 'TOGGLE_CARD_SELECTION'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BULK_DELETE'; boardId: string; cardIds: string[] }
  | { type: 'BULK_MOVE'; boardId: string; cardIds: string[]; targetColId: string; completedAt?: string }
  | { type: 'BULK_COPY'; boardId: string; newCards: Card[]; targetColId: string }
  | { type: 'TOGGLE_FAVORITE'; boardId: string }
  | { type: 'ARCHIVE_BOARD'; boardId: string }
  | { type: 'SYNC_BOARDS'; boards: Board[] }
  | { type: 'REPLACE_CARD_ID'; boardId: string; columnId: string; oldId: string; newCard: Card }
  | { type: 'REPLACE_COLUMN_ID'; boardId: string; oldId: string; newId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// One undoable step: the affected board just before and just after the action.
// Undo applies the difference after→before on top of the *current* board, so
// changes made since (including by collaborators) are kept.
interface HistoryEntry {
  boardId: string;
  before: Board;
  after: Board;
}

// Extended state shape including undo/redo stacks
interface FullState {
  present: AppState;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

function applyEntry(present: AppState, entry: HistoryEntry, direction: 'undo' | 'redo'): AppState {
  const ops = direction === 'undo' ? diffBoards(entry.after, entry.before) : diffBoards(entry.before, entry.after);
  return {
    ...present,
    selectedCardIds: [],
    boards: present.boards.map((b) => (b.id === entry.boardId ? applyOps(b, ops) : b)),
  };
}

// Pure reducer for AppState (no undo stacks)
function boardReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_BOARD':
      return { ...state, activeBoardId: action.boardId };

    case 'ADD_BOARD':
      return { ...state, boards: [...state.boards, action.board], activeBoardId: action.board.id };

    case 'UPDATE_BOARD_TITLE':
      return {
        ...state,
        boards: state.boards.map((b) => b.id === action.boardId ? { ...b, title: action.title } : b),
      };

    case 'UPDATE_BOARD':
      return {
        ...state,
        boards: state.boards.map((b) => b.id === action.boardId ? { ...b, ...action.updates } : b),
      };

    case 'UPDATE_BOARD_VISIBILITY':
      return {
        ...state,
        boards: state.boards.map((b) => b.id === action.boardId ? { ...b, visibility: action.visibility } : b),
      };

    case 'DELETE_BOARD': {
      const boards = state.boards.filter((b) => b.id !== action.boardId);
      const activeBoardId = state.activeBoardId === action.boardId ? (boards[0]?.id ?? null) : state.activeBoardId;
      return { ...state, boards, activeBoardId };
    }

    case 'ADD_COLUMN':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId ? { ...b, columns: [...b.columns, action.column] } : b
        ),
      };

    case 'UPDATE_COLUMN_TITLE':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId
            ? { ...b, columns: b.columns.map((c) => c.id === action.columnId ? { ...c, title: action.title } : c) }
            : b
        ),
      };

    case 'UPDATE_COLUMN':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId
            ? { ...b, columns: b.columns.map((c) => c.id === action.columnId ? { ...c, ...action.updates } : c) }
            : b
        ),
      };

    case 'DELETE_COLUMN':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const col = b.columns.find((c) => c.id === action.columnId);
          if (!col) return b;
          const newCards = { ...b.cards };
          col.cardIds.forEach((id) => delete newCards[id]);
          return { ...b, columns: b.columns.filter((c) => c.id !== action.columnId), cards: newCards };
        }),
      };

    case 'MOVE_COLUMN':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const cols = [...b.columns];
          const [removed] = cols.splice(action.sourceIndex, 1);
          cols.splice(action.destIndex, 0, removed);
          return { ...b, columns: cols };
        }),
      };

    case 'ADD_CARD':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          return {
            ...b,
            columns: b.columns.map((c) =>
              c.id === action.columnId ? { ...c, cardIds: [...c.cardIds, action.card.id] } : c
            ),
            cards: { ...b.cards, [action.card.id]: action.card },
          };
        }),
      };

    case 'REPLACE_CARD_ID':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const newCards = { ...b.cards };
          delete newCards[action.oldId];
          newCards[action.newCard.id] = action.newCard;
          return {
            ...b,
            columns: b.columns.map((c) =>
              c.id === action.columnId 
                ? { ...c, cardIds: c.cardIds.map((id) => id === action.oldId ? action.newCard.id : id) }
                : c
            ),
            cards: newCards,
          };
        }),
      };

    case 'REPLACE_COLUMN_ID':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId
            ? { ...b, columns: b.columns.map((c) => c.id === action.oldId ? { ...c, id: action.newId } : c) }
            : b
        ),
      };

    case 'UPDATE_CARD':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId ? { ...b, cards: { ...b.cards, [action.card.id]: action.card } } : b
        ),
      };

    case 'DELETE_CARD':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const newCards = { ...b.cards };
          delete newCards[action.cardId];
          return {
            ...b,
            columns: b.columns.map((c) =>
              c.id === action.columnId ? { ...c, cardIds: c.cardIds.filter((id) => id !== action.cardId) } : c
            ),
            cards: newCards,
          };
        }),
      };

    case 'MOVE_CARD':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const cols = b.columns.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
          const srcCol = cols.find((c) => c.id === action.sourceColId)!;
          const dstCol = cols.find((c) => c.id === action.destColId)!;
          const [removed] = srcCol.cardIds.splice(action.sourceIndex, 1);
          dstCol.cardIds.splice(action.destIndex, 0, removed);
          // The destination column may mark arriving cards completed
          const moved = b.cards[removed];
          const cards = action.completedAt && moved && !moved.completedAt
            ? { ...b.cards, [removed]: { ...moved, completedAt: action.completedAt } }
            : b.cards;
          return { ...b, columns: cols, cards };
        }),
      };

    case 'ADD_MEMBER':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId ? { ...b, members: [...b.members, action.member] } : b
        ),
      };

    case 'REMOVE_MEMBER':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const members = b.members.filter((m) => m.id !== action.memberId);
          const cards = Object.fromEntries(
            Object.entries(b.cards).map(([id, card]) => [
              id,
              { ...card, assigneeIds: card.assigneeIds.filter((aid) => aid !== action.memberId) },
            ])
          );
          return { ...b, members, cards };
        }),
      };

    case 'UPDATE_MEMBER_ROLE':
      return {
        ...state,
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          return {
            ...b,
            members: b.members.map((m) => m.id === action.memberId ? { ...m, role: action.role } : m),
          };
        }),
      };

    case 'TOGGLE_CARD_SELECTION': {
      const selected = state.selectedCardIds.includes(action.cardId)
        ? state.selectedCardIds.filter((id) => id !== action.cardId)
        : [...state.selectedCardIds, action.cardId];
      return { ...state, selectedCardIds: selected };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedCardIds: [] };

    case 'BULK_DELETE':
      return {
        ...state,
        selectedCardIds: [],
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const newCards = { ...b.cards };
          action.cardIds.forEach((id) => delete newCards[id]);
          return {
            ...b,
            columns: b.columns.map((c) => ({
              ...c,
              cardIds: c.cardIds.filter((id) => !action.cardIds.includes(id)),
            })),
            cards: newCards,
          };
        }),
      };

    case 'BULK_MOVE':
      return {
        ...state,
        selectedCardIds: [],
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const target = b.columns.find((c) => c.id === action.targetColId);
          let cards = b.cards;
          if (action.completedAt) {
            cards = { ...b.cards };
            for (const id of action.cardIds) {
              const card = cards[id];
              if (card && !card.completedAt && !target?.cardIds.includes(id)) {
                cards[id] = { ...card, completedAt: action.completedAt };
              }
            }
          }
          return {
            ...b,
            cards,
            columns: b.columns.map((c) => {
              if (c.id === action.targetColId) {
                // Cards already in the target stay where they are
                return { ...c, cardIds: [...c.cardIds, ...action.cardIds.filter((id) => !c.cardIds.includes(id))] };
              } else {
                return { ...c, cardIds: c.cardIds.filter((id) => !action.cardIds.includes(id)) };
              }
            }),
          };
        }),
      };

    case 'BULK_COPY':
      return {
        ...state,
        selectedCardIds: [],
        boards: state.boards.map((b) => {
          if (b.id !== action.boardId) return b;
          const newCardsRecord = { ...b.cards };
          const newIds: string[] = [];
          action.newCards.forEach((c) => {
            newCardsRecord[c.id] = c;
            newIds.push(c.id);
          });
          return {
            ...b,
            cards: newCardsRecord,
            columns: b.columns.map((c) =>
              c.id === action.targetColId
                ? { ...c, cardIds: [...c.cardIds, ...newIds] }
                : c
            ),
          };
        }),
      };

    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId ? { ...b, isFavorite: !b.isFavorite } : b
        ),
      };

    case 'ARCHIVE_BOARD': {
      const boards = state.boards.filter((b) => b.id !== action.boardId);
      const activeBoardId = state.activeBoardId === action.boardId ? (boards[0]?.id ?? null) : state.activeBoardId;
      return { ...state, boards, activeBoardId };
    }

    case 'SYNC_BOARDS':
      return {
        ...state,
        boards: action.boards,
        activeBoardId: action.boards.find(b => b.id === state.activeBoardId)
          ? state.activeBoardId
          : action.boards[0]?.id ?? null,
      };

    default:
      return state;
  }
}

// Wrapper reducer that manages undo/redo stacks
function reducer(full: FullState, action: Action): FullState {
  if (action.type === 'UNDO') {
    const entry = full.past[full.past.length - 1];
    if (!entry) return full;
    return {
      present: applyEntry(full.present, entry, 'undo'),
      past: full.past.slice(0, -1),
      future: [entry, ...full.future].slice(0, UNDO_STACK_MAX),
    };
  }
  if (action.type === 'REDO') {
    const entry = full.future[0];
    if (!entry) return full;
    return {
      present: applyEntry(full.present, entry, 'redo'),
      past: [...full.past, entry].slice(-UNDO_STACK_MAX),
      future: full.future.slice(1),
    };
  }

  const nextPresent = boardReducer(full.present, action);

  // A temporary id was swapped for the real one: keep the history pointing at the real id
  if (action.type === 'REPLACE_CARD_ID' || action.type === 'REPLACE_COLUMN_ID') {
    const remap = (b: Board) =>
      action.type === 'REPLACE_CARD_ID'
        ? remapCardId(b, action.oldId, action.newCard.id)
        : remapColumnId(b, action.oldId, action.newId);
    const fix = (e: HistoryEntry): HistoryEntry =>
      e.boardId === action.boardId ? { ...e, before: remap(e.before), after: remap(e.after) } : e;
    return { present: nextPresent, past: full.past.map(fix), future: full.future.map(fix) };
  }

  if (UNDOABLE_ACTIONS.has(action.type) && 'boardId' in action) {
    const before = full.present.boards.find((b) => b.id === action.boardId);
    const after = nextPresent.boards.find((b) => b.id === action.boardId);
    if (before && after && before !== after) {
      return {
        present: nextPresent,
        past: [...full.past, { boardId: action.boardId, before, after }].slice(-UNDO_STACK_MAX),
        future: [],
      };
    }
  }
  return { ...full, present: nextPresent };
}

interface BoardContextType {
  state: AppState;
  activeBoard: Board | null;
  dispatch: React.Dispatch<Action>;
  createBoard: (title: string, customColumns?: { title: string, color: string }[]) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  createCard: (boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) => Promise<string>;
  createColumn: (boardId: string, title: string) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  moveCard: (boardId: string, cardId: string, sourceColId: string, destColId: string, sourceIndex: number, destIndex: number) => Promise<void>;
  deleteCard: (boardId: string, columnId: string, cardId: string) => Promise<void>;
  /** `patch` limits what is sent to the server to the fields that changed */
  updateCard: (boardId: string, card: Card, patch?: Partial<Card>) => Promise<void>;
  moveColumn: (boardId: string, sourceIndex: number, destIndex: number) => Promise<void>;
  updateColumn: (boardId: string, columnId: string, updates: Partial<Column>) => Promise<void>;
  updateBoard: (boardId: string, updates: Partial<Board>) => Promise<void>;
  toggleFavorite: (boardId: string) => Promise<void>;
  archiveBoard: (boardId: string) => Promise<void>;
  saveBoardAsTemplate: (boardId: string) => Promise<void>;
  addMember: (boardId: string, name: string, role?: 'Admin' | 'Member') => void;
  removeMember: (boardId: string, memberId: string) => void;
  setActiveBoardId: (id: string | null) => void;
  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  bulkDelete: (boardId: string, cardIds: string[]) => Promise<void>;
  bulkMove: (boardId: string, cardIds: string[], targetColId: string) => Promise<void>;
  bulkCopy: (boardId: string, cardIds: string[], targetColId: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Show a short error message at the bottom of the screen */
  notifyError: (message: string) => void;
}

const BoardContext = createContext<BoardContextType | null>(null);

function formatPrismaBoards(prismaBoards: any[]): Board[] {
  return prismaBoards.map(pb => {
    const cardsObj: Record<string, Card> = {};
    const columnCardIds: Record<string, string[]> = {};

    pb.columns.forEach((col: any) => {
      columnCardIds[col.id] = [];
    });

    pb.cards.forEach((card: any) => {
      cardsObj[card.id] = {
        id: card.id,
        title: card.title,
        description: card.description || '',
        priority: card.priority as any,
        dueDate: card.dueDate ? new Date(card.dueDate).toISOString() : null,
        labels: Array.isArray(card.labels) ? card.labels : [],
        checklist: Array.isArray(card.checklist) ? card.checklist : [],
        assigneeIds: Array.isArray(card.assigneeIds) ? card.assigneeIds : [],
        createdAt: new Date(card.createdAt).toISOString(),
        coverImage: card.coverImage || '',
        coverColor: card.coverColor || '',

        reminderAt: card.reminderAt ? new Date(card.reminderAt).toISOString() : null,
        completedAt: card.completedAt ? new Date(card.completedAt).toISOString() : null,
      };

      if (columnCardIds[card.columnId]) {
        columnCardIds[card.columnId].push(card.id);
      }
    });

    return {
      id: pb.id,
      title: pb.title,
      slug: pb.slug,
      color: pb.color,
      visibility: pb.visibility as any,
      ownerUsername: pb.owner?.username ?? null,
      background: pb.background || '',
      backgroundType: pb.backgroundType || 'color',
      labelColors: Array.isArray(pb.labelColors) ? pb.labelColors : [],
      isArchived: pb.isArchived || false,
      isFavorite: pb.isFavorite || false,
      columns: pb.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        color: col.color,
        icon: col.icon || '',
        wipLimit: col.wipLimit || 0,
        settings: col.settings && typeof col.settings === 'object' ? col.settings : {},
        cardIds: columnCardIds[col.id] || []
      })),
      cards: cardsObj,
      members: pb.members.map((m: any) => ({
        id: m.userId,
        name: m.user?.name || m.user?.username || 'Unknown',
        role: m.role as any,
        color: getMemberColor(hashId(String(m.userId))),
        status: 'joined' as const,
      })),
      createdAt: pb.createdAt ? new Date(pb.createdAt).toISOString() : new Date().toISOString()
    };
  });
}

export function BoardProvider({ children, initialBoards = [] }: { children: React.ReactNode, initialBoards?: any[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error'; action?: { label: string; onClick: () => void } } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const notifyError = useCallback((message: string) => setToast({ message, kind: 'error' }), []);

  const [full, dispatch] = useReducer(reducer, undefined, () => ({
    present: {
      boards: formatPrismaBoards(initialBoards),
      activeBoardId: initialBoards.length > 0 ? initialBoards[0].id : null,
      selectedCardIds: [],
    },
    past: [],
    future: [],
  }));

  const state = full.present;
  const canUndo = full.past.length > 0;
  const canRedo = full.future.length > 0;

  // Latest history, readable from callbacks created in an earlier render (e.g. a toast button)
  const fullRef = useRef(full);
  useEffect(() => { fullRef.current = full; });

  function undo() {
    const entry = fullRef.current.past[fullRef.current.past.length - 1];
    if (!entry) return;
    dispatch({ type: 'UNDO' });
    setToast({ message: 'Action undone ↩', kind: 'info' });
    persistHistoryStep(entry.boardId, diffBoards(entry.after, entry.before), 'undo');
  }

  function redo() {
    const entry = fullRef.current.future[0];
    if (!entry) return;
    dispatch({ type: 'REDO' });
    setToast({ message: 'Action redone ↪', kind: 'info' });
    persistHistoryStep(entry.boardId, diffBoards(entry.before, entry.after), 'redo');
  }

  const activeBoard = state.boards.find((b) => b.id === state.activeBoardId) ?? null;

  const pendingOpsRef = useRef(0);
  const lastOpFinishedRef = useRef(0);

  // Cooldown period (ms) after the last mutation finishes before allowing sync
  const SYNC_COOLDOWN_MS = 3000;

  // ── Supabase Realtime + Fallback Polling ──────────────────────────────────
  const fetchAndSync = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    if (!session?.user?.id) return;
    if (pendingOpsRef.current > 0) return;
    // Don't sync if a mutation just finished — wait for cooldown
    if (Date.now() - lastOpFinishedRef.current < SYNC_COOLDOWN_MS) return;

    try {
      const res = await fetch('/api/boards', { cache: 'no-store' });
      if (!res.ok) return;
      const freshData = await res.json();
      const freshBoards = formatPrismaBoards(freshData);
      
      // Prevent overwriting if operations started during the fetch
      if (pendingOpsRef.current > 0) return;
      
      dispatch({ type: 'SYNC_BOARDS', boards: freshBoards });
    } catch {
      // Silently ignore network errors
    }
  }, [session?.user?.id]);

  // Ids of the boards this user can see; the realtime subscription is scoped to them
  const boardIdsKey = state.boards.map((b) => b.id).sort().join(',');

  useEffect(() => {
    const userId = session?.user?.id;
    document.addEventListener('visibilitychange', fetchAndSync);

    // Several rows usually change together (e.g. a reorder), so collapse them into one refetch
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(fetchAndSync, 400);
    };
    const cleanup = () => {
      if (syncTimer) clearTimeout(syncTimer);
      document.removeEventListener('visibilitychange', fetchAndSync);
    };

    // Try Supabase Realtime first
    if (supabase && userId) {
      const client = supabase;
      const ids = boardIdsKey ? boardIdsKey.split(',') : [];
      // Realtime `in` filters accept at most 100 values; beyond that listen unfiltered
      const scoped = ids.length > 0 && ids.length <= 100;
      const idList = ids.join(',');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let channel: any = client.channel(`board-changes-${userId}`);
      // Inserts and updates are limited to this user's boards. Deletes cannot be
      // filtered by Realtime, so they are listened to per table without a filter.
      const listen = (table: string, filter: string | null, withDeletes: boolean) => {
        for (const event of ['INSERT', 'UPDATE']) {
          channel = channel.on(
            'postgres_changes',
            { event, schema: 'public', table, ...(filter ? { filter } : {}) },
            scheduleSync
          );
        }
        if (withDeletes) {
          channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, scheduleSync);
        }
      };

      if (ids.length > 0) {
        listen('Card', scoped ? `boardId=in.(${idList})` : null, true);
        listen('Column', scoped ? `boardId=in.(${idList})` : null, true);
        listen('Board', scoped ? `id=in.(${idList})` : null, true);
        if (scoped) listen('Member', `boardId=in.(${idList})`, false);
      }
      // Being added to (or removed from) a board, including ones not loaded yet
      listen('Member', scoped || ids.length === 0 ? `userId=eq.${userId}` : null, true);
      channel.subscribe();

      return () => {
        client.removeChannel(channel);
        cleanup();
      };
    } else if (userId) {
      // Fallback Polling if Supabase environment variables are missing
      console.warn("Supabase Realtime not configured. Falling back to 5s polling.");
      const intervalId = setInterval(fetchAndSync, 5000);
      return () => {
        clearInterval(intervalId);
        cleanup();
      };
    }

    return cleanup;
  }, [session?.user?.id, fetchAndSync, boardIdsKey]);

  // Tell the user a change did not save, then reload from the server once the
  // post-mutation cooldown has passed so the screen stops showing the unsaved change.
  function reportFailure(message: string, error: unknown) {
    console.error(message, error);
    notifyError(`${message} Your change was not saved.`);
    setTimeout(() => { fetchAndSync(); }, SYNC_COOLDOWN_MS + 300);
  }

  // Save the result of an undo/redo on the server
  async function persistHistoryStep(boardId: string, ops: ReturnType<typeof diffBoards>, kind: 'undo' | 'redo') {
    if (ops.length === 0) return;
    pendingOpsRef.current += 1;
    try {
      await applyBoardOpsAction(boardId, ops);
    } catch (e) {
      reportFailure(kind === 'undo' ? "Couldn't undo that." : "Couldn't redo that.", e);
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  // ── Board Actions ─────────────────────────────────────────────────────────

  async function createBoard(title: string, customColumns?: { title: string, color: string }[]) {
    try {
      const dbBoard = await createBoardAction(title, customColumns);
      const formatted = formatPrismaBoards([{...dbBoard, cards: []}])[0];
      dispatch({ type: 'ADD_BOARD', board: formatted });
      if (session?.user?.username) {
        router.push(`/${session.user.username}/${formatted.slug}`);
      }
    } catch (e) {
      reportFailure("Couldn't create the board.", e);
    }
  }

  async function deleteBoard(boardId: string) {
    const remainingBoards = state.boards.filter(b => b.id !== boardId);
    const nextBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
    dispatch({ type: 'DELETE_BOARD', boardId });
    try {
      await deleteBoardAction(boardId);
      if (state.activeBoardId === boardId) {
        if (nextBoard && session?.user?.username) {
          router.push(`/${session.user.username}/${nextBoard.slug}`);
        } else {
          router.push(`/`);
        }
      }
    } catch (e) {
      reportFailure("Couldn't delete the board.", e);
    }
  }

  async function createCard(boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) {
    const tempId = crypto.randomUUID();
    // Start from the column's defaults (the server applies the same ones), otherwise no priority
    const colSettings = state.boards.find((b) => b.id === boardId)?.columns.find((c) => c.id === columnId)?.settings;
    const tempCard: Card = {
      id: tempId,
      title,
      description: description || '',
      priority: colSettings?.defaultPriority ?? 'none',
      labels: colSettings?.defaultLabel ? [colSettings.defaultLabel] : [],
      checklist: [],
      dueDate: dueDate || null,
      assigneeIds: [],
      createdAt: new Date().toISOString(),
      coverImage: '',
      coverColor: '',

      reminderAt: null,
      completedAt: null,
    };
    dispatch({ type: 'ADD_CARD', boardId, columnId, card: tempCard });

    pendingOpsRef.current += 1;
    try {
      const realCard = await createCardAction(boardId, columnId, title, description, dueDate);
      
      // Convert Prisma card to client Card
      const formattedCard: Card = {
        id: realCard.id,
        title: realCard.title,
        description: realCard.description || '',
        priority: realCard.priority as any,
        labels: (Array.isArray(realCard.labels) ? realCard.labels : []) as any,
        checklist: (Array.isArray(realCard.checklist) ? realCard.checklist : []) as any,
        dueDate: realCard.dueDate ? new Date(realCard.dueDate).toISOString() : null,
        assigneeIds: (Array.isArray(realCard.assigneeIds) ? realCard.assigneeIds : []) as any,
        createdAt: new Date(realCard.createdAt).toISOString(),
        coverImage: realCard.coverImage || '',
        coverColor: realCard.coverColor || '',

        reminderAt: (realCard as any).reminderAt ? new Date((realCard as any).reminderAt).toISOString() : null,
        completedAt: null,
      };

      dispatch({ type: 'REPLACE_CARD_ID', boardId, columnId, oldId: tempId, newCard: formattedCard });
      return realCard.id;
    } catch (e) {
      reportFailure("Couldn't add the card.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
    return tempId;
  }

  async function createColumn(boardId: string, title: string) {
    const tempId = crypto.randomUUID();
    dispatch({ type: 'ADD_COLUMN', boardId, column: { id: tempId, title, cardIds: [], color: '#0052CC', wipLimit: 0 } });
    pendingOpsRef.current += 1;
    try {
      const realColumn = await createColumnAction(boardId, title);
      // Swap the temporary id for the real one so cards can be added straight away
      dispatch({ type: 'REPLACE_COLUMN_ID', boardId, oldId: tempId, newId: realColumn.id });
    } catch (e) {
      reportFailure("Couldn't add the column.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function moveCard(boardId: string, cardId: string, sourceColId: string, destColId: string, sourceIndex: number, destIndex: number) {
    const destSettings = state.boards.find((b) => b.id === boardId)?.columns.find((c) => c.id === destColId)?.settings;
    const completedAt = sourceColId !== destColId && destSettings?.autoComplete ? new Date().toISOString() : undefined;
    dispatch({ type: 'MOVE_CARD', boardId, sourceColId, destColId, sourceIndex, destIndex, completedAt });
    pendingOpsRef.current += 1;
    try {
      await moveCardAction(cardId, sourceColId, destColId, destIndex);
    } catch (e) {
      reportFailure("Couldn't move the card.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function deleteCard(boardId: string, columnId: string, cardId: string) {
    const title = state.boards.find((b) => b.id === boardId)?.cards[cardId]?.title;
    dispatch({ type: 'DELETE_CARD', boardId, columnId, cardId });
    // No "are you sure?" for a single card: it is deleted at once and can be brought back
    setToast({
      message: title ? `Deleted "${title.length > 30 ? title.slice(0, 30) + '…' : title}"` : 'Card deleted',
      kind: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          const past = fullRef.current.past;
          const last = past[past.length - 1];
          // Only step back if this delete is still the most recent change
          if (last && last.before.cards[cardId] && !last.after.cards[cardId]) undo();
          else notifyError('Other changes were made since. Use Ctrl+Z to step back through them.');
        },
      },
    });
    pendingOpsRef.current += 1;
    try {
      await deleteCardAction(boardId, cardId);
    } catch (e) {
      reportFailure("Couldn't delete the card.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function handleUpdateCard(boardId: string, card: Card, patch?: Partial<Card>) {
    dispatch({ type: 'UPDATE_CARD', boardId, card });
    pendingOpsRef.current += 1;
    try {
      await updateCardAction(boardId, card.id, patch ?? {
        title: card.title,
        description: card.description,
        priority: card.priority,
        dueDate: card.dueDate,
        labels: card.labels,
        checklist: card.checklist,
        assigneeIds: card.assigneeIds,
        coverImage: card.coverImage,
        coverColor: card.coverColor,

        reminderAt: card.reminderAt,
        completedAt: card.completedAt,
      });
    } catch (e) {
      reportFailure("Couldn't save the card.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function moveColumn(boardId: string, sourceIndex: number, destIndex: number) {
    dispatch({ type: 'MOVE_COLUMN', boardId, sourceIndex, destIndex });
    pendingOpsRef.current += 1;
    try {
      const board = state.boards.find(b => b.id === boardId);
      if (!board) return;
      const cols = [...board.columns];
      const [removed] = cols.splice(sourceIndex, 1);
      cols.splice(destIndex, 0, removed);
      await moveColumnAction(boardId, cols.map((c, i) => ({ id: c.id, order: i })));
    } catch (e) {
      reportFailure("Couldn't move the column.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function deleteColumn(boardId: string, columnId: string) {
    dispatch({ type: 'DELETE_COLUMN', boardId, columnId });
    pendingOpsRef.current += 1;
    try {
      await deleteColumnAction(boardId, columnId);
    } catch (e) {
      reportFailure("Couldn't delete the column.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function handleUpdateColumn(boardId: string, columnId: string, updates: Partial<Column>) {
    dispatch({ type: 'UPDATE_COLUMN', boardId, columnId, updates });
    pendingOpsRef.current += 1;
    try {
      await updateColumnAction(boardId, columnId, updates);
    } catch (e) {
      reportFailure("Couldn't save the column.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function handleUpdateBoard(boardId: string, updates: Partial<Board>) {
    dispatch({ type: 'UPDATE_BOARD', boardId, updates });
    pendingOpsRef.current += 1;
    try {
      await updateBoardAction(boardId, updates);
    } catch (e) {
      reportFailure("Couldn't save the board.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function toggleFavorite(boardId: string) {
    dispatch({ type: 'TOGGLE_FAVORITE', boardId });
    pendingOpsRef.current += 1;
    try {
      await toggleBoardFavoriteAction(boardId);
    } catch (e) {
      reportFailure("Couldn't update the favourite.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function archiveBoard(boardId: string) {
    const remainingBoards = state.boards.filter(b => b.id !== boardId);
    const nextBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
    dispatch({ type: 'ARCHIVE_BOARD', boardId });
    pendingOpsRef.current += 1;
    try {
      await archiveBoardAction(boardId);
      if (state.activeBoardId === boardId) {
        if (nextBoard && session?.user?.username) {
          router.push(`/${session.user.username}/${nextBoard.slug}`);
        } else {
          router.push(`/`);
        }
      }
    } catch (e) {
      reportFailure("Couldn't archive the board.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function handleSaveBoardAsTemplate(boardId: string) {
    try {
      await saveBoardAsTemplateAction(boardId);
    } catch (e) {
      reportFailure("Couldn't copy the board.", e);
    }
  }

  function toggleCardSelection(cardId: string) {
    dispatch({ type: 'TOGGLE_CARD_SELECTION', cardId });
  }

  function clearSelection() {
    dispatch({ type: 'CLEAR_SELECTION' });
  }

  async function bulkDelete(boardId: string, cardIds: string[]) {
    dispatch({ type: 'BULK_DELETE', boardId, cardIds });
    pendingOpsRef.current += 1;
    try {
      await bulkDeleteCardsAction(boardId, cardIds);
    } catch (e) {
      reportFailure("Couldn't delete the selected cards.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function bulkMove(boardId: string, cardIds: string[], targetColId: string) {
    const targetSettings = state.boards.find((b) => b.id === boardId)?.columns.find((c) => c.id === targetColId)?.settings;
    dispatch({ type: 'BULK_MOVE', boardId, cardIds, targetColId, completedAt: targetSettings?.autoComplete ? new Date().toISOString() : undefined });
    pendingOpsRef.current += 1;
    try {
      await bulkMoveCardsAction(boardId, cardIds, targetColId);
    } catch (e) {
      reportFailure("Couldn't move the selected cards.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function bulkCopy(boardId: string, cardIds: string[], targetColId: string) {
    const currentBoard = state.boards.find(b => b.id === boardId);
    if (!currentBoard) return;
    const newCards: Card[] = cardIds.map(id => {
      const original = currentBoard.cards[id];
      return { ...original, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    }).filter(Boolean);
    dispatch({ type: 'BULK_COPY', boardId, newCards, targetColId });
    pendingOpsRef.current += 1;
    try {
      await bulkCopyCardsAction(boardId, cardIds, targetColId);
    } catch (e) {
      reportFailure("Couldn't copy the selected cards.", e);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function addMember(boardId: string, name: string, role: 'Admin' | 'Member' = 'Member') {
    const member: Member = { id: crypto.randomUUID(), name, color: '#0052CC', role, status: 'pending' };
    dispatch({ type: 'ADD_MEMBER', boardId, member });
    pendingOpsRef.current += 1;
    try {
      await inviteMemberAction(boardId, name, role);
    } catch (error) {
      reportFailure("Couldn't send the invite. Check the email address.", error);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  async function removeMember(boardId: string, memberId: string) {
    dispatch({ type: 'REMOVE_MEMBER', boardId, memberId });
    pendingOpsRef.current += 1;
    try {
      await removeMemberAction(boardId, memberId);
    } catch (error) {
      reportFailure("Couldn't remove the member.", error);
      fetchAndSync();
    } finally {
      pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
      lastOpFinishedRef.current = Date.now();
    }
  }

  function setActiveBoardId(id: string | null) {
    if (id) dispatch({ type: 'SET_ACTIVE_BOARD', boardId: id });
  }

  return (
    <BoardContext.Provider value={{
      state, activeBoard, dispatch,
      createBoard, deleteBoard, createCard, createColumn, deleteColumn, moveCard, deleteCard,
      updateCard: handleUpdateCard, moveColumn, updateColumn: handleUpdateColumn,
      updateBoard: handleUpdateBoard, toggleFavorite, archiveBoard,
      saveBoardAsTemplate: handleSaveBoardAsTemplate,
      addMember, removeMember, setActiveBoardId,
      toggleCardSelection, clearSelection, bulkDelete, bulkMove, bulkCopy,
      undo, redo, canUndo, canRedo, notifyError,
    }}>
      {children}
      <UndoRedoToast message={toast?.message ?? null} kind={toast?.kind} action={toast?.action} onDismiss={dismissToast} />
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used inside BoardProvider');
  return ctx;
}
