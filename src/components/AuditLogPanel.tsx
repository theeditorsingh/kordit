'use client';
import { useState, useEffect } from 'react';
import styles from './AuditLogPanel.module.css';

interface AuditEntry {
  id: string;
  action: string;
  target: string;
  details: Record<string, any>;
  createdAt: string;
  actor: { name: string | null; username: string | null; image: string | null };
}

interface Props {
  boardId: string;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  board_created:    { icon: '🗂️', label: 'Created board', color: '#36B37E' },
  board_updated:    { icon: '✏️', label: 'Updated board', color: '#0052CC' },
  board_archived:   { icon: '📦', label: 'Archived board', color: '#FF991F' },
  board_deleted:    { icon: '🗑️', label: 'Deleted board', color: '#FF5630' },
  member_invited:   { icon: '👤', label: 'Invited member', color: '#6554C0' },
  member_removed:   { icon: '🚫', label: 'Removed member', color: '#FF5630' },
  role_changed:     { icon: '🔑', label: 'Changed role', color: '#FF991F' },
  card_created:     { icon: '➕', label: 'Created card', color: '#36B37E' },
  card_moved:       { icon: '↔️', label: 'Moved card', color: '#0052CC' },
  card_deleted:     { icon: '🗑️', label: 'Deleted card', color: '#FF5630' },
  cards_bulk_deleted:{ icon: '🗑️', label: 'Bulk deleted cards', color: '#FF5630' },
  column_created:   { icon: '📋', label: 'Created column', color: '#36B37E' },
  comment_added:    { icon: '💬', label: 'Added comment', color: '#0052CC' },
  automation_created:{ icon: '⚡', label: 'Created automation', color: '#6554C0' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string | null, username: string | null) {
  const n = name || username || '?';
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AuditLogPanel({ boardId, onClose }: Props) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`/api/audit-log?boardId=${boardId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setLogs(d.logs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [boardId]);

  const filtered = filter === 'all'
    ? logs
    : logs.filter((l) => l.action.startsWith(filter));

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'card', label: 'Cards' },
    { key: 'member', label: 'Members' },
    { key: 'board', label: 'Board' },
    { key: 'column', label: 'Columns' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>🛡️</span>
            <div>
              <h2 className={styles.title}>Audit Log</h2>
              <p className={styles.subtitle}>Admin-only view of all board actions</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {categories.map((c) => (
            <button
              key={c.key}
              className={`${styles.filterBtn} ${filter === c.key ? styles.active : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div className={styles.list}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Loading audit log…</span>
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className={styles.empty}>No activity recorded for this filter.</p>
          )}
          {!loading && filtered.map((log) => {
            const meta = ACTION_LABELS[log.action] || { icon: '📝', label: log.action, color: '#8B949E' };
            const actor = log.actor;
            return (
              <div key={log.id} className={styles.entry}>
                <div className={styles.avatar} style={{ background: meta.color }}>
                  {initials(actor.name, actor.username)}
                </div>
                <div className={styles.entryBody}>
                  <span className={styles.entryActor}>
                    {actor.name || actor.username || 'System'}
                  </span>
                  <span className={styles.entryAction} style={{ color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  {log.details?.cardTitle && (
                    <span className={styles.entryDetail}>"{log.details.cardTitle}"</span>
                  )}
                </div>
                <span className={styles.entryTime}>{timeAgo(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
