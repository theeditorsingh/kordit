'use client';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board as BoardType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import Column from './Column';
import BulkActionBar from './BulkActionBar';
import { Plus } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './Board.module.css';

interface Props { board: BoardType; search: string; }

export default function Board({ board, search }: Props) {
  const { dispatch, createColumn, moveCard, moveColumn } = useBoardContext();
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

  // Mobile column page dots — IntersectionObserver
  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl || typeof window === 'undefined') return;
    if (window.innerWidth > 768) return; // desktop: skip

    const columns = boardEl.querySelectorAll('[data-col-index]');
    if (!columns.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt((entry.target as HTMLElement).dataset.colIndex || '0');
            setActiveColIndex(idx);
          }
        });
      },
      { root: boardEl, threshold: 0.6 }
    );

    columns.forEach(col => observer.observe(col));
    return () => observer.disconnect();
  }, [board.columns.length]);

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

    moveCard(
      board.id,
      draggableId,
      source.droppableId,
      destination.droppableId,
      source.index,
      destination.index
    );
  }

  function handleAddCol() {
    if (!colTitle.trim()) return;
    createColumn(board.id, colTitle.trim());
    setColTitle('');
    setAddingCol(false);
  }

  const boardStyle: React.CSSProperties = {};
  if (board.backgroundType === 'gradient' && board.background) {
    boardStyle.background = board.background;
  } else if (board.backgroundType === 'image' && board.background) {
    boardStyle.backgroundImage = `url(${board.background})`;
    boardStyle.backgroundSize = 'cover';
    boardStyle.backgroundPosition = 'center';
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className={styles.board}
              ref={(el) => {
                provided.innerRef(el);
                (boardRef as any).current = el;
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

      {/* Mobile column page dots */}
      {board.columns.length > 1 && (
        <div className={styles.pageDots}>
          {board.columns.map((col, i) => (
            <span
              key={col.id}
              className={`${styles.pageDot} ${i === activeColIndex ? styles.pageDotActive : ''}`}
              style={{ background: i === activeColIndex ? col.color : undefined }}
            />
          ))}
        </div>
      )}
    </>
  );
}
