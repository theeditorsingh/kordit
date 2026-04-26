'use client';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AppState, Board, Card, Column, Member } from '@/types';
import { getInitialState, saveState, getMemberColor } from '@/utils/storage';

type Action =
  | { type: 'SET_ACTIVE_BOARD'; boardId: string }
  | { type: 'ADD_BOARD'; board: Board }
  | { type: 'UPDATE_BOARD_TITLE'; boardId: string; title: string }
  | { type: 'DELETE_BOARD'; boardId: string }
  | { type: 'ADD_COLUMN'; boardId: string; column: Column }
  | { type: 'UPDATE_COLUMN_TITLE'; boardId: string; columnId: string; title: string }
  | { type: 'DELETE_COLUMN'; boardId: string; columnId: string }
  | { type: 'ADD_CARD'; boardId: string; columnId: string; card: Card }
  | { type: 'UPDATE_CARD'; boardId: string; card: Card }
  | { type: 'DELETE_CARD'; boardId: string; columnId: string; cardId: string }
  | { type: 'MOVE_CARD'; boardId: string; sourceColId: string; destColId: string; sourceIndex: number; destIndex: number }
  | { type: 'ADD_MEMBER'; boardId: string; member: Member }
  | { type: 'REMOVE_MEMBER'; boardId: string; memberId: string }
  | { type: 'UPDATE_BOARD_VISIBILITY'; boardId: string; visibility: 'Private' | 'Workspace' | 'Public' }
  | { type: 'UPDATE_MEMBER_ROLE'; boardId: string; memberId: string; role: 'Admin' | 'Member' };

function reducer(state: AppState, action: Action): AppState {
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

    case 'UPDATE_BOARD_VISIBILITY':
      return {
        ...state,
        boards: state.boards.map((b) => b.id === action.boardId ? { ...b, visibility: action.visibility } : b),
      };

    case 'DELETE_BOARD': {
      const boards = state.boards.filter((b) => b.id !== action.boardId);
      const activeBoardId = state.activeBoardId === action.boardId ? (boards[0]?.id ?? null) : state.activeBoardId;
      return { boards, activeBoardId };
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

    default:
      return state;
  }
}

interface BoardContextType {
  state: AppState;
  activeBoard: Board | null;
  dispatch: React.Dispatch<Action>;
  createBoard: (title: string) => void;
  createCard: (boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) => string;
  createColumn: (boardId: string, title: string) => void;
  addMember: (boardId: string, name: string, role?: 'Admin' | 'Member') => void;
}

const BoardContext = createContext<BoardContextType | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const activeBoard = state.boards.find((b) => b.id === state.activeBoardId) ?? null;

  useEffect(() => {
    saveState(state);
  }, [state]);

  function createBoard(title: string) {
    const { createDefaultBoard } = require('@/utils/storage');
    const board: Board = { ...createDefaultBoard(), title, cards: {}, columns: [
      { id: crypto.randomUUID(), title: 'To Do', cardIds: [], color: '#0052CC' },
      { id: crypto.randomUUID(), title: 'In Progress', cardIds: [], color: '#FF991F' },
      { id: crypto.randomUUID(), title: 'Review', cardIds: [], color: '#6554C0' },
      { id: crypto.randomUUID(), title: 'Done', cardIds: [], color: '#36B37E' },
    ], visibility: 'Workspace' };
    dispatch({ type: 'ADD_BOARD', board });
  }

  function createCard(boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) {
    const card: Card = {
      id: crypto.randomUUID(),
      title,
      description: description || '',
      priority: 'medium',
      labels: [],
      checklist: [],
      dueDate: dueDate || null,
      assigneeIds: [],
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CARD', boardId, columnId, card });
    return card.id;
  }

  function createColumn(boardId: string, title: string) {
    const column: Column = {
      id: crypto.randomUUID(),
      title,
      cardIds: [],
      color: '#0052CC',
    };
    dispatch({ type: 'ADD_COLUMN', boardId, column });
  }

  function addMember(boardId: string, name: string, role: 'Admin' | 'Member' = 'Member') {
    const board = state.boards.find((b) => b.id === boardId);
    const color = getMemberColor(board?.members.length ?? 0);
    const member: Member = { id: crypto.randomUUID(), name, color, role };
    dispatch({ type: 'ADD_MEMBER', boardId, member });
  }

  return (
    <BoardContext.Provider value={{ state, activeBoard, dispatch, createBoard, createCard, createColumn, addMember }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used inside BoardProvider');
  return ctx;
}
