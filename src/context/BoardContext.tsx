'use client';
import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useState } from 'react';
import { AppState, Board, Card, Column, Member } from '@/types';
import {
  createBoardAction, createCardAction, createColumnAction, moveCardAction,
  deleteCardAction, bulkDeleteCardsAction, bulkMoveCardsAction, bulkCopyCardsAction,
  deleteBoardAction, inviteMemberAction, updateCardAction, moveColumnAction,
  updateColumnAction, updateBoardAction, toggleBoardFavoriteAction,
  archiveBoardAction, saveBoardAsTemplateAction
} from '@/actions/boardActions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import UndoRedoToast from '@/components/UndoRedoToast';

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
  | { type: 'MOVE_CARD'; boardId: string; sourceColId: string; destColId: string; sourceIndex: number; destIndex: number }
  | { type: 'ADD_MEMBER'; boardId: string; member: Member }
  | { type: 'REMOVE_MEMBER'; boardId: string; memberId: string }
  | { type: 'UPDATE_BOARD_VISIBILITY'; boardId: string; visibility: 'Private' | 'Workspace' | 'Public' }
  | { type: 'UPDATE_MEMBER_ROLE'; boardId: string; memberId: string; role: 'Admin' | 'Member' }
  | { type: 'TOGGLE_CARD_SELECTION'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BULK_DELETE'; boardId: string; cardIds: string[] }
  | { type: 'BULK_MOVE'; boardId: string; cardIds: string[]; targetColId: string }
  | { type: 'BULK_COPY'; boardId: string; newCards: Card[]; targetColId: string }
  | { type: 'TOGGLE_FAVORITE'; boardId: string }
  | { type: 'ARCHIVE_BOARD'; boardId: string }
  | { type: 'SYNC_BOARDS'; boards: Board[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// Extended state shape including undo/redo stacks
interface FullState {
  present: AppState;
  past: AppState[];
  future: AppState[];
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
          return { ...b, columns: cols };
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
          return {
            ...b,
            columns: b.columns.map((c) => {
              if (c.id === action.targetColId) {
                return { ...c, cardIds: [...c.cardIds, ...action.cardIds] };
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
    if (full.past.length === 0) return full;
    const previous = full.past[full.past.length - 1];
    return {
      present: previous,
      past: full.past.slice(0, -1),
      future: [full.present, ...full.future].slice(0, UNDO_STACK_MAX),
    };
  }
  if (action.type === 'REDO') {
    if (full.future.length === 0) return full;
    const next = full.future[0];
    return {
      present: next,
      past: [...full.past, full.present].slice(-UNDO_STACK_MAX),
      future: full.future.slice(1),
    };
  }
  if (action.type === 'SYNC_BOARDS') {
    // Sync should not push to undo stack
    return { ...full, present: boardReducer(full.present, action) };
  }
  const nextPresent = boardReducer(full.present, action);
  if (UNDOABLE_ACTIONS.has(action.type)) {
    return {
      present: nextPresent,
      past: [...full.past, full.present].slice(-UNDO_STACK_MAX),
      future: [],
    };
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
  moveCard: (boardId: string, cardId: string, sourceColId: string, destColId: string, sourceIndex: number, destIndex: number) => Promise<void>;
  deleteCard: (boardId: string, columnId: string, cardId: string) => Promise<void>;
  updateCard: (boardId: string, card: Card) => Promise<void>;
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
        timeSpent: card.timeSpent || 0,
        timerStarted: card.timerStarted ? new Date(card.timerStarted).toISOString() : null,
        isRecurring: card.isRecurring || false,
        recurringRule: card.recurringRule || '',
        blockedBy: Array.isArray(card.blockedBy) ? card.blockedBy : [],
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
      isArchived: pb.isArchived || false,
      isFavorite: pb.isFavorite || false,
      categoryId: pb.categoryId || null,
      columns: pb.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        color: col.color,
        icon: col.icon || '',
        wipLimit: col.wipLimit || 0,
        cardIds: columnCardIds[col.id] || []
      })),
      cards: cardsObj,
      members: pb.members.map((m: any) => ({
        id: m.userId,
        name: m.user?.name || m.user?.username || 'Unknown',
        role: m.role as any,
        color: '#0052CC',
        status: 'joined' as const,
      })),
      createdAt: pb.createdAt ? new Date(pb.createdAt).toISOString() : new Date().toISOString()
    };
  });
}

export function BoardProvider({ children, initialBoards = [] }: { children: React.ReactNode, initialBoards?: any[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  function undo() {
    if (!canUndo) return;
    dispatch({ type: 'UNDO' });
    setToastMsg('Action undone ↩');
  }

  function redo() {
    if (!canRedo) return;
    dispatch({ type: 'REDO' });
    setToastMsg('Action redone ↪');
  }

  const activeBoard = state.boards.find((b) => b.id === state.activeBoardId) ?? null;

  const pendingOpsRef = useRef(0);

  // ── Supabase Realtime + Fallback Polling ──────────────────────────────────
  const fetchAndSync = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    if (!session?.user?.id) return;
    if (pendingOpsRef.current > 0) return;

    try {
      const res = await fetch('/api/boards', { cache: 'no-store' });
      if (!res.ok) return;
      const freshData = await res.json();
      const freshBoards = formatPrismaBoards(freshData);
      dispatch({ type: 'SYNC_BOARDS', boards: freshBoards });
    } catch {
      // Silently ignore network errors
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Try Supabase Realtime first
    if (supabase && session?.user?.id) {
      const channel = supabase
        .channel('board-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Card' }, () => {
          fetchAndSync();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Column' }, () => {
          fetchAndSync();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Board' }, () => {
          fetchAndSync();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Member' }, () => {
          fetchAndSync();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Activity' }, () => {
          fetchAndSync();
        })
        .subscribe();

      document.addEventListener('visibilitychange', fetchAndSync);

      return () => {
        supabase!.removeChannel(channel);
        document.removeEventListener('visibilitychange', fetchAndSync);
      };
    }

    // Fallback: polling if Supabase env vars not configured
    const POLL_INTERVAL_MS = 5000;
    const pollInterval = setInterval(fetchAndSync, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', fetchAndSync);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', fetchAndSync);
    };
  }, [session?.user?.id, fetchAndSync]);

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
      console.error("Failed to create board", e);
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
      console.error("Failed to delete board", e);
    }
  }

  async function createCard(boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) {
    const tempId = crypto.randomUUID();
    const tempCard: Card = {
      id: tempId,
      title,
      description: description || '',
      priority: 'medium',
      labels: [],
      checklist: [],
      dueDate: dueDate || null,
      assigneeIds: [],
      createdAt: new Date().toISOString(),
      coverImage: '',
      coverColor: '',
      timeSpent: 0,
      timerStarted: null,
      isRecurring: false,
      recurringRule: '',
      blockedBy: [],
    };
    dispatch({ type: 'ADD_CARD', boardId, columnId, card: tempCard });

    pendingOpsRef.current += 1;
    try {
      await createCardAction(boardId, columnId, title, description, dueDate);
    } catch (e) {
      console.error("Failed to create card on server", e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
    }
    return tempId;
  }

  async function createColumn(boardId: string, title: string) {
    const tempId = crypto.randomUUID();
    dispatch({ type: 'ADD_COLUMN', boardId, column: { id: tempId, title, cardIds: [], color: '#0052CC', wipLimit: 0 } });
    pendingOpsRef.current += 1;
    try {
      await createColumnAction(boardId, title);
    } catch (e) {
      console.error('Failed to create column', e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
    }
  }

  async function moveCard(boardId: string, cardId: string, sourceColId: string, destColId: string, sourceIndex: number, destIndex: number) {
    dispatch({ type: 'MOVE_CARD', boardId, sourceColId, destColId, sourceIndex, destIndex });
    pendingOpsRef.current += 1;
    try {
      await moveCardAction(cardId, sourceColId, destColId, destIndex);
    } catch (e) {
      console.error('Failed to move card', e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
    }
  }

  async function deleteCard(boardId: string, columnId: string, cardId: string) {
    dispatch({ type: 'DELETE_CARD', boardId, columnId, cardId });
    pendingOpsRef.current += 1;
    try {
      await deleteCardAction(boardId, cardId);
    } catch (e) {
      console.error('Failed to delete card', e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
    }
  }

  async function handleUpdateCard(boardId: string, card: Card) {
    dispatch({ type: 'UPDATE_CARD', boardId, card });
    pendingOpsRef.current += 1;
    try {
      await updateCardAction(boardId, card.id, {
        title: card.title,
        description: card.description,
        priority: card.priority,
        dueDate: card.dueDate,
        labels: card.labels,
        checklist: card.checklist,
        assigneeIds: card.assigneeIds,
        coverImage: card.coverImage,
        coverColor: card.coverColor,
        timeSpent: card.timeSpent,
        timerStarted: card.timerStarted,
        isRecurring: card.isRecurring,
        recurringRule: card.recurringRule,
        blockedBy: card.blockedBy,
      });
    } catch (e) {
      console.error("Failed to update card", e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
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
      console.error('Failed to move column', e);
    } finally {
      setTimeout(() => { pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1); }, 2000);
    }
  }

  async function handleUpdateColumn(boardId: string, columnId: string, updates: Partial<Column>) {
    dispatch({ type: 'UPDATE_COLUMN', boardId, columnId, updates });
    try {
      await updateColumnAction(boardId, columnId, updates);
    } catch (e) {
      console.error("Failed to update column", e);
    }
  }

  async function handleUpdateBoard(boardId: string, updates: Partial<Board>) {
    dispatch({ type: 'UPDATE_BOARD', boardId, updates });
    try {
      await updateBoardAction(boardId, updates);
    } catch (e) {
      console.error("Failed to update board", e);
    }
  }

  async function toggleFavorite(boardId: string) {
    dispatch({ type: 'TOGGLE_FAVORITE', boardId });
    try {
      await toggleBoardFavoriteAction(boardId);
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  }

  async function archiveBoard(boardId: string) {
    const remainingBoards = state.boards.filter(b => b.id !== boardId);
    const nextBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
    dispatch({ type: 'ARCHIVE_BOARD', boardId });
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
      console.error("Failed to archive board", e);
    }
  }

  async function handleSaveBoardAsTemplate(boardId: string) {
    try {
      await saveBoardAsTemplateAction(boardId);
    } catch (e) {
      console.error("Failed to save board as template", e);
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
    try {
      await bulkDeleteCardsAction(boardId, cardIds);
    } catch (e) {
      console.error("Failed bulk delete", e);
    }
  }

  async function bulkMove(boardId: string, cardIds: string[], targetColId: string) {
    dispatch({ type: 'BULK_MOVE', boardId, cardIds, targetColId });
    try {
      await bulkMoveCardsAction(boardId, cardIds, targetColId);
    } catch (e) {
      console.error("Failed bulk move", e);
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
    try {
      await bulkCopyCardsAction(boardId, cardIds, targetColId);
    } catch (e) {
      console.error("Failed bulk copy", e);
    }
  }

  async function addMember(boardId: string, name: string, role: 'Admin' | 'Member' = 'Member') {
    const member: Member = { id: crypto.randomUUID(), name, color: '#0052CC', role, status: 'pending' };
    dispatch({ type: 'ADD_MEMBER', boardId, member });
    try {
      await inviteMemberAction(boardId, name, role);
    } catch (error) {
      console.error("Failed to invite member", error);
    }
  }

  function removeMember(boardId: string, memberId: string) {
    dispatch({ type: 'REMOVE_MEMBER', boardId, memberId });
  }

  function setActiveBoardId(id: string | null) {
    if (id) dispatch({ type: 'SET_ACTIVE_BOARD', boardId: id });
  }

  return (
    <BoardContext.Provider value={{
      state, activeBoard, dispatch,
      createBoard, deleteBoard, createCard, createColumn, moveCard, deleteCard,
      updateCard: handleUpdateCard, moveColumn, updateColumn: handleUpdateColumn,
      updateBoard: handleUpdateBoard, toggleFavorite, archiveBoard,
      saveBoardAsTemplate: handleSaveBoardAsTemplate,
      addMember, removeMember, setActiveBoardId,
      toggleCardSelection, clearSelection, bulkDelete, bulkMove, bulkCopy,
      undo, redo, canUndo, canRedo,
    }}>
      {children}
      <UndoRedoToast message={toastMsg} onDismiss={() => setToastMsg(null)} />
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used inside BoardProvider');
  return ctx;
}
