'use client';
import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Board, Card } from '@/types';
import { Calendar, CheckSquare, AlertTriangle, Clock, Repeat } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import CardModal from './CardModal';
import { useBoardContext } from '@/context/BoardContext';
import styles from './Card.module.css';

interface Props { card: Card; index: number; board: Board; columnId: string; onModalOpenChange?: (open: boolean) => void; }

const PRIORITY_LABELS = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };

function getDueDateClass(date: string | null) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'due-soon';
  return '';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeShort(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function CardItem({ card, index, board, columnId, onModalOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const { deleteCard, toggleCardSelection, state } = useBoardContext();

  const isSelected = state.selectedCardIds.includes(card.id);
  const doneItems = card.checklist.filter((c) => c.done).length;
  const totalItems = card.checklist.length;
  const assignees = card.assigneeIds.map((id) => board.members.find((m) => m.id === id)).filter(Boolean);
  const hasBlockers = (card.blockedBy || []).length > 0;
  const isTimerRunning = !!card.timerStarted;

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''} ${isSelected ? styles.selected : ''} ${hasBlockers ? styles.blocked : ''}`}
            style={{
              ...provided.draggableProps.style,
              ...(isSelected ? { border: '2px solid #0052CC', backgroundColor: 'rgba(0, 82, 204, 0.05)' } : {})
            }}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                toggleCardSelection(card.id);
              } else {
                setOpen(true);
                onModalOpenChange?.(true);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            {/* Cover */}
            {(card.coverColor || card.coverImage) && (
              <div
                className={styles.cardCover}
                style={{
                  background: card.coverImage ? `url(${card.coverImage}) center/cover` : card.coverColor,
                }}
              />
            )}

            {/* Labels */}
            {card.labels.length > 0 && (
              <div className={styles.labels}>
                {card.labels.map((l) => (
                  <span key={l.id} className="card-chip" style={{ background: l.color, fontSize: 10, padding: '2px 6px' }}>
                    {l.name}
                  </span>
                ))}
              </div>
            )}

            {/* Title row */}
            <div className={styles.titleRow}>
              <span className={`priority-dot dot-${card.priority}`} />
              <span className={styles.title}>{card.title}</span>
            </div>

            {/* Indicators row */}
            {(hasBlockers || card.isRecurring || isTimerRunning) && (
              <div className={styles.indicators}>
                {hasBlockers && (
                  <span className={styles.blockerBadge}>
                    <AlertTriangle size={10} /> Blocked
                  </span>
                )}
                {card.isRecurring && (
                  <span className={styles.recurBadge}>
                    <Repeat size={10} />
                  </span>
                )}
                {isTimerRunning && (
                  <span className={styles.timerBadge}>
                    <Clock size={10} />
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
              <div className={styles.footerLeft}>
                {card.dueDate && (
                  <span className={`${styles.due} ${getDueDateClass(card.dueDate)}`}>
                    <Calendar size={11}/> {formatDate(card.dueDate)}
                  </span>
                )}
                {totalItems > 0 && (
                  <span className={`${styles.checklist} ${doneItems === totalItems ? styles.allDone : ''}`}>
                    <CheckSquare size={11}/> {doneItems}/{totalItems}
                  </span>
                )}
                {(card.timeSpent || 0) > 0 && (
                  <span className={styles.timeBadge}>
                    <Clock size={10} /> {formatTimeShort(card.timeSpent || 0)}
                  </span>
                )}
              </div>
              {assignees.length > 0 && (
                <div className={styles.avatars}>
                  {assignees.slice(0, 3).map((m) => (
                    <span key={m!.id} className="avatar avatar-sm" style={{ background: m!.color, marginLeft: -6 }}>
                      {getInitials(m!.name)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist progress */}
            {totalItems > 0 && (
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${(doneItems / totalItems) * 100}%` }} />
              </div>
            )}
          </div>
        )}
      </Draggable>

      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '4px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '120px'
            }}
          >
            <button
              style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '4px' }}
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setOpen(true); }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              Edit Card
            </button>
            <button
              style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: '#ff5630', borderRadius: '4px' }}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                if (confirm('Delete this card?')) {
                   deleteCard(board.id, columnId, card.id);
                }
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 86, 48, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {open && (
        <CardModal card={card} board={board} columnId={columnId} onClose={() => {
          setOpen(false);
          onModalOpenChange?.(false);
        }} />
      )}
    </>
  );
}
