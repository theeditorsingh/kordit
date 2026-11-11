'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, Check, MessageSquare, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './NotificationBell.module.css';

type InboxNotification = {
  id: string;
  type: 'assignment' | 'comment' | 'mention' | 'invitation';
  message: string;
  isRead: boolean;
  createdAt: string;
  cardId?: string | null;
  board?: { title: string; slug: string; owner: { username: string | null } } | null;
};

type DueSoon = {
  id: string;
  title: string;
  dueDate: string;
  board: { title: string; slug: string; owner: { username: string | null } };
};

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function dueLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const day = Math.floor((date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (day < 0) return `${Math.abs(day)}d overdue`;
  if (day === 0) return 'Today';
  if (day === 1) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [dueSoon, setDueSoon] = useState<DueSoon[]>([]);

  const load = useCallback(async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    setDueSoon(Array.isArray(data.dueSoon) ? data.dueSoon : []);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const unread = notifications.filter((notification) => !notification.isRead).length;
  const badge = unread + dueSoon.length;

  async function markRead(id?: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    setNotifications((items) => items.map((item) => !id || item.id === id ? { ...item, isRead: true } : item));
  }

  function openBoard(board: InboxNotification['board'] | DueSoon['board'], cardId?: string | null) {
    if (!board?.owner.username) return;
    const suffix = cardId ? `?card=${encodeURIComponent(cardId)}` : '';
    setOpen(false);
    router.push(`/${board.owner.username}/${board.slug}${suffix}`);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-icon" onClick={() => { const next = !open; setOpen(next); if (next) load(); }} aria-label={`Notifications${badge ? ` (${badge})` : ''}`}>
        <Bell size={16} />
        {badge > 0 && <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span>}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <section className={styles.panel} aria-label="Notifications">
            <header className={styles.header}>
              <span className={styles.headerTitle}><Bell size={14} /> Notifications</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={() => markRead()}><Check size={13} /> Read all</button>}
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={14} /></button>
              </div>
            </header>
            <div className={styles.body}>
              {dueSoon.length > 0 && (
                <div className={styles.group}>
                  <div className={`${styles.groupLabel} ${styles.groupToday}`}><CalendarClock size={12} /> Assigned to you · due soon</div>
                  {dueSoon.map((card) => (
                    <button key={card.id} className={styles.item} style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => openBoard(card.board, card.id)}>
                      <div className={styles.itemTitle}>{card.title}</div>
                      <div className={styles.itemMeta}><span className={styles.itemBoard}>{card.board.title}</span><span className={styles.itemDate}>{dueLabel(card.dueDate)}</span></div>
                    </button>
                  ))}
                </div>
              )}

              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={styles.item}
                  style={{ width: '100%', border: 0, textAlign: 'left', background: notification.isRead ? 'transparent' : 'var(--accent-subtle)' }}
                  onClick={async () => { if (!notification.isRead) await markRead(notification.id); openBoard(notification.board, notification.cardId); }}
                >
                  <div className={styles.itemTitle} style={{ whiteSpace: 'normal', display: 'flex', gap: 8 }}>
                    {notification.type === 'invitation' ? <UserPlus size={14} /> : <MessageSquare size={14} />}
                    <span>{notification.message}</span>
                  </div>
                  <div className={styles.itemMeta}>{timeAgo(notification.createdAt)}</div>
                </button>
              ))}

              {!dueSoon.length && !notifications.length && <div className={styles.empty}><Bell size={24} /><p>You’re all caught up.</p></div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
