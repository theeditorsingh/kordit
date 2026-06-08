'use client';
import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Board, Column as ColumnType } from '@/types';
import { AnimatePresence } from 'framer-motion';
import { useBoardContext } from '@/context/BoardContext';
import CardItem from './Card';
import dynamic from 'next/dynamic';
const CardModal = dynamic(() => import('./CardModal'), { ssr: false });
import EmptyState from './EmptyState';
import { Plus, MoreHorizontal, Trash2, AlignLeft, Calendar as CalendarIcon, Edit2, Settings, AlertCircle, Copy, Check } from 'lucide-react';
import styles from './Column.module.css';

interface Props { column: ColumnType; board: Board; search: string; onModalOpenChange?: (open: boolean) => void; }

export default function Column({ column, board, search, onModalOpenChange }: Props) {
  const { dispatch, createCard, updateColumn, deleteColumn } = useBoardContext();
  const [addingCard, setAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardDue, setCardDue] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openingCardId, setOpeningCardId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [wipValue, setWipValue] = useState(column.wipLimit || 0);
  const [displayLimit, setDisplayLimit] = useState(50);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDays, setPendingDays] = useState(0);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM'|'PM'>('AM');

  const allCards = column.cardIds
    .map((id) => board.cards[id])
    .filter(Boolean)
    .filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));
  
  const cards = allCards.slice(0, displayLimit);

  const isOverWip = (column.wipLimit || 0) > 0 && column.cardIds.length > (column.wipLimit || 0);

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
    onModalOpenChange?.(true);
  }

  function resetForm() {
    setCardTitle('');
    setCardDesc('');
    setCardDue(null);
    setAddingCard(false);
  }

  function setDue(daysFromNow: number) {
    setPendingDays(daysFromNow);
    // Default to 9:00 AM for a sensible starting time
    setSelectedHour(9);
    setSelectedMinute(0);
    setSelectedPeriod('AM');
    setShowTimePicker(true);
  }

  function confirmDueWithTime() {
    const d = new Date();
    d.setDate(d.getDate() + pendingDays);
    let h = selectedHour;
    if (selectedPeriod === 'PM' && h !== 12) h += 12;
    if (selectedPeriod === 'AM' && h === 12) h = 0;
    d.setHours(h, selectedMinute, 0, 0);
    setCardDue(d.toISOString());
    setShowTimePicker(false);
  }

  function skipTime() {
    const d = new Date();
    d.setDate(d.getDate() + pendingDays);
    d.setHours(0, 0, 0, 0);
    // Use full ISO string instead of date-only to avoid UTC midnight parsing issues
    setCardDue(d.toISOString());
    setShowTimePicker(false);
  }

  function isDateMatch(dateStr: string | null, daysFromNow: number) {
    if (!dateStr) return false;
    const stored = new Date(dateStr);
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    // Compare local date parts (not UTC) to avoid timezone date mismatches
    return stored.getFullYear() === target.getFullYear() &&
           stored.getMonth() === target.getMonth() &&
           stored.getDate() === target.getDate();
  }

  function handleDeleteColumn() {
    if (confirm(`Delete "${column.title}" and all its cards?`)) {
      deleteColumn(board.id, column.id);
    }
    setShowMenu(false);
  }

  function handleCopyCards() {
    const allColCards = column.cardIds
      .map((id) => board.cards[id])
      .filter(Boolean);

    if (allColCards.length === 0) {
      setShowMenu(false);
      return;
    }

    const lines: string[] = [`${column.title} (${allColCards.length} card${allColCards.length !== 1 ? 's' : ''})`, ''];

    allColCards.forEach((card, i) => {
      lines.push(`${i + 1}. ${card.title}`);
      if (card.description) lines.push(`   ${card.description}`);
      if (card.priority && card.priority !== 'none') lines.push(`   Priority: ${card.priority}`);
      if (card.dueDate) {
        const d = new Date(card.dueDate);
        lines.push(`   Due: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
      if (card.labels && card.labels.length > 0) lines.push(`   Labels: ${card.labels.map(l => l.name).join(', ')}`);
      if (card.checklist && card.checklist.length > 0) {
        const done = card.checklist.filter(c => c.done).length;
        lines.push(`   Checklist: ${done}/${card.checklist.length} done`);
      }
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setShowMenu(false);
  }

  function saveTitle() {
    if (titleValue.trim() && titleValue.trim() !== column.title) {
      updateColumn(board.id, column.id, { title: titleValue.trim() });
    }
    setEditingTitle(false);
  }

  function saveWipLimit() {
    updateColumn(board.id, column.id, { wipLimit: wipValue });
    setShowSettings(false);
  }

  function saveColumnColor(color: string) {
    updateColumn(board.id, column.id, { color });
  }

  const COL_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9','#172B4D'];

  return (
    <div className={`${styles.column} ${isOverWip ? styles.overWip : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} style={{ background: column.color }} />
          {editingTitle ? (
            <input
              className={styles.titleEdit}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus
            />
          ) : (
            <span className={styles.title} onClick={() => setEditingTitle(true)} title="Click to rename">{column.title}</span>
          )}
          <span className={`${styles.count} ${isOverWip ? styles.countOver : ''}`}>
            {column.cardIds.length}
            {(column.wipLimit || 0) > 0 && ` / ${column.wipLimit}`}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          {copied && (
            <span className={styles.copiedBadge}>
              <Check size={10}/> Copied!
            </span>
          )}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={15}/>
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={() => { setShowSettings(true); setShowMenu(false); }}>
                <Settings size={13}/> Column Settings
              </button>
              <button className={styles.menuItem} onClick={() => { setEditingTitle(true); setShowMenu(false); }}>
                <Edit2 size={13}/> Rename
              </button>
              <button className={styles.menuItem} onClick={handleCopyCards}>
                <Copy size={13}/> Copy All Cards
              </button>
              <div className={styles.menuDivider} />
              <button className={`${styles.menuItem} ${styles.menuDanger}`} onClick={handleDeleteColumn}>
                <Trash2 size={13}/> Delete Column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* WIP Warning */}
      {isOverWip && (
        <div className={styles.wipWarning}>
          <AlertCircle size={12} /> Over WIP limit ({column.cardIds.length}/{column.wipLimit})
        </div>
      )}

      {/* Column Settings Panel */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsTitle}>Column Settings</div>

          <div className={styles.settingsRow}>
            <label className={styles.settingsLabel}>WIP Limit</label>
            <input
              type="number"
              className="input"
              style={{ width: 70, fontSize: 12 }}
              value={wipValue}
              onChange={(e) => setWipValue(parseInt(e.target.value) || 0)}
              min={0}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0 = no limit</span>
          </div>

          <div className={styles.settingsRow}>
            <label className={styles.settingsLabel}>Color</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {COL_COLORS.map(c => (
                <button
                  key={c}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c,
                    border: column.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => saveColumnColor(c)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={saveWipLimit}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cardList} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
          >
            {cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} board={board} columnId={column.id} onModalOpenChange={onModalOpenChange} />
            ))}
            {provided.placeholder}
            {cards.length === 0 && !addingCard && (
              <EmptyState
                variant="no-cards"
                action={{ label: '+ Add a card', onClick: () => setAddingCard(true) }}
              />
            )}
            {allCards.length > displayLimit && (
              <button 
                className={styles.showMoreBtn} 
                onClick={() => setDisplayLimit(l => l + 50)}
              >
                Show {Math.min(50, allCards.length - displayLimit)} more...
              </button>
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
              if (e.key === 'Enter') { e.preventDefault(); handleAddCard(); }
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
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCard(); } }}
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
                value={cardDue ? cardDue.split('T')[0] : ''}
                onChange={(e) => setCardDue(e.target.value || null)}
              />
            </div>
          </div>

          {/* Time Picker Popup */}
          {showTimePicker && (
            <div className={styles.timePickerPopup}>
              <div className={styles.timePickerHeader}>
                <CalendarIcon size={13} />
                <span>{pendingDays === 0 ? 'Today' : 'Tomorrow'} — Select Time</span>
              </div>
              <div className={styles.timePickerBody}>
                <select
                  className={styles.timeSelect}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className={styles.timeColon}>:</span>
                <select
                  className={styles.timeSelect}
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <div className={styles.periodToggle}>
                  <button
                    className={`${styles.periodBtn} ${selectedPeriod === 'AM' ? styles.periodActive : ''}`}
                    onClick={() => setSelectedPeriod('AM')}
                  >AM</button>
                  <button
                    className={`${styles.periodBtn} ${selectedPeriod === 'PM' ? styles.periodActive : ''}`}
                    onClick={() => setSelectedPeriod('PM')}
                  >PM</button>
                </div>
              </div>
              <div className={styles.timePickerActions}>
                <button className="btn btn-ghost btn-sm" onClick={skipTime}>No time</button>
                <button className="btn btn-primary btn-sm" onClick={confirmDueWithTime}>Set</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCard}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={handleSaveAndOpen}
              title="Save and open editor"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
      ) : cards.length > 0 ? (
        <button className={styles.addBtn} onClick={() => setAddingCard(true)}>
          <Plus size={14}/> Add a card
        </button>
      ) : null}

      <AnimatePresence>
        {openingCardId && board.cards[openingCardId] && (
          <CardModal
            card={board.cards[openingCardId]}
            board={board}
            columnId={column.id}
            onClose={() => {
              setOpeningCardId(null);
              onModalOpenChange?.(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
