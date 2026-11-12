'use client';
/**
 * One shared notifications store for the bell, the Inbox page and the sidebar badge.
 * It polls /api/notifications every 30s while at least one component is subscribed,
 * so several consumers never mean several polls.
 */
import { useSyncExternalStore } from 'react';

export type InboxNotification = {
  id: string;
  type: 'assignment' | 'comment' | 'mention' | 'invitation';
  message: string;
  isRead: boolean;
  createdAt: string;
  cardId?: string | null;
  actor?: { name: string | null; username: string | null; image: string | null } | null;
  card?: { title: string } | null;
  board?: { title: string; slug: string; owner: { username: string | null } } | null;
};

export type DueSoon = {
  id: string;
  title: string;
  dueDate: string;
  board: { title: string; slug: string; owner: { username: string | null } };
};

type Snapshot = { notifications: InboxNotification[]; dueSoon: DueSoon[]; loaded: boolean };

const EMPTY: Snapshot = { notifications: [], dueSoon: [], loaded: false };
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export async function reloadNotifications() {
  try {
    const response = await fetch('/api/notifications', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    emit({
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      dueSoon: Array.isArray(data.dueSoon) ? data.dueSoon : [],
      loaded: true,
    });
  } catch {
    // Offline: keep the last list
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    setTimeout(reloadNotifications, 0);
    timer = setInterval(reloadNotifications, 30000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Mark one notification (or all, with no id) as read; updates every consumer at once. */
export async function markNotificationsRead(id?: string) {
  const before = snapshot;
  emit({ ...snapshot, notifications: snapshot.notifications.map((n) => (!id || n.id === id ? { ...n, isRead: true } : n)) });
  try {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (!response.ok) throw new Error('Mark read failed');
  } catch {
    emit(before);
  }
}

/** Board link for a notification or due card, opening the card when known. */
export function notificationHref(board: InboxNotification['board'] | DueSoon['board'], cardId?: string | null) {
  if (!board?.owner.username) return null;
  return `/${board.owner.username}/${board.slug}${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}`;
}

export function useNotifications() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const unread = state.notifications.filter((n) => !n.isRead).length;
  return {
    ...state,
    unread,
    /** What the bell shows: unread notifications plus assigned cards due soon */
    badge: unread + state.dueSoon.length,
    reload: reloadNotifications,
    markRead: markNotificationsRead,
  };
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function dueLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const day = Math.floor((date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (day < 0) return `${Math.abs(day)}d overdue`;
  if (day === 0) return 'Today';
  if (day === 1) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
