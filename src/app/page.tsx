'use client';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import AppShell from '@/components/AppShell';
import { BoardTile, NewWorkspaceTile, TaskRow, WorkspaceTile } from '@/components/PageParts';
import TemplatePicker from '@/components/TemplatePicker';
import { getAssignedOpenCards, groupByDue } from '@/utils/myTasks';
import styles from '@/components/Pages.module.css';

const DUE_PREVIEW = 8;

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Home: what's due for you, your boards and your workspaces. New users pick a template. */
export default function Home() {
  const { state, createBoard, workspaces, createWorkspace } = useBoardContext();
  const { data: session, status } = useSession();
  // Until the session is known we can't tell which tasks are yours (avoid flashing "0")
  const sessionLoading = status === 'loading';
  const router = useRouter();
  const username = session?.user?.username;
  const [addingWs, setAddingWs] = useState(false);
  const [wsName, setWsName] = useState('');

  const boards = state.boards.filter((b) => !b.isArchived);
  const due = useMemo(() => {
    const groups = groupByDue(getAssignedOpenCards(state.boards, session?.user?.id));
    return [...groups.overdue, ...groups.today, ...groups.week];
  }, [state.boards, session?.user?.id]);
  const favourites = boards.filter((b) => b.isFavorite);
  const others = boards.filter((b) => !b.isFavorite);

  async function addWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!wsName.trim()) return;
    const ws = await createWorkspace(wsName.trim());
    if (ws) { setWsName(''); setAddingWs(false); router.push(`/workspaces/${ws.slug}`); }
  }

  if (boards.length === 0) {
    return (
      <AppShell noBoard>
        <div className={styles.page}>
          <div style={{ maxWidth: '940px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>🎉</span>
              Welcome to Kordit!
              <span style={{ display: 'inline-block' }}>🎉</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Pick a template to see its board, then create it.</p>
            <TemplatePicker onUse={(tpl) => createBoard(tpl.title, tpl.columns)} />
          </div>
        </div>
      </AppShell>
    );
  }

  const firstName = (session?.user?.name || username || '').split(' ')[0];
  const now = new Date();

  return (
    <AppShell noBoard>
      <div className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>{greeting(now)}{firstName ? `, ${firstName}` : ''}</h1>
              <p className={styles.pageSub}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
          </header>

          <section className={styles.section} aria-labelledby="home-due">
            <div className={styles.sectionHead}>
              <h2 id="home-due" className={styles.sectionTitle}>
                Due for you {!sessionLoading && <span className={styles.sectionCount}>{due.length}</span>}
              </h2>
              <Link href="/my-tasks" className={styles.sectionLink}>All my tasks</Link>
            </div>
            <div className={styles.panel}>
              {sessionLoading
                ? <p className={styles.empty}>Loading…</p>
                : due.length === 0
                ? <p className={styles.empty}>Nothing assigned to you is due in the next 7 days.</p>
                : due.slice(0, DUE_PREVIEW).map((item) => <TaskRow key={item.card.id} item={item} username={username} />)}
            </div>
            {due.length > DUE_PREVIEW && (
              <Link href="/my-tasks" className={styles.sectionLink}>+{due.length - DUE_PREVIEW} more in My Tasks</Link>
            )}
          </section>

          {favourites.length > 0 && (
            <section className={styles.section} aria-labelledby="home-fav">
              <h2 id="home-fav" className={styles.sectionTitle}>Favourite boards</h2>
              <div className={styles.grid}>
                {favourites.map((b) => <BoardTile key={b.id} board={b} username={username} />)}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className={styles.section} aria-labelledby="home-boards">
              <h2 id="home-boards" className={styles.sectionTitle}>{favourites.length ? 'Other boards' : 'Boards'}</h2>
              <div className={styles.grid}>
                {others.map((b) => <BoardTile key={b.id} board={b} username={username} />)}
              </div>
            </section>
          )}

          <section className={styles.section} aria-labelledby="home-ws">
            <h2 id="home-ws" className={styles.sectionTitle}>Workspaces</h2>
            {addingWs && (
              <form className={styles.inlineForm} onSubmit={addWorkspace}>
                <input className="input" autoFocus placeholder="Workspace name" value={wsName} maxLength={60}
                  onChange={(e) => setWsName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setAddingWs(false); }} />
                <button className="btn btn-primary btn-sm" type="submit">Create</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAddingWs(false)}>Cancel</button>
              </form>
            )}
            <div className={styles.grid}>
              {workspaces.map((ws) => <WorkspaceTile key={ws.id} workspace={ws} />)}
              {!addingWs && <NewWorkspaceTile onClick={() => setAddingWs(true)} />}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
