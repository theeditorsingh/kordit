'use client';
import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Board, Column as ColumnType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import CardItem from './Card';
import CardModal from './CardModal';
import { Plus, MoreHorizontal, Trash2, AlignLeft, Calendar as CalendarIcon, Edit2 } from 'lucide-react';
import styles from './Column.module.css';

interface Props { column: ColumnType; board: Board; search: string; }

export default function Column({ column, board, search }: Props) {
  const { dispatch, createCard } = useBoardContext();
  const [addingCard, setAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardDue, setCardDue] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [openingCardId, setOpeningCardId] = useState<string | null>(null);

  const cards = column.cardIds
    .map((id) => board.cards[id])
    .filter(Boolean)
    .filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  function handleAddCard() {
    if (!cardTitle.trim()) return;
    createCard(board.id, column.id, cardTitle.trim(), cardDesc.trim(), cardDue);
    resetForm();
  }

  async function handleSaveAndOpen() {
    const title = cardTitle.trim() || 'Untitled Card';
    const newId = await createCard(board.id, column.id, title, cardDesc.trim(), cardDue);
    resetForm();
    setOpeningCardId(newId);
  }

  function resetForm() {
    setCardTitle('');
    setCardDesc('');
    setCardDue(null);
    setAddingCard(false);
  }

  function setDue(daysFromNow: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setCardDue(d.toISOString().split('T')[0]);
  }

  function isDateMatch(dateStr: string | null, daysFromNow: number) {
    if (!dateStr) return false;
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return dateStr === d.toISOString().split('T')[0];
  }

  function deleteColumn() {
    if (confirm(`Delete "${column.title}" and all its cards?`)) {
      dispatch({ type: 'DELETE_COLUMN', boardId: board.id, columnId: column.id });
    }
    setShowMenu(false);
  }

  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} style={{ background: column.color }} />
          <span className={styles.title}>{column.title}</span>
          <span className={styles.count}>{column.cardIds.length}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={15}/>
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={deleteColumn}>
                <Trash2 size={13}/> Delete Column
              </button>
            </div>
          )}
        </div>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cardList} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
          >
            {cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} board={board} columnId={column.id} />
            ))}
            {provided.placeholder}
            {cards.length === 0 && !addingCard && (
              <div className={styles.emptyCol}>Drop cards here</div>
            )}
          </div>
        )}
      </Droppable>

      {addingCard ? (
        <div className={styles.addForm}>
          <input
            className={styles.titleInput}
            placeholder="Title"
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCard();
              if (e.key === 'Escape') resetForm();
            }}
            autoFocus
          />
          <div className={styles.detailsRow}>
            <AlignLeft size={14} className={styles.detailsIcon} />
            <input
              className={styles.detailsInput}
              placeholder="Details"
              value={cardDesc}
              onChange={(e) => setCardDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
            />
          </div>
          
          <div className={styles.datePills}>
            <button className={`${styles.datePill} ${isDateMatch(cardDue, 0) ? styles.activePill : ''}`} onClick={() => setDue(0)}>Today</button>
            <button className={`${styles.datePill} ${isDateMatch(cardDue, 1) ? styles.activePill : ''}`} onClick={() => setDue(1)}>Tomorrow</button>
          <div className={styles.datePickerWrap} title="Choose a date">
            <CalendarIcon size={13} className={styles.dateIcon}/>
            <input
              type="date"
              className={styles.dateInput}
              value={cardDue ?? ''}
              onChange={(e) => setCardDue(e.target.value || null)}
            />
          </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={handleAddCard}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            <button 
               className="btn btn-ghost btn-icon btn-sm" 
               style={{ marginLeft: 'auto' }} 
               onClick={handleSaveAndOpen}
               title="Save and edit details"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setAddingCard(true)}>
          <Plus size={14}/> Add a card
        </button>
      )}

      {openingCardId && board.cards[openingCardId] && (
        <CardModal
          card={board.cards[openingCardId]}
          board={board}
          columnId={column.id}
          onClose={() => setOpeningCardId(null)}
        />
      )}
    </div>
  );
}
