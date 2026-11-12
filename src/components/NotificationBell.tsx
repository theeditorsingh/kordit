'use client';

import { useState } from 'react';
import { Bell, CalendarClock, Check, MessageSquare, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './NotificationBell.module.css';
import Link from 'next/link';
import { useNotifications, notificationHref, timeAgo, dueLabel, type InboxNotification, type DueSoon } from '@/hooks/useNotifications';

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Shared store: the Inbox page and sidebar badge read the same data (one poll)
  const { notifications, dueSoon, unread, badge, reload: load, markRead } = useNotifications();

  function openBoard(board: InboxNotification['board'] | DueSoon['board'], cardId?: string | null) {
    const href = notificationHref(board, cardId);
    if (!href) return;
    setOpen(false);
    router.push(href);
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
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Link href="/inbox" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>View all</Link>
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
