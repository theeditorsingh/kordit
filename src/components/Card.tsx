'use client';
import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Board, Card } from '@/types';
import { Calendar, CheckSquare } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import CardModal from './CardModal';
import styles from './Card.module.css';

interface Props { card: Card; index: number; board: Board; columnId: string; }

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

export default function CardItem({ card, index, board, columnId }: Props) {
  const [open, setOpen] = useState(false);
  const doneItems = card.checklist.filter((c) => c.done).length;
  const totalItems = card.checklist.length;
  const assignees = card.assigneeIds.map((id) => board.members.find((m) => m.id === id)).filter(Boolean);

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''}`}
            onClick={() => setOpen(true)}
          >
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

      {open && (
        <CardModal card={card} board={board} columnId={columnId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
