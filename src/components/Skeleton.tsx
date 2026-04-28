'use client';
import React from 'react';
import styles from './Skeleton.module.css';

export function SkeletonText({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return <div className={styles.shimmer} style={{ width, height, borderRadius: 4 }} />;
}

export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <SkeletonText width="70%" height={13} />
        <div className={styles.dot} />
      </div>
      <SkeletonText width="90%" height={11} />
      <SkeletonText width="50%" height={11} />
      <div className={styles.cardFooter}>
        <div className={styles.badge} />
        <div className={styles.avatar} />
      </div>
    </div>
  );
}

export function SkeletonColumn() {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <SkeletonText width="55%" height={14} />
        <SkeletonText width={24} height={24} />
      </div>
      <div className={styles.cards}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div className={styles.board}>
      <SkeletonColumn />
      <SkeletonColumn />
      <SkeletonColumn />
    </div>
  );
}

export function SkeletonActivityItem() {
  return (
    <div className={styles.activityItem}>
      <div className={styles.activityIcon} />
      <div className={styles.activityContent}>
        <SkeletonText width="40%" height={11} />
        <SkeletonText width="75%" height={10} />
      </div>
      <div className={styles.activityTime} />
    </div>
  );
}

export function SkeletonActivityFeed() {
  return (
    <div className={styles.activityFeed}>
      <SkeletonActivityItem />
      <SkeletonActivityItem />
      <SkeletonActivityItem />
      <SkeletonActivityItem />
      <SkeletonActivityItem />
    </div>
  );
}

export function SkeletonCardModal() {
  return (
    <div className={styles.modalSkeleton}>
      <div className={styles.modalHeader}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className={styles.badge} />
          <div className={styles.badge} />
          <div className={styles.badge} />
        </div>
        <SkeletonText width={24} height={24} />
      </div>
      <div className={styles.modalBody}>
        <SkeletonText width="60%" height={20} />
        <div style={{ marginTop: 16 }}>
          <SkeletonText width="30%" height={12} />
          <div style={{ marginTop: 8 }}>
            <SkeletonText width="100%" height={60} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <SkeletonText width={80} height={30} />
          <SkeletonText width={100} height={30} />
          <SkeletonText width={80} height={30} />
        </div>
        <div style={{ marginTop: 16 }}>
          <SkeletonText width="25%" height={12} />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <SkeletonText width="80%" height={28} />
            <SkeletonText width="65%" height={28} />
            <SkeletonText width="90%" height={28} />
          </div>
        </div>
      </div>
      <div className={styles.modalFooter}>
        <SkeletonText width={100} height={32} />
        <SkeletonText width={120} height={32} />
      </div>
    </div>
  );
}

export function SkeletonListView() {
  return (
    <div className={styles.listSkeleton}>
      {[1, 2, 3].map((col) => (
        <div key={col} className={styles.listGroup}>
          <div className={styles.listGroupHeader}>
            <div className={styles.dot} />
            <SkeletonText width="30%" height={14} />
            <SkeletonText width={24} height={18} />
          </div>
          <div className={styles.listRows}>
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className={styles.listRow}>
                <div className={styles.dot} />
                <SkeletonText width={`${50 + Math.random() * 30}%`} height={12} />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <div className={styles.badge} />
                  <div className={styles.avatar} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
