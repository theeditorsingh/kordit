'use client';
import { FormEvent, use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useBoardContext } from '@/context/BoardContext';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import WorkspaceMembers from '@/components/WorkspaceMembers';
import { BoardTile, WorkspaceBadge } from '@/components/PageParts';
import { useConfirm } from '@/components/ConfirmDialog';
import styles from '@/components/Pages.module.css';

/** A workspace: its boards and its members. Owner/Admin can rename; the Owner can delete. */
export default function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { data: session } = useSession();
  const { state, workspaces, workspacesLoaded, createBoard, renameWorkspace, deleteWorkspace } = useBoardContext();
  const [tab, setTab] = useState<'boards' | 'members'>('boards');
  const [addingBoard, setAddingBoard] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  const workspace = workspaces.find((w) => w.slug === slug);

  if (!workspace) {
    return (
      <AppShell noBoard>
        <div className={styles.page}>
          {workspacesLoaded
            ? <EmptyState variant="no-results" title="Workspace not found" description="It may have been deleted, or you're not a member of it." />
            : <p className={styles.empty}>Loading workspace…</p>}
        </div>
      </AppShell>
    );
  }

  const ws = workspace;
  const canManage = ws.role === 'Owner' || ws.role === 'Admin';
  const boards = state.boards.filter((b) => b.workspaceId === ws.id && !b.isArchived);

  async function addBoard(event: FormEvent) {
    event.preventDefault();
    if (!boardTitle.trim()) return;
    await createBoard(boardTitle.trim(), undefined, ws.id); // opens the new board
    setBoardTitle('');
    setAddingBoard(false);
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (next && next !== ws.name) await renameWorkspace(ws.id, next);
    setRenaming(false);
  }

  async function remove() {
    const ok = await confirm(
      `Delete "${ws.name}"? Its ${boards.length} board${boards.length === 1 ? '' : 's'} will be kept (without a workspace), and everyone keeps access to boards they're a member of.`,
      { title: 'Delete workspace', confirmLabel: 'Delete workspace' },
    );
    if (ok && (await deleteWorkspace(ws.id))) router.push('/');
  }

  return (
    <AppShell noBoard>
      <div className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.pageHeader}>
            <div className={styles.wsHeader}>
              <WorkspaceBadge name={ws.name} large />
              <div className={styles.wsTitle}>
                {renaming ? (
                  <form className={styles.inlineForm} onSubmit={saveName}>
                    <input className="input" autoFocus value={name} maxLength={60} aria-label="Workspace name"
                      onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(false); }} />
                    <button className="btn btn-primary btn-sm" type="submit">Save</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRenaming(false)}>Cancel</button>
                  </form>
                ) : (
                  <h1 className={styles.pageTitle}>{ws.name}</h1>
                )}
                <p className={styles.pageSub}>
                  {ws.role} · {ws.memberCount} member{ws.memberCount === 1 ? '' : 's'} · {boards.length} board{boards.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className={styles.headerActions}>
              {canManage && !renaming && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setName(ws.name); setRenaming(true); }}>
                  <Edit2 size={14} /> Rename
                </button>
              )}
              {ws.role === 'Owner' && (
                <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={14} /> Delete</button>
              )}
            </div>
          </header>

          <div className={styles.tabs} role="tablist" aria-label="Workspace sections">
            {(['boards', 'members'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                {t === 'boards' ? `Boards (${boards.length})` : 'Members'}
              </button>
            ))}
          </div>

          {tab === 'boards' ? (
            <section className={styles.section} aria-label="Boards in this workspace">
              {addingBoard && (
                <form className={styles.inlineForm} onSubmit={addBoard}>
                  <input className="input" autoFocus placeholder="Board name" value={boardTitle} maxLength={200}
                    onChange={(e) => setBoardTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setAddingBoard(false); }} />
                  <button className="btn btn-primary btn-sm" type="submit">Create board</button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAddingBoard(false)}>Cancel</button>
                </form>
              )}
              <div className={styles.grid}>
                {boards.map((b) => <BoardTile key={b.id} board={b} username={session?.user?.username} />)}
                {!addingBoard && (
                  <button className={`${styles.wsTile} ${styles.wsTileNew}`} onClick={() => setAddingBoard(true)}>
                    <Plus size={16} /> New board here
                  </button>
                )}
              </div>
              {boards.length === 0 && !addingBoard && (
                <p className={styles.pageSub}>No boards yet. Create one here, or move an existing board in from its ⋯ menu in the sidebar.</p>
              )}
            </section>
          ) : (
            <section className={styles.panel} style={{ padding: 0 }} aria-label="Members">
              <WorkspaceMembers workspaceId={ws.id} />
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
