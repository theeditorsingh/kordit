'use client';
import { useState, useEffect, useRef } from 'react';
import { Activity } from '@/types';
import { getInitials } from '@/utils/storage';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from './EmptyState';
import { SkeletonActivityFeed } from './Skeleton';
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

const itemVariants = {
  hidden: { opacity: 0, x: -16, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
  exit: {
    opacity: 0,
    x: -12,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const newItemHighlight = {
  initial: { boxShadow: '0 0 0 0 rgba(0, 82, 204, 0)' },
  pulse: {
    boxShadow: [
      '0 0 0 0 rgba(0, 82, 204, 0.3)',
      '0 0 8px 2px rgba(0, 82, 204, 0.15)',
      '0 0 0 0 rgba(0, 82, 204, 0)',
    ],
    transition: { duration: 1.5, ease: 'easeOut' as const },
  },
};

export default function ActivityFeed({ boardId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/activities?boardId=${boardId}`);
        if (res.ok) {
          const data = await res.json();
          const incoming = new Set<string>(data.map((a: Activity) => a.id));
          const freshIds = new Set<string>();
          if (prevIdsRef.current.size > 0) {
            incoming.forEach((id) => {
              if (!prevIdsRef.current.has(id)) freshIds.add(id);
            });
          }
          prevIdsRef.current = incoming;
          if (freshIds.size > 0) {
            setNewIds(freshIds);
            setTimeout(() => setNewIds(new Set()), 2000);
          }
          setActivities(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();

    if (supabase) {
      const channel = supabase
        .channel(`activity-${boardId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Activity', filter: `boardId=eq.${boardId}` }, () => {
          fetchActivities();
        })
        .subscribe();
      return () => { supabase?.removeChannel(channel); };
    } else {
      const intervalId = setInterval(fetchActivities, 15000);
      return () => clearInterval(intervalId);
    }
  }, [boardId]);

  if (loading) {
    return <SkeletonActivityFeed />;
  }

  if (activities.length === 0) {
    return <EmptyState variant="no-activity" />;
  }

  return (
    <div className={styles.feed}>
      <AnimatePresence mode="popLayout">
        {activities.map((activity, index) => {
          const config = ACTION_CONFIG[activity.action] || { icon: Edit2, verb: activity.action, color: '#8B949E' };
          const Icon = config.icon;
          const details = activity.details || {};
          const isNew = newIds.has(activity.id);

          return (
            <motion.div
              key={activity.id}
              className={`${styles.item} ${isNew ? styles.itemNew : ''}`}
              custom={index}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <motion.div
                className={styles.iconWrap}
                style={{ background: `${config.color}20`, color: config.color }}
                variants={isNew ? newItemHighlight : undefined}
                initial="initial"
                animate={isNew ? 'pulse' : 'initial'}
              >
                <Icon size={12} />
              </motion.div>
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
