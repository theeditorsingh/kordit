'use client';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useBoardContext } from '@/context/BoardContext';
import {
  Plus, Trash2, ChevronDown, LayoutGrid, Users, Edit2, Check, X,
  LayoutTemplate, LogOut, Star, Archive, Activity, Zap
} from 'lucide-react';
import MembersPanel from './MembersPanel';
import TemplateModal from './TemplateModal';
import ActivityFeed from './ActivityFeed';
import AutomationPanel from './AutomationPanel';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { state, activeBoard, dispatch, createBoard, deleteBoard: contextDeleteBoard, toggleFavorite, archiveBoard } = useBoardContext();
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  function handleAdd() {
    if (!newBoardTitle.trim()) return;
    createBoard(newBoardTitle.trim());
    setNewBoardTitle('');
    setAdding(false);
  }

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditTitle(title);
  }

  function saveEdit(id: string) {
    if (editTitle.trim()) {
      dispatch({ type: 'UPDATE_BOARD_TITLE', boardId: id, title: editTitle.trim() });
    }
    setEditingId(null);
  }

  function deleteBoard(id: string) {
    if (confirm('Delete this board and all its cards?')) {
      contextDeleteBoard(id);
    }
  }

  function handleArchive(id: string) {
    if (confirm('Archive this board? It will be hidden from the sidebar.')) {
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

  return (
    <aside className={styles.sidebar} style={{ overflowY: 'hidden' }}>

      {/* Scrollable Boards Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '12px 8px 0 8px' }}>
          <div className={styles.sectionHeader}>
            <LayoutGrid size={13} />
            <span>Boards</span>
          </div>

          <ul className={styles.boardList}>
            {sortedBoards.map((board, i) => (
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
                  <button
                    className={`${styles.boardItem} ${board.id === state.activeBoardId ? styles.active : ''}`}
                    onClick={() => {
                      const targetUsername = board.ownerUsername || session?.user?.username;
                      if (targetUsername) {
                        router.push(`/${targetUsername}/${board.slug}`);
                      } else {
                        dispatch({ type: 'SET_ACTIVE_BOARD', boardId: board.id });
                      }
                    }}
                  >
                    <span className={styles.boardDot} style={{ background: BOARD_COLORS[i % BOARD_COLORS.length] }} />
                    <span className={styles.boardTitle}>{board.title}</span>
                    {board.isFavorite && <Star size={11} style={{ color: '#FFC400', fill: '#FFC400', flexShrink: 0 }} />}
                    <span className={styles.boardActions}>
                      <span className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); toggleFavorite(board.id); }} title={board.isFavorite ? 'Unfavorite' : 'Favorite'}>
                        <Star size={12} style={board.isFavorite ? { color: '#FFC400', fill: '#FFC400' } : {}} />
                      </span>
                      <span className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); startEdit(board.id, board.title); }}>
                        <Edit2 size={12}/>
                      </span>
                      <span className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleArchive(board.id); }} title="Archive">
                        <Archive size={12}/>
                      </span>
                      <span className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }}>
                        <Trash2 size={12}/>
                      </span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Sticky Add Board Button */}
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-surface)', padding: '12px 8px', zIndex: 5 }}>
          {adding ? (
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
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={styles.addBoardBtn} onClick={() => setAdding(true)} style={{ flex: 1, marginTop: 0 }}>
                <Plus size={14}/> New Board
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowTemplates(true)} title="Create from template" style={{ alignSelf: 'center', marginTop: 0 }}>
                <LayoutTemplate size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Sections */}
      {activeBoard && (
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

      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} />}
      {showAutomations && activeBoard && <AutomationPanel boardId={activeBoard.id} onClose={() => setShowAutomations(false)} />}
    </aside>
  );
}
