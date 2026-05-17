'use client';
import { useEffect, useCallback, useRef } from 'react';
import { useBoardContext } from '@/context/BoardContext';
import { Card, Board } from '@/types';

const FIRED_KEY = 'kordit-fired-reminders';
const CHECK_INTERVAL = 60_000; // 60 seconds

/** Returns all cards across all boards */
function getAllCards(boards: Board[]): (Card & { boardTitle: string; boardSlug: string })[] {
  const result: (Card & { boardTitle: string; boardSlug: string })[] = [];
  for (const board of boards) {
    for (const cardId of Object.keys(board.cards)) {
      const card = board.cards[cardId];
      if (card) {
        result.push({ ...card, boardTitle: board.title, boardSlug: board.slug });
      }
    }
  }
  return result;
}

function getFiredSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addFired(cardId: string) {
  const set = getFiredSet();
  set.add(cardId);
  localStorage.setItem(FIRED_KEY, JSON.stringify([...set]));
}

export interface ReminderItem {
  card: Card;
  boardTitle: string;
  boardSlug: string;
  type: 'overdue' | 'due-today' | 'due-tomorrow' | 'reminder';
}

/** Categorize all cards into reminder groups */
export function getReminderItems(boards: Board[]): ReminderItem[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const items: ReminderItem[] = [];
  const allCards = getAllCards(boards);

  for (const card of allCards) {
    if (!card.dueDate) continue;
    const due = new Date(card.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDay < today) {
      items.push({ card, boardTitle: card.boardTitle, boardSlug: card.boardSlug, type: 'overdue' });
    } else if (dueDay >= today && dueDay < tomorrow) {
      items.push({ card, boardTitle: card.boardTitle, boardSlug: card.boardSlug, type: 'due-today' });
    } else if (dueDay >= tomorrow && dueDay < dayAfter) {
      items.push({ card, boardTitle: card.boardTitle, boardSlug: card.boardSlug, type: 'due-tomorrow' });
    }
  }

  return items;
}

/** Hook: check reminders every 60s and fire browser notifications */
export function useReminders() {
  const { state } = useBoardContext();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndFire = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const fired = getFiredSet();
    const allCards = getAllCards(state.boards);

    for (const card of allCards) {
      // Check reminderAt
      if (card.reminderAt) {
        const reminderTime = new Date(card.reminderAt);
        const fireKey = `reminder-${card.id}-${card.reminderAt}`;
        if (reminderTime <= now && !fired.has(fireKey)) {
          addFired(fireKey);
          new Notification(`📋 Reminder: ${card.title}`, {
            body: `Due: ${new Date(card.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • ${card.boardTitle}`,
            icon: '/icon-192.png',
            tag: `kordit-${card.id}`,
          });
        }
      }

      // Check overdue (fire once per card per day)
      if (card.dueDate) {
        const due = new Date(card.dueDate);
        if (due < now) {
          const overdueKey = `overdue-${card.id}-${now.toDateString()}`;
          if (!fired.has(overdueKey)) {
            addFired(overdueKey);
            new Notification(`⚠️ Overdue: ${card.title}`, {
              body: `Was due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${card.boardTitle}`,
              icon: '/icon-192.png',
              tag: `kordit-overdue-${card.id}`,
            });
          }
        }
      }
    }
  }, [state.boards]);

  useEffect(() => {
    // Initial check
    checkAndFire();
    // Periodic check
    intervalRef.current = setInterval(checkAndFire, CHECK_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAndFire]);
}
