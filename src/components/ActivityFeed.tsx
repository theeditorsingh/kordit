'use client';
import { useState, useEffect } from 'react';
import { Activity } from '@/types';
import { getInitials } from '@/utils/storage';
import EmptyState from './EmptyState';
import {
  ArrowRight, Plus, Trash2, UserPlus, Edit2, MessageSquare,
  Layout, Columns, Zap, Clock
} from 'lucide-react';
import styles from './ActivityFeed.module.css';

interface Props {
  boardId: string;
}

const ACTION_CONFIG: Record<string, { icon: any; verb: string; color: string }> = {
  card_created: { icon: Plus, verb: 'created card', color: '#36B37E' },
  card_moved: { icon: ArrowRight, verb: 'moved card', color: '#0052CC' },
  card_updated: { icon: Edit2, verb: 'updated card', color: '#FF991F' },
  card_deleted: { icon: Trash2, verb: 'deleted card', color: '#FF5630' },
  cards_bulk_deleted: { icon: Trash2, verb: 'bulk deleted cards', color: '#FF5630' },
  column_created: { icon: Columns, verb: 'created column', color: '#36B37E' },
  member_invited: { icon: UserPlus, verb: 'invited', color: '#6554C0' },
  comment_added: { icon: MessageSquare, verb: 'commented on', color: '#00B8D9' },
  board_created: { icon: Layout, verb: 'created board', color: '#36B37E' },
  board_updated: { icon: Edit2, verb: 'updated board', color: '#FF991F' },
  board_archived: { icon: Layout, verb: 'archived board', color: '#FF5630' },
  automation_created: { icon: Zap, verb: 'created automation', color: '#6554C0' },
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ boardId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/activities?boardId=${boardId}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000);
    return () => clearInterval(interval);
  }, [boardId]);

  if (loading) {
    return <div className={styles.loading}><Clock size={14} /> Loading activity...</div>;
  }

  if (activities.length === 0) {
    return <EmptyState variant="no-activity" />;
  }

  return (
    <div className={styles.feed}>
      {activities.map((activity) => {
        const config = ACTION_CONFIG[activity.action] || { icon: Edit2, verb: activity.action, color: '#8B949E' };
        const Icon = config.icon;
        const details = activity.details || {};

        return (
          <div key={activity.id} className={styles.item}>
            <div className={styles.iconWrap} style={{ background: `${config.color}20`, color: config.color }}>
              <Icon size={12} />
            </div>
            <div className={styles.content}>
              <span className={styles.userName}>{activity.user?.name || activity.user?.username || 'User'}</span>
              {' '}{config.verb}{' '}
              {details.cardTitle && <span className={styles.target}>"{details.cardTitle}"</span>}
              {details.columnTitle && <span className={styles.target}>"{details.columnTitle}"</span>}
              {details.email && <span className={styles.target}>{details.email}</span>}
              {details.fromColumn && details.toColumn && (
                <span className={styles.detail}> from {details.fromColumn} to {details.toColumn}</span>
              )}
              {details.boardTitle && <span className={styles.target}>"{details.boardTitle}"</span>}
              {details.name && <span className={styles.target}>"{details.name}"</span>}
            </div>
            <span className={styles.time}>{timeAgo(activity.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
