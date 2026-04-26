'use client';
import { useState } from 'react';
import { Board } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { Plus, X } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import styles from './MembersPanel.module.css';

export default function MembersPanel({ board }: { board: Board }) {
  const { dispatch, addMember } = useBoardContext();
  const [name, setName] = useState('');

  function handleAdd() {
    if (!name.trim()) return;
    addMember(board.id, name.trim());
    setName('');
  }

  return (
    <div className={styles.panel}>
      <ul className={styles.list}>
        {board.members.map((m) => (
          <li key={m.id} className={styles.member}>
            <span className="avatar avatar-sm" style={{ background: m.color }}>{getInitials(m.name)}</span>
            <span className={styles.name}>{m.name}</span>
            <button
              className={styles.remove}
              onClick={() => dispatch({ type: 'REMOVE_MEMBER', boardId: board.id, memberId: m.id })}
              title="Remove member"
            >
              <X size={11}/>
            </button>
          </li>
        ))}
        {board.members.length === 0 && (
          <li className={styles.empty}>No members yet</li>
        )}
      </ul>

      <div className={styles.addRow}>
        <input
          className="input"
          style={{ fontSize: 12, padding: '6px 10px' }}
          placeholder="Add member name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button className="btn btn-primary btn-sm btn-icon" onClick={handleAdd} title="Add">
          <Plus size={14}/>
        </button>
      </div>
    </div>
  );
}
