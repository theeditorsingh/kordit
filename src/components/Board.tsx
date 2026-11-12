'use client';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board as BoardType, Card as CardType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import Column from './Column';
import BulkActionBar from './BulkActionBar';
import { Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import styles from './Board.module.css';
import { getBoardBackgroundStyle } from '@/utils/boardBackground';

interface Props { board: BoardType; search: string; cardFilter?: (card: CardType) => boolean; }

export default function Board({ board, search, cardFilter }: Props) {
  const { state, createColumn, moveCard, moveColumn } = useBoardContext();
  const [addingCol, setAddingCol] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  // Track whether any card modal is open — disables column drag while modal is visible
  const [modalOpen, setModalOpen] = useState(false);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
    el.addEventListener('scroll', update, {passive: true});
    const resize = new ResizeObserver(update);
    resize.observe(el);
    el.querySelectorAll('[data-col-index]').forEach(column => resize.observe(column));
    update();
    return () => { el.removeEventListener('scroll', update); resize.disconnect(); };
  }, [isMobile, board.id, board.columns.length]);

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
      {board.columns.length > 1 && (
        <label className={styles.columnPicker}>
          Column
          <select aria-label="Jump to column" value={Math.min(activeColIndex, board.columns.length - 1)} onChange={event => {
            const index = Number(event.target.value);
            const el = boardRef.current;
            const column = el?.querySelector<HTMLElement>(`[data-col-index="${index}"]`);
            if (el && column) el.scrollTo({ left: el.scrollLeft + column.getBoundingClientRect().left - el.getBoundingClientRect().left - 16, behavior: 'auto' });
            setActiveColIndex(index);
          }}>
            {board.columns.map((column, index) => <option key={column.id} value={index}>{column.title}</option>)}
          </select>
        </label>
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
