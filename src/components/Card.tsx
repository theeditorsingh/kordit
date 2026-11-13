'use client';
import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Board, Card } from '@/types';

import { Calendar, CheckSquare, Edit2, Trash2, CheckCircle2, Circle, AlignLeft, ArrowRightLeft, ChevronRight } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import { getDueDateClass, formatCardDate } from '@/utils/dates';
import dynamic from 'next/dynamic';
import { useBoardContext } from '@/context/BoardContext';
import styles from './Card.module.css';
import { useSwipeDown } from '@/hooks/useSwipeDown';

// Loaded on first open so the modal code stays out of the initial board bundle
const CardModal = dynamic(() => import('./CardModal'), { ssr: false });

interface Props { card: Card; index: number; board: Board; columnId: string; dragDisabled?: boolean; onToggleDone?: () => void; onModalOpenChange?: (open: boolean) => void; }

const PRIORITY_LABELS: Record<string, string> = { none: 'None', urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
// Colour of the left-edge stripe; same palette as the global .badge-* classes
const PRIORITY_COLORS: Record<string, string> = { urgent: '#FF5630', high: '#FF991F', medium: '#0052CC', low: '#36B37E' };

export default function CardItem({ card, index, board, columnId, dragDisabled, onToggleDone, onModalOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const { deleteCard, toggleCardSelection, moveCard, state } = useBoardContext();
  const [showMoveList, setShowMoveList] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('card');
    if (requested === card.id) {
      const timer = window.setTimeout(() => {
        setOpen(true);
        onModalOpenChange?.(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [card.id, onModalOpenChange]);

  // Swipe-down to dismiss the long-press bottom sheet
  const cardSheetSwipe = useSwipeDown({ onDismiss: () => setShowBottomSheet(false) });

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const isSelected = state.selectedCardIds.includes(card.id);
  const isSelectionMode = state.selectedCardIds.length > 0;
  const doneItems = card.checklist.filter((c) => c.done).length;
  const totalItems = card.checklist.length;
  const assignees = card.assigneeIds.map((id) => board.members.find((m) => m.id === id)).filter(Boolean);

  const priorityColor = PRIORITY_COLORS[card.priority];
  const progressPercent = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
  const checklistDone = totalItems > 0 && doneItems === totalItems;
  // Nothing below the labels (no checklist, due date or description): avatars move up beside the labels
  const avatarsUp = assignees.length > 0 && totalItems === 0 && !card.dueDate && !card.description;

  return (
    <>
      <Draggable draggableId={card.id} index={index} isDragDisabled={dragDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`${styles.card} ${styles.cardAnimated} ${priorityColor ? styles.hasPriority : ''} ${avatarsUp ? styles.avatarsUp : ''} ${snapshot.isDragging ? styles.dragging : ''} ${isSelected ? styles.selected : ''}`}
            style={{
              ...provided.draggableProps.style,
              ...(isSelected ? { border: '2px solid #0052CC', backgroundColor: 'rgba(0, 82, 204, 0.05)' } : {}),
              ...({ '--card-index': index, '--priority-color': priorityColor } as CSSProperties),
            }}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || isSelectionMode) {
                e.preventDefault();
                toggleCardSelection(card.id);
              } else {
                setOpen(true);
                onModalOpenChange?.(true);
              }
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && e.key === 'Enter') {
                e.preventDefault();
                setOpen(true);
                onModalOpenChange?.(true);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            onTouchStart={() => {
              longPressTimer.current = setTimeout(() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate(10);
                }
                setShowBottomSheet(true);
              }, 500);
            }}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
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

            {/* Title first, next to the tick circle. Priority is shown by the left-edge stripe. */}
            <div className={styles.titleRow}>
              {onToggleDone && (
                <button
                  className={styles.doneBtn}
                  onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
                  title="Mark completed"
                  aria-label={`Mark "${card.title}" completed`}
                >
                  <Circle size={15} />
                </button>
              )}
              <div className={styles.title}>
                {card.title}
                {priorityColor && <span className={styles.srOnly}> ({PRIORITY_LABELS[card.priority]} priority)</span>}
              </div>
            </div>

            {/* Labels: soft tinted pills under the title */}
            {card.labels.length > 0 && (
              <div className={styles.topRow}>
                <div className={styles.labels}>
                  {card.labels.map((l) => (
                    <span key={l.id} className={`card-chip ${styles.labelChip}`} style={{ '--label-color': l.color } as CSSProperties} title={l.name}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist progress: gradient bar with the done/total count beside it */}
            {totalItems > 0 && (
              <div className={styles.progressRow}>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Checklist progress"
                  aria-valuemin={0}
                  aria-valuemax={totalItems}
                  aria-valuenow={doneItems}
                >
                  <div
                    className={`${styles.progressFill} ${checklistDone ? styles.progressFillDone : ''}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className={`${styles.checklist} ${checklistDone ? styles.allDone : ''}`}>
                  <CheckSquare size={11}/> {doneItems}/{totalItems}
                </span>
              </div>
            )}

            {/* Footer: due date + description on left, avatars on right */}
            {(assignees.length > 0 || card.description || card.dueDate) && (
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  {card.dueDate && (
                    <span className={`${styles.due} ${getDueDateClass(card.dueDate)}`}>
                      <Calendar size={11}/> {formatCardDate(card.dueDate)}
                    </span>
                  )}
                  {card.description && (
                    <span className={styles.descBadge} title="This card has a description">
                      <AlignLeft size={11} />
                    </span>
                  )}
                </div>
                {assignees.length > 0 && (
                  <div className={styles.avatars}>
                    {assignees.slice(0, 3).map((m) => (
                      <span
                        key={m!.id}
                        className={`avatar avatar-sm ${styles.avatar}`}
                        style={{ background: m!.color, marginLeft: -6, '--member-color': m!.color } as CSSProperties}
                        title={m!.name}
                      >
                        <span className={styles.initialsFull}>{getInitials(m!.name)}</span>
                        <span className={styles.initialOne} aria-hidden="true">{getInitials(m!.name).charAt(0)}</span>
                      </span>
                    ))}
                    {assignees.length > 1 && (
                      <span className={styles.moreAssignees} aria-label={`${assignees.length - 1} more assignees`}>+{assignees.length - 1}</span>
                    )}
                  </div>
                )}
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
                  deleteCard(board.id, columnId, card.id);
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 86, 48, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                Delete
              </button>
            </div>
          </>
        )}

      {/* Mobile bottom sheet context menu (long-press) */}
      {showBottomSheet && (
        <div
          className="modal-overlay"
          onClick={() => setShowBottomSheet(false)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal-box"
            style={{ maxWidth: '100%', position: 'fixed', bottom: 0, borderRadius: '20px 20px 0 0', padding: '8px 0 24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', ...cardSheetSwipe.dragStyle }}
            onClick={e => e.stopPropagation()}
            onTouchStart={cardSheetSwipe.onTouchStart}
            onTouchMove={cardSheetSwipe.onTouchMove}
            onTouchEnd={cardSheetSwipe.onTouchEnd}
          >
            <div style={{ width: 40, height: 4, background: 'var(--border-subtle)', borderRadius: 2, margin: '8px auto 12px' }} />
            <div style={{ padding: '0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 20, marginBottom: 4 }}>
              {card.title.length > 40 ? card.title.slice(0, 40) + '…' : card.title}
            </div>
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                onClick={() => { setShowBottomSheet(false); setOpen(true); onModalOpenChange?.(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 20px', background: 'none', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Edit2 size={18} style={{ color: 'var(--text-muted)' }} />
                Edit Card
              </button>
              {board.columns.length > 1 && (
                <button
                  onClick={() => setShowMoveList((v) => !v)}
                  aria-expanded={showMoveList}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                    padding: '14px 20px', background: 'none', border: 'none', borderRadius: 10,
                    fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <ArrowRightLeft size={18} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Move to…</span>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)', transform: showMoveList ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
              )}
              {showMoveList && (
                <div role="group" aria-label="Move to column" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px 6px 44px' }}>
                  {board.columns.filter((col) => col.id !== columnId).map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        const src = board.columns.find((c) => c.id === columnId);
                        const srcIdx = src ? src.cardIds.indexOf(card.id) : -1;
                        setShowMoveList(false);
                        setShowBottomSheet(false);
                        if (srcIdx === -1) return;
                        // Same call drag-and-drop makes; the card joins the end of the column
                        moveCard(board.id, card.id, columnId, col.id, srcIdx, col.cardIds.length);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44,
                        padding: '10px 12px', background: 'none', border: 'none', borderRadius: 10,
                        fontSize: 15, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setShowBottomSheet(false); toggleCardSelection(card.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 20px', background: 'none', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <CheckCircle2 size={18} style={{ color: isSelected ? '#0052CC' : 'var(--text-muted)' }} />
                {isSelected ? 'Deselect' : 'Select'}
              </button>
              <button
                onClick={() => {
                  setShowBottomSheet(false);
                  deleteCard(board.id, columnId, card.id);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 20px', background: 'none', border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 500, color: '#FF5630', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={18} />
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

        {open && (
          <CardModal card={card} board={board} columnId={columnId} onClose={() => {
            setOpen(false);
            onModalOpenChange?.(false);
            const url = new URL(window.location.href);
            if (url.searchParams.get('card') === card.id) {
              url.searchParams.delete('card');
              window.history.replaceState(window.history.state, '', url);
            }
          }} />
        )}
    </>
  );
}
