'use client';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Board as BoardType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import Column from './Column';
import BulkActionBar from './BulkActionBar';
import { Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import styles from './Board.module.css';

interface Props { board: BoardType; search: string; }

export default function Board({ board, search }: Props) {
  const { dispatch, createColumn, moveCard } = useBoardContext();
  const [addingCol, setAddingCol] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);

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
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
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

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={styles.board} ref={boardRef}>
          {board.columns.map((col) => (
            <Column key={col.id} column={col} board={board} search={search} />
          ))}

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
      </DragDropContext>
      <BulkActionBar />
    </>
  );
}
