export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type Theme = 'dark' | 'light';
export type ViewMode = 'board' | 'list' | 'calendar';
export type Visibility = 'Private' | 'Workspace' | 'Public';

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  role: 'Admin' | 'Member';
}

export interface Card {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  labels: Label[];
  checklist: ChecklistItem[];
  dueDate: string | null;
  assigneeIds: string[];
  createdAt: string;
}

export interface Column {
  id: string;
  title: string;
  cardIds: string[];
  color: string;
}

export interface Board {
  id: string;
  title: string;
  slug: string;
  color: string;
  visibility: Visibility;
  members: Member[];
  columns: Column[];
  cards: Record<string, Card>;
  createdAt: string;
}

export interface AppState {
  boards: Board[];
  activeBoardId: string | null;
  selectedCardIds: string[];
}
