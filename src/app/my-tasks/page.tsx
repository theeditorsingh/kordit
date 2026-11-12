'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import AppShell from '@/components/AppShell';
import { TaskRow } from '@/components/PageParts';
import { DUE_GROUPS, getAssignedOpenCards, groupByDue } from '@/utils/myTasks';
import styles from '@/components/Pages.module.css';

/** Every open card assigned to me, across all boards, grouped by when it's due. */
export default function MyTasksPage() {
  const { state } = useBoardContext();
  const { data: session } = useSession();
  const username = session?.user?.username;

  const items = useMemo(() => getAssignedOpenCards(state.boards, session?.user?.id), [state.boards, session?.user?.id]);
  const groups = useMemo(() => groupByDue(items), [items]);
  const boardCount = new Set(items.map((i) => i.board.id)).size;

  return (
    <AppShell noBoard>
      <div className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>My Tasks</h1>
              <p className={styles.pageSub}>
                {items.length} open task{items.length === 1 ? '' : 's'} assigned to you
                {boardCount > 0 && ` across ${boardCount} board${boardCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </header>

          {items.length === 0 ? (
            <div className={styles.panel}>
              <p className={styles.empty}>Nothing is assigned to you right now. Cards you&apos;re assigned to on any board show up here.</p>
            </div>
          ) : (
            DUE_GROUPS.filter((g) => groups[g.id].length > 0).map((g) => (
              <section key={g.id} className={styles.section} aria-labelledby={`mt-${g.id}`}>
                <h2 id={`mt-${g.id}`} className={styles.sectionTitle} style={g.id === 'overdue' ? { color: '#DE350B' } : undefined}>
                  {g.label} <span className={styles.sectionCount}>{groups[g.id].length}</span>
                </h2>
                <div className={styles.panel}>
                  {groups[g.id].map((item) => <TaskRow key={item.card.id} item={item} username={username} />)}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
