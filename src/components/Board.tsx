'use client';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board as BoardType, Card as CardType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import Column from './Column';
import BulkActionBar from './BulkActionBar';
import { Plus } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import styles from './Board.module.css';
import { getBoardBackgroundStyle } from '@/utils/boardBackground';

interface Props { board: BoardType; search: string; cardFilter?: (card: CardType) => boolean; }

export default function Board({ board, search, cardFilter }: Props) {
  const { state, createColumn, moveCard, moveColumn } = useBoardContext();
  const [addingCol, setAddingCol] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const chipStripRef = useRef<HTMLDivElement>(null);
  // Track whether any card modal is open — disables column drag while modal is visible
  const [modalOpen, setModalOpen] = useState(false);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile (same breakpoint as the CSS)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  // Track the nearest column edge instead of the last intersecting narrow column.
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !isMobile) return;
    const update = () => {
      const left = el.getBoundingClientRect().left + 16;
      const columns = Array.from(el.querySelectorAll<HTMLElement>('[data-col-index]'));
      let nearest = 0;
      let distance = Infinity;
      columns.forEach((column, index) => {
        const delta = Math.abs(column.getBoundingClientRect().left - left);
        if (delta < distance) { nearest = index; distance = delta; }
      });
      setActiveColIndex(nearest);
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    el.querySelectorAll('[data-col-index]').forEach(column => resize.observe(column));
    update();
    return () => { el.removeEventListener('scroll', onScroll); resize.disconnect(); cancelAnimationFrame(frame); };
  }, [isMobile, board.id, board.columns.length]);

  // Keep the active chip visible in the chip strip (scrolls the strip only, never the page)
  useEffect(() => {
    const strip = chipStripRef.current;
    if (!strip || !isMobile) return;
    const chip = strip.querySelector<HTMLElement>(`[data-chip-index="${activeColIndex}"]`);
    if (!chip) return;
    const pad = 16;
    const left = chip.offsetLeft - pad;
    const right = chip.offsetLeft + chip.offsetWidth + pad - strip.clientWidth;
    let target: number | null = null;
    if (strip.scrollLeft > left) target = left;
    else if (strip.scrollLeft < right) target = right;
    if (target !== null) strip.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [activeColIndex, isMobile]);

  // Chip data: open (not completed) cards per column, same count as the column header
  const chips = useMemo(() => board.columns.map((col) => ({
    id: col.id,
    title: col.title,
    color: col.color,
    count: col.cardIds.filter((id) => board.cards[id] && !board.cards[id].completedAt).length,
  })), [board.columns, board.cards]);

  function jumpToColumn(index: number) {
    const el = boardRef.current;
    const column = el?.querySelector<HTMLElement>(`[data-col-index="${index}"]`);
    if (el && column) {
      const left = el.scrollLeft + column.getBoundingClientRect().left - el.getBoundingClientRect().left - 16;
      el.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    setActiveColIndex(index);
  }

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return;

      let el: HTMLElement | null = e.target as HTMLElement;
      let isScrollableVertically = false;

      while (el && el !== boardEl) {
        const style = window.getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
          isScrollableVertically = true;
          break;
        }
        el = el.parentElement;
      }

      if (!isScrollableVertically && e.deltaY !== 0) {
        boardEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    boardEl.addEventListener('wheel', onWheel, { passive: false });
    return () => boardEl.removeEventListener('wheel', onWheel);
  }, []);

  function onDragEnd(result: DropResult) {
    if (modalOpen) return; // Safety net — modal overlay prevents most drags but belt+suspenders
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'COLUMN') {
      moveColumn(board.id, source.index, destination.index);
      return;
    }

    // The board only shows cards that are not completed, so the positions reported by the
    // drag are positions among those. Translate them to positions in the full column order.
    const srcCol = board.columns.find((c) => c.id === source.droppableId);
    const dstCol = board.columns.find((c) => c.id === destination.droppableId);
    if (!srcCol || !dstCol) return;
    const sourceIndex = srcCol.cardIds.indexOf(draggableId);
    if (sourceIndex === -1) return;

    const dstIds = dstCol.cardIds.filter((id) => id !== draggableId);
    const visible = dstIds.filter((id) => board.cards[id] && !board.cards[id].completedAt);
    // A sorted column decides its own order: nothing to do for a move inside it,
    // and a card arriving from elsewhere just joins the end.
    const destSorted = !!dstCol.settings?.sortBy && dstCol.settings.sortBy !== 'manual';
    if (destSorted && srcCol.id === dstCol.id) return;

    let destIndex: number;
    if (!destSorted && destination.index < visible.length) {
      destIndex = dstIds.indexOf(visible[destination.index]);
    } else if (visible.length > 0) {
      destIndex = dstIds.indexOf(visible[visible.length - 1]) + 1;
    } else {
      destIndex = 0;
    }

    moveCard(board.id, draggableId, source.droppableId, destination.droppableId, sourceIndex, destIndex);
  }

  function handleAddCol() {
    if (!colTitle.trim()) return;
    createColumn(board.id, colTitle.trim());
    setColTitle('');
    setAddingCol(false);
  }

  const boardStyle = getBoardBackgroundStyle(board);

  return (
    <>
      {/* Mobile: column chips, kept in sync with the swipeable board */}
      {board.columns.length > 0 && (
        <div className={styles.chipStrip} ref={chipStripRef} role="tablist" aria-label="Columns">
          {chips.map((chip, index) => {
            const active = index === Math.min(activeColIndex, chips.length - 1);
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-chip-index={index}
                className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                onClick={() => jumpToColumn(index)}
              >
                <span className={styles.chipDot} style={{ background: chip.color }} />
                <span className={styles.chipTitle}>{chip.title}</span>
                <span className={styles.chipCount}>{chip.count}</span>
              </button>
            );
          })}
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className={`${styles.board} ${state.selectedCardIds.length ? styles.withSelection : ''}`}
              ref={(el) => {
                provided.innerRef(el);
                boardRef.current = el;
              }}
              {...provided.droppableProps}
              style={boardStyle}
            >
              {board.columns.map((col, index) => (
                <Draggable
                  key={col.id}
                  draggableId={`col-${col.id}`}
                  index={index}
                  isDragDisabled={modalOpen || isMobile}
                >
                  {(colProvided, colSnapshot) => (
                    <div
                      ref={colProvided.innerRef}
                      {...colProvided.draggableProps}
                      {...colProvided.dragHandleProps}
                      className={colSnapshot.isDragging ? styles.columnDragging : ''}
                      style={{
                        ...colProvided.draggableProps.style,
                        cursor: modalOpen ? 'default' : undefined,
                      }}
                    >
                      <div data-col-index={index}>
                        <Column
                          column={col}
                          board={board}
                          search={search}
                          cardFilter={cardFilter}
                          onModalOpenChange={setModalOpen}
                        />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              <div className={styles.addColWrap}>
                {addingCol ? (
                  <div className={styles.addColForm}>
                    <input
                      className="input"
                      placeholder="Column name..."
                      value={colTitle}
                      onChange={(e) => setColTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCol(); if (e.key === 'Escape') setAddingCol(false); }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAddCol}>Add Column</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAddingCol(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.addColBtn} onClick={() => setAddingCol(true)}>
                    <Plus size={16}/> Add Column
                  </button>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <BulkActionBar />

    </>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
