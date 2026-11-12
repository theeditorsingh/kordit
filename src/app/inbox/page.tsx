'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CalendarClock, Check, MessageSquare, UserPlus, AtSign, UserCheck } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useNotifications, notificationHref, timeAgo, dueLabel, type InboxNotification } from '@/hooks/useNotifications';
import styles from '@/components/Pages.module.css';

const ICONS = { assignment: UserCheck, comment: MessageSquare, mention: AtSign, invitation: UserPlus } as const;

/** Full-page notifications: the same data as the bell, with All / Unread filters. */
export default function InboxPage() {
  const router = useRouter();
  const { notifications, dueSoon, unread, loaded, markRead } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const shown = tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  async function open(n: InboxNotification) {
    if (!n.isRead) await markRead(n.id);
    const href = notificationHref(n.board, n.cardId);
    if (href) router.push(href);
  }

  return (
    <AppShell noBoard>
      <div className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Inbox</h1>
              <p className={styles.pageSub}>{unread ? `${unread} unread` : 'You’re all caught up'}</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.tabs} role="tablist" aria-label="Filter notifications">
                {(['all', 'unread'] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                    {t === 'all' ? 'All' : `Unread${unread ? ` (${unread})` : ''}`}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => markRead()} disabled={!unread}>
                <Check size={14} /> Mark all as read
              </button>
            </div>
          </header>

          {dueSoon.length > 0 && (
            <section className={styles.section} aria-labelledby="inbox-due">
              <h2 id="inbox-due" className={styles.sectionTitle}>
                <CalendarClock size={16} /> Assigned to you · due soon <span className={styles.sectionCount}>{dueSoon.length}</span>
              </h2>
              <div className={styles.panel}>
                {dueSoon.map((card) => {
                  const href = notificationHref(card.board, card.id);
                  return (
                    <button key={card.id} className={styles.row} style={{ width: '100%' }} onClick={() => href && router.push(href)}>
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>{card.title}</span>
                        <span className={styles.rowMeta}>{card.board.title}</span>
                      </span>
                      <span className={`${styles.due} ${dueLabel(card.dueDate).includes('overdue') ? 'overdue' : ''}`}>{dueLabel(card.dueDate)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className={styles.section} aria-labelledby="inbox-list">
            <h2 id="inbox-list" className={styles.sectionTitle}><Bell size={16} /> Notifications</h2>
            <div className={styles.panel}>
              {!loaded ? (
                <p className={styles.empty}>Loading…</p>
              ) : shown.length === 0 ? (
                <p className={styles.empty}>{tab === 'unread' ? 'No unread notifications.' : 'No notifications yet. Assignments, comments, mentions and invitations show up here.'}</p>
              ) : (
                shown.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <button key={n.id} className={`${styles.row} ${n.isRead ? '' : styles.rowUnread}`} style={{ width: '100%' }} onClick={() => open(n)}>
                      <span className={styles.rowIcon}><Icon size={15} /></span>
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle} style={{ fontWeight: n.isRead ? 400 : 600 }}>{n.message}</span>
                        <span className={styles.rowMeta}>
                          {n.board?.title && <>{n.board.title} · </>}{timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.isRead && <span className={styles.unreadDot} aria-label="Unread" />}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
