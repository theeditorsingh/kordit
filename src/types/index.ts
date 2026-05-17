export type Priority = 'none' | 'urgent' | 'high' | 'medium' | 'low';
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
  status?: 'pending' | 'joined';
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
  coverImage?: string;
  coverColor?: string;
  timeSpent?: number;
  timerStarted?: string | null;
  isRecurring?: boolean;
  recurringRule?: string;
  blockedBy?: string[];
  reminderAt?: string | null;
}

export interface Column {
  id: string;
  title: string;
  cardIds: string[];
  color: string;
  icon?: string;
  wipLimit?: number;
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
  ownerUsername?: string;
  background?: string;
  backgroundType?: 'color' | 'gradient' | 'image';
  isArchived?: boolean;
  isFavorite?: boolean;
  categoryId?: string | null;
}

export interface Activity {
  id: string;
  action: string;
  details: Record<string, any>;
  createdAt: string;
  boardId: string;
  cardId?: string | null;
  userId: string;
  user?: { name: string; username: string; image?: string };
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  cardId: string;
  userId: string;
  user?: { name: string; username: string; image?: string };
}

export interface Automation {
  id: string;
  name: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  condition: Record<string, any>;
  action: AutomationAction;
  actionConfig: Record<string, any>;
  boardId: string;
}

export type AutomationTrigger = 'card_moved_to' | 'due_date_passed' | 'checklist_completed' | 'card_created';
export type AutomationAction = 'move_card' | 'set_priority' | 'complete_checklist' | 'set_due_date';

export interface BoardCategory {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface AppState {
  boards: Board[];
  activeBoardId: string | null;
  selectedCardIds: string[];
}
