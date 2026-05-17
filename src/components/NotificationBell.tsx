'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, X, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { useBoardContext } from '@/context/BoardContext';
import { getReminderItems, ReminderItem } from '@/hooks/useReminders';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const { state } = useBoardContext();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReminderItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Recompute reminders when boards change or panel opens
  useEffect(() => {
    setItems(getReminderItems(state.boards));
  }, [state.boards, open]);

  const overdue = items.filter(i => i.type === 'overdue');
  const dueToday = items.filter(i => i.type === 'due-today');
  const dueTomorrow = items.filter(i => i.type === 'due-tomorrow');
  const totalCount = items.length;

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{ position: 'relative' }}
      >
        <Bell size={16} />
        {totalCount > 0 && (
          <span className={styles.badge}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div className={styles.panel} ref={panelRef}>
            <div className={styles.header}>
              <span className={styles.headerTitle}>
                <Bell size={14} /> Notifications
              </span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <div className={styles.body}>
              {totalCount === 0 ? (
                <div className={styles.empty}>
                  <Bell size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p>All caught up! No upcoming tasks.</p>
                </div>
              ) : (
                <>
                  {overdue.length > 0 && (
                    <div className={styles.group}>
                      <div className={`${styles.groupLabel} ${styles.groupOverdue}`}>
                        <AlertTriangle size={12} /> Overdue ({overdue.length})
                      </div>
                      {overdue.map(item => (
                        <a
                          key={item.card.id}
                          className={styles.item}
                          href={`/${item.boardSlug}`}
                          onClick={() => setOpen(false)}
                        >
                          <div className={styles.itemTitle}>{item.card.title}</div>
                          <div className={styles.itemMeta}>
                            <span className={styles.itemBoard}>{item.boardTitle}</span>
                            <span className={styles.itemDate}>
                              <Calendar size={10} /> {formatDate(item.card.dueDate!)}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {dueToday.length > 0 && (
                    <div className={styles.group}>
                      <div className={`${styles.groupLabel} ${styles.groupToday}`}>
                        <Clock size={12} /> Due Today ({dueToday.length})
                      </div>
                      {dueToday.map(item => (
                        <a
                          key={item.card.id}
                          className={styles.item}
                          href={`/${item.boardSlug}`}
                          onClick={() => setOpen(false)}
                        >
                          <div className={styles.itemTitle}>{item.card.title}</div>
                          <div className={styles.itemMeta}>
                            <span className={styles.itemBoard}>{item.boardTitle}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {dueTomorrow.length > 0 && (
                    <div className={styles.group}>
                      <div className={`${styles.groupLabel} ${styles.groupTomorrow}`}>
                        <Calendar size={12} /> Due Tomorrow ({dueTomorrow.length})
                      </div>
                      {dueTomorrow.map(item => (
                        <a
                          key={item.card.id}
                          className={styles.item}
                          href={`/${item.boardSlug}`}
                          onClick={() => setOpen(false)}
                        >
                          <div className={styles.itemTitle}>{item.card.title}</div>
                          <div className={styles.itemMeta}>
                            <span className={styles.itemBoard}>{item.boardTitle}</span>
                            <span className={styles.itemDate}>
                              <Calendar size={10} /> {formatDate(item.card.dueDate!)}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
