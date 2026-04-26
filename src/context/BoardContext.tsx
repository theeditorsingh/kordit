'use client';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AppState, Board, Card, Column, Member } from '@/types';
import { createBoardAction, createCardAction, createColumnAction, moveCardAction, deleteCardAction, bulkDeleteCardsAction, bulkMoveCardsAction, bulkCopyCardsAction, deleteBoardAction } from '@/actions/boardActions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

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
  | { type: 'UPDATE_MEMBER_ROLE'; boardId: string; memberId: string; role: 'Admin' | 'Member' }
  | { type: 'TOGGLE_CARD_SELECTION'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BULK_DELETE'; boardId: string; cardIds: string[] }
  | { type: 'BULK_MOVE'; boardId: string; cardIds: string[]; targetColId: string }
  | { type: 'BULK_COPY'; boardId: string; newCards: Card[]; targetColId: string };

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
                // Add to end of target column
                return { ...c, cardIds: [...c.cardIds, ...action.cardIds] };
              } else {
                // Remove from other columns
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

    default:
      return state;
  }
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
  addMember: (boardId: string, name: string, role?: 'Admin' | 'Member') => void;
  setActiveBoardId: (id: string | null) => void;
  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  bulkDelete: (boardId: string, cardIds: string[]) => Promise<void>;
  bulkMove: (boardId: string, cardIds: string[], targetColId: string) => Promise<void>;
  bulkCopy: (boardId: string, cardIds: string[], targetColId: string) => Promise<void>;
}

const BoardContext = createContext<BoardContextType | null>(null);

function formatPrismaBoards(prismaBoards: any[]): Board[] {
  return prismaBoards.map(pb => {
    // Group cards by column and format cards object
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
        createdAt: new Date(card.createdAt).toISOString()
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
      columns: pb.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        color: col.color,
        cardIds: columnCardIds[col.id] || []
      })),
      cards: cardsObj,
      members: pb.members.map((m: any) => ({
        id: m.userId, // use userId as member ID for simplicity in front end
        name: m.user?.name || m.user?.username || 'Unknown',
        role: m.role as any,
        color: '#0052CC' // default color
      }))
    };
  });
}

export function BoardProvider({ children, initialBoards = [] }: { children: React.ReactNode, initialBoards?: any[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    boards: formatPrismaBoards(initialBoards),
    activeBoardId: initialBoards.length > 0 ? initialBoards[0].id : null,
    selectedCardIds: [],
  }));

  const activeBoard = state.boards.find((b) => b.id === state.activeBoardId) ?? null;

  async function createBoard(title: string, customColumns?: { title: string, color: string }[]) {
    try {
      const dbBoard = await createBoardAction(title, customColumns);
      // Wait, we need to format it first before dispatching
      const formatted = formatPrismaBoards([{...dbBoard, cards: []}])[0];
      dispatch({ type: 'ADD_BOARD', board: formatted });
      
      // Navigate to the new board
      if (session?.user?.username) {
        router.push(`/${session.user.username}/${formatted.slug}`);
      }
    } catch (e) {
      console.error("Failed to create board", e);
    }
  }

  async function deleteBoard(boardId: string) {
    // 1. Optimistic Update
    dispatch({ type: 'DELETE_BOARD', boardId });

    // 2. Server Action
    try {
      await deleteBoardAction(boardId);
      
      // If we just deleted the active board, navigate to home
      if (session?.user?.username && state.activeBoardId === boardId) {
        router.push(`/${session.user.username}`);
      }
    } catch (e) {
      console.error("Failed to delete board", e);
    }
  }

  async function createCard(boardId: string, columnId: string, title: string, description?: string, dueDate?: string | null) {
    // 1. Optimistic Update
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
    };
    dispatch({ type: 'ADD_CARD', boardId, columnId, card: tempCard });

    // 2. Server Action
    try {
      const dbCard = await createCardAction(boardId, columnId, title, description, dueDate);
      // Replace temp ID with real ID from DB
      // We'd need an action to swap the ID, but Next.js Server Actions typically revalidate the path
      // meaning the layout fetches fresh data. For seamless UI, we might just let it be temp until hard refresh
      // or swap it. For now, it's optimistic!
    } catch (e) {
      console.error("Failed to create card on server", e);
      // dispatch({ type: 'DELETE_CARD', boardId, columnId, cardId: tempId });
    }
    return tempId;
  }

  async function createColumn(boardId: string, title: string) {
    const tempId = crypto.randomUUID();
    dispatch({ type: 'ADD_COLUMN', boardId, column: { id: tempId, title, cardIds: [], color: '#0052CC' } });
    
    try {
      await createColumnAction(boardId, title);
    } catch (e) {
      console.error("Failed to create column", e);
    }
  }

  async function moveCard(boardId: string, cardId: string, sourceColId: string, destColId: string, sourceIndex: number, destIndex: number) {
    // 1. Optimistic Update
    dispatch({
      type: 'MOVE_CARD',
      boardId,
      sourceColId,
      destColId,
      sourceIndex,
      destIndex,
    });

    // 2. Server Action
    try {
      // For simplicity in this step, newOrder is just destIndex
      await moveCardAction(cardId, sourceColId, destColId, destIndex);
    } catch (e) {
      console.error("Failed to move card", e);
      // In a robust app, we'd dispatch a reverse move here to undo the optimistic update
    }
  }

  async function deleteCard(boardId: string, columnId: string, cardId: string) {
    // 1. Optimistic Update
    dispatch({ type: 'DELETE_CARD', boardId, columnId, cardId });

    // 2. Server Action
    try {
      await deleteCardAction(boardId, cardId);
    } catch (e) {
      console.error("Failed to delete card", e);
      // In a robust app, we'd restore the card here on failure
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
    // For optimistic update of copy, we need to generate new temp IDs
    const currentBoard = state.boards.find(b => b.id === boardId);
    if (!currentBoard) return;
    
    const newCards: Card[] = cardIds.map(id => {
      const original = currentBoard.cards[id];
      return {
        ...original,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
    }).filter(Boolean);

    dispatch({ type: 'BULK_COPY', boardId, newCards, targetColId });
    try {
      await bulkCopyCardsAction(boardId, cardIds, targetColId);
      // The server action will revalidate, swapping temp cards with real DB ones.
    } catch (e) {
      console.error("Failed bulk copy", e);
    }
  }

  function addMember(boardId: string, name: string, role: 'Admin' | 'Member' = 'Member') {
    // Local only for now, would need a server action
    const member: Member = { id: crypto.randomUUID(), name, color: '#0052CC', role };
    dispatch({ type: 'ADD_MEMBER', boardId, member });
  }

  function setActiveBoardId(id: string | null) {
    if (id) dispatch({ type: 'SET_ACTIVE_BOARD', boardId: id });
  }

  return (
    <BoardContext.Provider value={{ 
      state, activeBoard, dispatch, 
      createBoard, deleteBoard, createCard, createColumn, moveCard, deleteCard, 
      addMember, setActiveBoardId,
      toggleCardSelection, clearSelection, bulkDelete, bulkMove, bulkCopy
    }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used inside BoardProvider');
  return ctx;
}
