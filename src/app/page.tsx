'use client';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import AppShell from '@/components/AppShell';
import { BoardTile, NewWorkspaceTile, TaskRow, WorkspaceTile } from '@/components/PageParts';
import { TEMPLATES } from '@/utils/templates';
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
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>🎉</span>
              Welcome to Kordit!
              <span style={{ display: 'inline-block' }}>🎉</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Get started by choosing a template below.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', textAlign: 'left' }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => createBoard(tpl.title, tpl.columns)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-card, var(--bg-surface))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    height: '110px',
                    textAlign: 'left',
                    padding: 0,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ width: '100%', height: '35%', backgroundColor: tpl.color, opacity: 0.9, borderRadius: '16px 16px 0 0' }} />
                  <div style={{ padding: '10px 14px', width: '100%', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{tpl.title}</span>
                  </div>
                </button>
              ))}
            </div>
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
