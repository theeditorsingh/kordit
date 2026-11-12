'use client';
import { useState, useRef } from 'react';
import { Board, Card } from '@/types';
import { cardMatchesSearch } from '@/utils/search';
import { useBoardContext } from '@/context/BoardContext';
import { getInitials } from '@/utils/storage';
import { Plus, CheckSquare2 } from 'lucide-react';
import dynamic from 'next/dynamic';
const CardModal = dynamic(() => import('./CardModal'), { ssr: false });
import styles from './TableView.module.css';

interface Props {
  board: Board;
  search: string;
  cardFilter?: (card: Card) => boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = (date.getTime() - now.getTime()) / 86400000;
  if (Math.abs(diff) < 1 && date.toDateString() === now.toDateString()) return 'Today';
  if (diff >= 0 && diff < 1) return 'Tomorrow';
  if (diff < 0 && diff > -1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function getDueDateStatus(date: string | null): '' | 'overdue' | 'due-soon' | 'due-today' {
  if (!date) return '';
  const diff = (new Date(date).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  if (diff <= 2) return 'due-soon';
  return '';
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#FF5630',
  high:   '#FF991F',
  medium: '#0052CC',
  low:    '#36B37E',
  none:   'transparent',
};

// ── component ────────────────────────────────────────────────────────────────

export default function TableView({ board, search, cardFilter }: Props) {
  const { createCard } = useBoardContext();
  const [selectedCard, setSelectedCard] = useState<{ card: Card; colId: string } | null>(null);
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all cards into rows, preserving column info
  const rows: { card: Card; colId: string; colTitle: string; colColor: string }[] = [];
  for (const col of board.columns) {
    for (const cardId of col.cardIds) {
      const card = board.cards[cardId];
      if (!card) continue;
      if (!cardMatchesSearch(card, search)) continue;
      if (cardFilter && !cardFilter(card)) continue;
      rows.push({ card, colId: col.id, colTitle: col.title, colColor: col.color });
    }
  }

  function handleAddCard(colId: string) {
    const title = newCardTitle.trim();
    if (!title) { cancelAdd(); return; }
    createCard(board.id, colId, title);
    setNewCardTitle('');
    setAddingToCol(null);
  }

  function cancelAdd() {
    setNewCardTitle('');
    setAddingToCol(null);
  }

  function startAdding(colId: string) {
    setAddingToCol(colId);
    setNewCardTitle('');
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  const isDone = (card: Card) => {
    const col = board.columns.find(c => c.cardIds.includes(card.id));
    if (!col) return false;
    const title = col.title.toLowerCase();
    return title === 'done' || title === 'completed' || title === 'closed';
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.mobileList}>
        {rows.length === 0 && <p className={styles.emptyCell}>{search || cardFilter ? 'No cards match these filters.' : 'No cards on this board yet.'}</p>}
        {rows.map(({card, colId, colTitle}) => <article key={card.id} className={styles.mobileRow}>
          <button className={styles.mobileTitle} onClick={() => setSelectedCard({card, colId})}>{card.title}</button>
          <div className={styles.mobileMeta}><span>{colTitle}</span><span>{card.dueDate ? formatDate(card.dueDate) : 'No due date'}</span></div>
          <details><summary>Details</summary><p>Priority: {card.priority}</p><p>Labels: {card.labels.map(label => label.name).join(', ') || 'None'}</p><p>Assignees: {board.members.filter(member => card.assigneeIds.includes(member.id)).map(member => member.name).join(', ') || 'Unassigned'}</p><p>Checklist: {card.checklist.filter(item => item.done).length}/{card.checklist.length}</p></details>
        </article>)}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th className={`${styles.th} ${styles.colCard}`}>Card</th>
              <th className={`${styles.th} ${styles.colList}`}>List</th>
              <th className={`${styles.th} ${styles.colLabels}`}>Labels</th>
              <th className={`${styles.th} ${styles.colMembers}`}>Members</th>
              <th className={`${styles.th} ${styles.colDue}`}>Due date</th>
              <th className={`${styles.th} ${styles.colChecklist}`}>
                <CheckSquare2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  {search ? `No cards match "${search}"` : cardFilter ? 'No cards match these filters.' : 'No cards on this board yet.'}
                </td>
              </tr>
            ) : (
              rows.map(({ card, colId, colTitle, colColor }) => {
                const dueSt = getDueDateStatus(card.dueDate ?? null);
                const done = isDone(card);
                const assignees = (card.assigneeIds as string[]).map(id =>
                  board.members.find(m => m.id === id)
                ).filter((member): member is NonNullable<typeof member> => Boolean(member));
                const checkDone = card.checklist.filter((c) => c.done).length;
                const checkTotal = card.checklist.length;
                const allChecked = checkTotal > 0 && checkDone === checkTotal;

                return (
                  <tr
                    key={card.id}
                    className={styles.row}
                    onClick={() => setSelectedCard({ card, colId })}
                  >
                    {/* Card title */}
                    <td className={`${styles.td} ${styles.tdCard}`}>
                      <span
                        className={styles.priorityDot}
                        style={{ background: PRIORITY_COLORS[card.priority] }}
                        title={card.priority !== 'none' ? card.priority : undefined}
                      />
                      {done && (
                        <span className={styles.doneIcon} title="Done">✓</span>
                      )}
                      <button onClick={(event) => { event.stopPropagation(); setSelectedCard({card, colId}); }} className={`${styles.cardTitle} ${done ? styles.cardTitleDone : ''}`}>
                        {card.title}
                      </button>
                    </td>

                    {/* List (column) */}
                    <td className={`${styles.td} ${styles.tdList}`}>
                      <span
                        className={styles.listBadge}
                        style={{ borderColor: colColor, color: colColor }}
                        title={colTitle}
                      >
                        {colTitle}
                      </span>
                    </td>

                    {/* Labels */}
                    <td className={`${styles.td} ${styles.tdLabels}`}>
                      <div className={styles.labelsWrap}>
                        {card.labels.slice(0, 3).map((l) => (
                          <span
                            key={l.id}
                            className={styles.labelChip}
                            style={{ background: l.color }}
                            title={l.name}
                          >
                            {l.name}
                          </span>
                        ))}
                        {card.labels.length > 3 && (
                          <span className={styles.labelMore}>+{card.labels.length - 3}</span>
                        )}
                      </div>
                    </td>

                    {/* Members */}
                    <td className={`${styles.td} ${styles.tdMembers}`}>
                      <div className={styles.avatarRow}>
                        {assignees.slice(0, 4).map((m) => (
                          <span
                            key={m.id}
                            className={styles.avatar}
                            style={{ background: m.color }}
                            title={m.name}
                          >
                            {getInitials(m.name)}
                          </span>
                        ))}
                        {assignees.length > 4 && (
                          <span className={`${styles.avatar} ${styles.avatarMore}`}>
                            +{assignees.length - 4}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Due date */}
                    <td className={`${styles.td} ${styles.tdDue}`}>
                      {card.dueDate ? (
                        <span className={`${styles.dueDate} ${styles[dueSt] || ''}`}>
                          {formatDate(card.dueDate)}
                        </span>
                      ) : (
                        <span className={styles.dash}>·</span>
                      )}
                    </td>

                    {/* Checklist progress */}
                    <td className={`${styles.td} ${styles.tdChecklist}`}>
                      {checkTotal > 0 ? (
                        <span className={`${styles.checkPill} ${allChecked ? styles.checkPillDone : ''}`}>
                          {checkDone}/{checkTotal}
                        </span>
                      ) : (
                        <span className={styles.dash}>·</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add card section — grouped by column */}
      <div className={styles.addSection}>
        {addingToCol ? (
          <div className={styles.addRow}>
            <select
              className={styles.addColSelect}
              value={addingToCol}
              onChange={e => setAddingToCol(e.target.value)}
            >
              {board.columns.map(col => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </select>
            <input
              ref={inputRef}
              className={styles.addInput}
              placeholder="Card title…"
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddCard(addingToCol);
                if (e.key === 'Escape') cancelAdd();
              }}
            />
            <button
              className={styles.addConfirmBtn}
              onClick={() => handleAddCard(addingToCol)}
            >
              Add card
            </button>
            <button className={styles.addCancelBtn} onClick={cancelAdd}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.addBtn}
            onClick={() => startAdding(board.columns[0]?.id ?? '')}
            disabled={board.columns.length === 0}
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard.card}
          board={board}
          columnId={selectedCard.colId}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
