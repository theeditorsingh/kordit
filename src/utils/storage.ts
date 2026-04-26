import { AppState, Board, Card, Column } from '@/types';

const STORAGE_KEY = 'kordit_state';

const DEFAULT_MEMBER_COLORS = [
  '#0052CC', '#00B8D9', '#36B37E', '#FF5630', '#FF991F',
  '#6554C0', '#00C7E6', '#57D9A3', '#FF7452', '#FFC400',
];

export function createDefaultBoard(): Board {
  const colTodo: Column = { id: crypto.randomUUID(), title: 'To Do', cardIds: [], color: '#0052CC' };
  const colInProgress: Column = { id: crypto.randomUUID(), title: 'In Progress', cardIds: [], color: '#FF991F' };
  const colReview: Column = { id: crypto.randomUUID(), title: 'Review', cardIds: [], color: '#6554C0' };
  const colDone: Column = { id: crypto.randomUUID(), title: 'Done', cardIds: [], color: '#36B37E' };

  const sampleCard: Card = {
    id: crypto.randomUUID(),
    title: 'Welcome to Kordit 🎉',
    description: 'This is your first card. Click to edit it, drag it to move it!',
    priority: 'medium',
    labels: [{ id: crypto.randomUUID(), name: 'Getting Started', color: '#0052CC' }],
    checklist: [
      { id: crypto.randomUUID(), text: 'Create your first board', done: true },
      { id: crypto.randomUUID(), text: 'Add team members', done: false },
      { id: crypto.randomUUID(), text: 'Create tasks', done: false },
    ],
    dueDate: null,
    assigneeIds: [],
    createdAt: new Date().toISOString(),
  };
  colTodo.cardIds.push(sampleCard.id);

  return {
    id: crypto.randomUUID(),
    title: 'My First Board',
    color: '#0052CC',
    visibility: 'Workspace',
    members: [],
    columns: [colTodo, colInProgress, colReview, colDone],
    cards: { [sampleCard.id]: sampleCard },
    createdAt: new Date().toISOString(),
  };
}

export function getInitialState(): AppState {
  if (typeof window === 'undefined') return { boards: [], activeBoardId: null, selectedCardIds: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.boards && parsed.boards.length > 0) {
        // Ensure selectedCardIds exists when reading from old storage
        if (!parsed.selectedCardIds) parsed.selectedCardIds = [];
        return parsed;
      }
    }
  } catch (_) {}
  const board = createDefaultBoard();
  return { boards: [board], activeBoardId: board.id, selectedCardIds: [] };
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export function getMemberColor(index: number): string {
  return DEFAULT_MEMBER_COLORS[index % DEFAULT_MEMBER_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
