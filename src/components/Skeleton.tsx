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
