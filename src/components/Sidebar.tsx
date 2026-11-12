'use client';
import { useState } from 'react';
const VISIBLE_BOARDS = 8; // the rest sit behind "Show more"
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { workspaceInitial, workspaceTileColor } from '@/utils/workspaceTile';
import { useBoardContext } from '@/context/BoardContext';
import { useConfirm } from './ConfirmDialog';
import {
  Plus, Trash2, ChevronDown, ChevronsLeft, ChevronsRight, Users, Edit2, Check, X,
  LayoutTemplate, Star, Archive, Activity, Home, CheckSquare, Inbox
} from 'lucide-react';
import MembersPanel from './MembersPanel';
import TemplateModal from './TemplateModal';
import ActivityFeed from './ActivityFeed';
import AutomationPanel from './AutomationPanel';
import ArchivedBoardsModal from './ArchivedBoardsModal';
import styles from './Sidebar.module.css';
import { getBoardBackgroundStyle } from '@/utils/boardBackground';

export default function Sidebar({ isMobileOpen, onClose }: { isMobileOpen?: boolean; onClose?: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { state, activeBoard, dispatch, createBoard, deleteBoard: contextDeleteBoard, toggleFavorite, archiveBoard, updateBoard,
    workspaces, createWorkspace, moveBoardToWorkspace } = useBoardContext();
  const pathname = usePathname();
  const { unread } = useNotifications();
  const [addingWs, setAddingWs] = useState(false);
  const [wsName, setWsName] = useState('');
  const confirm = useConfirm();
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllBoards, setShowAllBoards] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kordit-sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Opening the mobile drawer always reveals its labels, regardless of desktop preference.
  const isCollapsed = collapsed && !isMobileOpen;

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('kordit-sidebar-collapsed', String(next));
      return next;
    });
  }

  function handleAdd() {
    if (!newBoardTitle.trim()) return;
    createBoard(newBoardTitle.trim());
    setNewBoardTitle('');
    setAdding(false);
  }

  async function handleAddWorkspace() {
    const name = wsName.trim();
    if (!name) return;
    const ws = await createWorkspace(name);
    if (ws) {
      setWsName('');
      setAddingWs(false);
      router.push(`/workspaces/${ws.slug}`);
      onClose?.();
    }
  }

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditTitle(title);
  }

  function saveEdit(id: string) {
    const title = editTitle.trim();
    const current = state.boards.find((b) => b.id === id)?.title;
    if (title && title !== current) {
      updateBoard(id, { title });
    }
    setEditingId(null);
  }

  async function deleteBoard(id: string) {
    const title = state.boards.find((b) => b.id === id)?.title ?? 'this board';
    if (await confirm(`Delete "${title}" and all its cards? This cannot be undone.`, { title: 'Delete board' })) {
      contextDeleteBoard(id);
    }
  }

  async function handleArchive(id: string) {
    if (await confirm('Archive this board? It will be hidden from the sidebar. You can restore it from Archived Boards.', { title: 'Archive board', confirmLabel: 'Archive', danger: false })) {
      archiveBoard(id);
    }
  }

  const BOARD_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9'];

  // Sort: favorites first, then by created date
  const sortedBoards = [...state.boards].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return 0;
  });

  // First VISIBLE_BOARDS boards, always including the active one; the rest behind "Show more"
  const indexed = sortedBoards.map((board, i) => ({ board, i }));
  const firstSlice = indexed.slice(0, VISIBLE_BOARDS);
  const activeHidden = indexed.slice(VISIBLE_BOARDS).find(({ board }) => board.id === state.activeBoardId);
  const visibleBoards = showAllBoards || isCollapsed ? indexed : activeHidden ? [...firstSlice, activeHidden] : firstSlice;
  const hiddenCount = Math.max(0, sortedBoards.length - VISIBLE_BOARDS - (activeHidden ? 1 : 0));

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 198 }}
          onClick={onClose}
        />
      )}
      <aside
        className={`${styles.sidebar} ${isMobileOpen ? styles.mobileOpen : ''} ${isCollapsed ? styles.collapsed : ''}`}
        style={{ overflowY: 'hidden' }}
        id="sidebar-boards-section"
      >


      {/* Scrollable Boards Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '12px 8px 0 8px' }}>
          {/* Primary navigation */}
          <nav aria-label="Main" className={styles.navList}>
            {[
              { href: '/', label: 'Home', icon: <Home size={17} />, badge: 0 },
              { href: '/my-tasks', label: 'My Tasks', icon: <CheckSquare size={17} />, badge: 0 },
              { href: '/inbox', label: 'Inbox', icon: <Inbox size={17} />, badge: unread },
            ].map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => onClose?.()}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {item.badge > 0 && (
                    <span className={`${styles.navBadge} ${isCollapsed ? styles.navBadgeDot : ''}`} aria-label={`${item.badge} unread`}>
                      {isCollapsed ? '' : item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Workspaces */}
          <div className={styles.boardsHeader}>
            {!isCollapsed && <span className={styles.boardsHeading}>Workspaces</span>}
            <button
              className={styles.headerAddBtn}
              onClick={() => { if (isCollapsed) toggleCollapsed(); setAddingWs(true); }}
              title="New workspace"
              aria-label="New workspace"
            >
              <Plus size={16} />
            </button>
          </div>
          {addingWs && !isCollapsed && (
            <div className={styles.addForm}>
              <input
                className="input"
                placeholder="Workspace name..."
                value={wsName}
                maxLength={60}
                onChange={(e) => setWsName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddWorkspace(); if (e.key === 'Escape') setAddingWs(false); }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAddWorkspace}>Create</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingWs(false)}>Cancel</button>
              </div>
            </div>
          )}
          <ul className={styles.boardList} style={{ marginBottom: 14 }}>
            {workspaces.map((ws) => {
              const href = `/workspaces/${ws.slug}`;
              const active = pathname === href;
              return (
                <li key={ws.id}>
                  <Link
                    href={href}
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={isCollapsed ? ws.name : undefined}
                    onClick={() => onClose?.()}
                  >
                    <span className={styles.wsTile} style={{ background: workspaceTileColor(ws.name) }} aria-hidden="true">{workspaceInitial(ws.name)}</span>
                    {!isCollapsed && <span className={styles.navLabel}>{ws.name}</span>}
                  </Link>
                </li>
              );
            })}
            {workspaces.length === 0 && !isCollapsed && !addingWs && (
              <li className={styles.navHint}>Group boards and teammates into a workspace.</li>
            )}
          </ul>

          <div className={styles.boardsHeader}>
            {!isCollapsed && <span className={styles.boardsHeading}>Boards</span>}
            <button
              className={styles.headerAddBtn}
              onClick={() => { if (isCollapsed) toggleCollapsed(); setAdding(true); }}
              title="New board"
              aria-label="New board"
              id="btn-new-board"
            >
              <Plus size={16} />
            </button>
          </div>
          {adding && !isCollapsed && (
            <div className={styles.addForm}>
              <input
                className="input"
                placeholder="Board name..."
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          )}

          <ul className={styles.boardList}>
            {visibleBoards.map(({ board, i }) => (
              <li key={board.id}>
                {editingId === board.id ? (
                  <div className={styles.editRow}>
                    <input
                      className={`input ${styles.editInput}`}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(board.id); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                    />
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => saveEdit(board.id)}><Check size={13}/></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingId(null)}><X size={13}/></button>
                  </div>
                ) : (
                  <div
                    className={`${styles.boardItem} ${board.id === state.activeBoardId ? styles.active : ''}`}
                  >
                  <button className={styles.boardLink} title={board.title} aria-current={board.id === state.activeBoardId ? 'page' : undefined}
                    onClick={() => {
                      const targetUsername = board.ownerUsername || session?.user?.username;
                      if (targetUsername) {
                        router.push(`/${targetUsername}/${board.slug}`);
                      } else {
                        dispatch({ type: 'SET_ACTIVE_BOARD', boardId: board.id });
                      }
                      onClose?.();
                    }}
                  >
                    <span className={styles.boardDot} style={{ background: getBoardBackgroundStyle(board).background ?? BOARD_COLORS[i % BOARD_COLORS.length] }} />
                    {!isCollapsed && <span className={styles.boardTitle}>{board.title}</span>}
                    {!isCollapsed && board.isFavorite && <Star size={11} style={{ color: '#FFC400', fill: '#FFC400', flexShrink: 0 }} />}
                  </button>
                    {!isCollapsed && (
                      <details className={styles.boardActions}><summary aria-label={`Actions for ${board.title}`}>...</summary><div className={styles.boardActionMenu}>
                        <span className={styles.actionBtn} role="button" tabIndex={0} aria-label={board.isFavorite ? 'Remove from favourites' : 'Add to favourites'} title={board.isFavorite ? 'Unfavorite' : 'Favorite'} onClick={(e) => { e.stopPropagation(); toggleFavorite(board.id); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFavorite(board.id); } }}>
                          <Star size={12} style={board.isFavorite ? { color: '#FFC400', fill: '#FFC400' } : {}} />
                        </span>
                        <span className={styles.actionBtn} role="button" tabIndex={0} aria-label="Rename board" title="Rename board" onClick={(e) => { e.stopPropagation(); startEdit(board.id, board.title); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startEdit(board.id, board.title); } }}>
                          <Edit2 size={12}/>
                        </span>
                        <span className={styles.actionBtn} role="button" tabIndex={0} aria-label="Archive board" title="Archive board" onClick={(e) => { e.stopPropagation(); handleArchive(board.id); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleArchive(board.id); } }}>
                          <Archive size={12}/>
                        </span>
                        {workspaces.length > 0 && board.members.some((m) => m.id === session?.user?.id && m.role === 'Admin') && (
                          <select
                            className={styles.wsSelect}
                            aria-label={`Workspace for ${board.title}`}
                            title="Move to workspace"
                            value={board.workspaceId ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => moveBoardToWorkspace(board.id, e.target.value || null)}
                          >
                            <option value="">No workspace</option>
                            {workspaces.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                          </select>
                        )}
                        <span className={styles.actionBtn} role="button" tabIndex={0} aria-label="Delete board" title="Delete board" onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deleteBoard(board.id); } }}>
                          <Trash2 size={12}/>
                        </span>
                      </div></details>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!isCollapsed && hiddenCount > 0 && (
            <button className={styles.showMore} onClick={() => setShowAllBoards(!showAllBoards)} aria-expanded={showAllBoards}>
              {showAllBoards ? 'Show less' : `Show more (${hiddenCount})`}
              <ChevronDown size={14} style={{ transform: showAllBoards ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
          {!isCollapsed && (
            <div className={styles.boardLinks}>
              <button className={styles.boardLinkMuted} onClick={() => setShowTemplates(true)}>
                <LayoutTemplate size={14} /> Templates
              </button>
              <button className={styles.boardLinkMuted} onClick={() => setShowArchived(true)}>
                <Archive size={14} /> Archived boards
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Fixed Bottom Sections — hidden when collapsed */}
      {activeBoard && !isCollapsed && (
        <>
          {/* Activity Feed Toggle */}
          <div
            className={styles.section}
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
          >
            <button
              className={styles.sectionHeader}
              onClick={() => setShowActivity(!showActivity)}
              style={{ width: '100%', cursor: 'pointer', marginBottom: 0 }}
            >
              <Activity size={13}/>
              <span>Activity</span>
              <ChevronDown size={12} style={{ marginLeft: 'auto', transform: showActivity ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
            </button>
            {showActivity && (
              <div style={{ marginTop: '8px' }}>
                <ActivityFeed boardId={activeBoard.id} />
              </div>
            )}
          </div>

          {/* Members */}
          <div
            className={styles.section}
            style={{
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: 'none',
              background: 'var(--bg-surface)',
              zIndex: 10
            }}
          >
            <button
              className={styles.sectionHeader}
              onClick={() => setShowMembers(!showMembers)}
              style={{ width: '100%', cursor: 'pointer', marginBottom: 0 }}
            >
              <Users size={13}/>
              <span>Members ({activeBoard.members.length})</span>
              <ChevronDown size={12} style={{ marginLeft: 'auto', transform: showMembers ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
            </button>
            {showMembers && (
              <div style={{ marginTop: '12px' }}>
                <MembersPanel board={activeBoard} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapse toggle — desktop only, bottom-left */}
      <div className={styles.collapseRow}>
        <button
          className={styles.collapseBtn}
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} />}
      {showArchived && <ArchivedBoardsModal onClose={() => setShowArchived(false)} />}
      {showAutomations && activeBoard && <AutomationPanel boardId={activeBoard.id} onClose={() => setShowAutomations(false)} />}
    </aside>
    </>
  );
}
