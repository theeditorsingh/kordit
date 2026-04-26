'use client';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useBoardContext } from '@/context/BoardContext';
import { Plus, Trash2, ChevronDown, LayoutGrid, Users, Edit2, Check, X, LayoutTemplate, LogOut } from 'lucide-react';
import MembersPanel from './MembersPanel';
import TemplateModal from './TemplateModal';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { state, activeBoard, dispatch, createBoard } = useBoardContext();
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
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
      dispatch({ type: 'DELETE_BOARD', boardId: id });
    }
  }

  const BOARD_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9'];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <LayoutGrid size={13} />
          <span>Boards</span>
        </div>

        <ul className={styles.boardList}>
          {state.boards.map((board, i) => (
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
                    if (session?.user?.username) {
                      router.push(`/${session.user.username}/${board.slug}`);
                    } else {
                      dispatch({ type: 'SET_ACTIVE_BOARD', boardId: board.id });
                    }
                  }}
                >
                  <span className={styles.boardDot} style={{ background: BOARD_COLORS[i % BOARD_COLORS.length] }} />
                  <span className={styles.boardTitle}>{board.title}</span>
                  <span className={styles.boardActions}>
                    <span className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); startEdit(board.id, board.title); }}>
                      <Edit2 size={12}/>
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
            <button className={styles.addBoardBtn} onClick={() => setAdding(true)} style={{ flex: 1 }}>
              <Plus size={14}/> New Board
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowTemplates(true)} title="Create from template" style={{ alignSelf: 'center' }}>
              <LayoutTemplate size={14} />
            </button>
          </div>
        )}
      </div>

      {activeBoard && (
        <div className={styles.section}>
          <button
            className={styles.sectionHeader}
            onClick={() => setShowMembers(!showMembers)}
            style={{ width: '100%', cursor: 'pointer' }}
          >
            <Users size={13}/>
            <span>Members ({activeBoard.members.length})</span>
            <ChevronDown size={12} style={{ marginLeft: 'auto', transform: showMembers ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
          </button>
          {showMembers && <MembersPanel board={activeBoard} />}
        </div>
      )}

      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} />}

      <div className={styles.logoutSection}>
        <button
          className={styles.logoutBtn}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
