'use client';
import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Board, Card as CardType, Column as ColumnType } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { useConfirm } from './ConfirmDialog';
import { cardMatchesSearch } from '@/utils/search';
import { SORT_OPTIONS, sortCards } from '@/utils/columnSettings';
import ColumnSettingsModal from './ColumnSettingsModal';
import CardItem from './Card';
import dynamic from 'next/dynamic';
const CardModal = dynamic(() => import('./CardModal'), { ssr: false });
import EmptyState from './EmptyState';
import { Plus, MoreHorizontal, MoreVertical, Trash2, AlignLeft, Calendar as CalendarIcon, Edit2, Settings, AlertCircle, Copy, Check, ChevronsRightLeft, ChevronsLeftRight, ChevronRight, CheckCircle2 } from 'lucide-react';
import styles from './Column.module.css';

interface Props {
  column: ColumnType;
  board: Board;
  search: string;
  /** Quick-filter test from the filter bar; undefined when no filter is on */
  cardFilter?: (card: CardType) => boolean;
  onModalOpenChange?: (open: boolean) => void;
}

// Which columns this person has folded, remembered in this browser only
const COLLAPSED_KEY = 'kordit-collapsed-columns';
function readCollapsed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function Column({ column, board, search, cardFilter, onModalOpenChange }: Props) {
  const { dispatch, createCard, updateColumn, deleteColumn, updateCard } = useBoardContext();
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsed, setCollapsedState] = useState(() => typeof window !== 'undefined' && readCollapsed().includes(column.id));

  function setCollapsed(next: boolean) {
    setCollapsedState(next);
    setShowMenu(false);
    try {
      const ids = readCollapsed().filter((id) => id !== column.id);
      if (next) ids.push(column.id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
    } catch { /* storage unavailable: still collapses for this visit */ }
  }

  // The tick on a card: completed cards leave the list and sit in this column's
  // "Completed" section (like Google Tasks). Ticking again there brings them back.
  function setCompleted(card: CardType, completed: boolean) {
    const completedAt = completed ? new Date().toISOString() : null;
    updateCard(board.id, { ...card, completedAt }, { completedAt });
  }
  const confirm = useConfirm();
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
  const [displayLimit, setDisplayLimit] = useState(50);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDays, setPendingDays] = useState(0);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM'|'PM'>('AM');

  const columnCards = column.cardIds.map((id) => board.cards[id]).filter(Boolean);
  const matches = (c: CardType) => cardMatchesSearch(c, search) && (!cardFilter || cardFilter(c));
  // Open cards make up the list; completed ones go to the Completed section below it
  const sortBy = column.settings?.sortBy ?? 'manual';
  const allCards = sortCards(columnCards.filter((c) => !c.completedAt && matches(c)), sortBy);
  const completedCards = columnCards
    .filter((c) => c.completedAt && matches(c))
    .sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1)); // most recently completed first

  const cards = allCards.slice(0, displayLimit);

  // Counts and the WIP limit only consider open cards
  const activeCount = columnCards.filter((c) => !c.completedAt).length;
  const isOverWip = (column.wipLimit || 0) > 0 && activeCount > (column.wipLimit || 0);

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

  async function handleDeleteColumn() {
    setShowMenu(false);
    const count = column.cardIds.length;
    const what = count > 0 ? ` and its ${count} card${count === 1 ? '' : 's'}` : '';
    if (await confirm(`Delete "${column.title}"${what}?`, { title: 'Delete column' })) {
      deleteColumn(board.id, column.id);
    }
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


  // Folded: a narrow strip with the name and count. Cards can still be dropped on it.
  if (collapsed) {
    return (
      <div className={`${styles.column} ${styles.collapsedColumn} ${isOverWip ? styles.overWip : ''}`}>
        <Droppable droppableId={column.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`${styles.collapsedBody} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
              role="button"
              tabIndex={0}
              title={`Expand "${column.title}"`}
              aria-label={`Expand column ${column.title}, ${activeCount} cards`}
              onClick={() => setCollapsed(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(false); } }}
            >
              <ChevronsLeftRight size={14} />
              <span className={styles.dot} style={{ background: column.color }} />
              <span className={`${styles.count} ${isOverWip ? styles.countOver : ''}`}>{activeCount}</span>
              <span className={styles.collapsedTitle}>{column.title}</span>
              <div style={{ display: 'none' }}>{provided.placeholder}</div>
            </div>
          )}
        </Droppable>
      </div>
    );
  }

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
            {activeCount}
            {(column.wipLimit || 0) > 0 && ` / ${column.wipLimit}`}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          {copied && (
            <span className={styles.copiedBadge}>
              <Check size={10}/> Copied!
            </span>
          )}
          <button className={`btn btn-ghost btn-icon btn-sm ${styles.menuBtn}`} onClick={() => setShowMenu(!showMenu)} aria-label={`Column options for ${column.title}`} aria-expanded={showMenu}>
            <MoreHorizontal size={15} className={styles.desktopOnlyIcon}/>
            <MoreVertical size={20} className={styles.mobileOnlyIcon}/>
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={() => { setShowSettings(true); setShowMenu(false); onModalOpenChange?.(true); }}>
                <Settings size={13}/> Column Settings
              </button>
              <button className={styles.menuItem} onClick={() => { setEditingTitle(true); setShowMenu(false); }}>
                <Edit2 size={13}/> Rename
              </button>
              <button className={styles.menuItem} onClick={handleCopyCards}>
                <Copy size={13}/> Copy All Cards
              </button>
              <button className={styles.menuItem} onClick={() => setCollapsed(true)}>
                <ChevronsRightLeft size={13}/> Collapse Column
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
          <AlertCircle size={12} /> Over WIP limit ({activeCount}/{column.wipLimit})
        </div>
      )}

      {/* Tells people why the order isn't the one they dragged */}
      {sortBy !== 'manual' && (
        <div className={styles.sortNote}>{SORT_OPTIONS.find((o) => o.value === sortBy)?.note}</div>
      )}

      {showSettings && (
        <ColumnSettingsModal
          column={column}
          board={board}
          onClose={() => { setShowSettings(false); onModalOpenChange?.(false); }}
        />
      )}

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cardList} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
          >
            {cards.map((card, index) => (
              <CardItem key={card.id} card={card} index={index} board={board} columnId={column.id} dragDisabled={!!search || !!cardFilter} onToggleDone={() => setCompleted(card, true)} onModalOpenChange={onModalOpenChange} />
            ))}
            {provided.placeholder}
            {cards.length === 0 && completedCards.length === 0 && !addingCard && (
              <>
                <div className={styles.emptyDesktop}>
                  <EmptyState
                    variant="no-cards"
                    action={{ label: '+ Add a card', onClick: () => setAddingCard(true) }}
                  />
                </div>
                {/* Mobile: the column's single create action is the "Add a task" bar below */}
                <div className={styles.emptyMobile}>No tasks yet</div>
              </>
            )}
            {allCards.length > displayLimit && (
              <button 
                className={styles.showMoreBtn} 
                onClick={() => setDisplayLimit(l => l + 50)}
              >
                Show {Math.min(50, allCards.length - displayLimit)} more...
              </button>
            )}

            {/* Completed cards, folded away by default */}
            {completedCards.length > 0 && (
              <div className={styles.completedSection}>
                <button
                  className={styles.completedToggle}
                  onClick={() => setShowCompleted(!showCompleted)}
                  aria-expanded={showCompleted}
                >
                  <ChevronRight size={14} style={{ transform: showCompleted ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  Completed ({completedCards.length})
                </button>
                {showCompleted && completedCards.map((card) => (
                  <div
                    key={card.id}
                    className={styles.completedCard}
                    onClick={() => { setOpeningCardId(card.id); onModalOpenChange?.(true); }}
                  >
                    <button
                      className={styles.completedTick}
                      onClick={(e) => { e.stopPropagation(); setCompleted(card, false); }}
                      title="Mark as not completed"
                      aria-label={`Mark "${card.title}" as not completed`}
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <span className={styles.completedTitle}>{card.title}</span>
                  </div>
                ))}
              </div>
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
      ) : (
        // Desktop shows this only when the column has cards (the empty state has its own button);
        // mobile always shows it, so every column has exactly one create action.
        <button
          className={`${styles.addBtn} ${cards.length === 0 && completedCards.length === 0 ? styles.addBtnMobileOnly : ''}`}
          onClick={() => setAddingCard(true)}
        >
          <Plus size={14} className={styles.desktopOnlyIcon}/>
          <Plus size={20} className={styles.mobileOnlyIcon}/>
          <span className={styles.desktopOnlyIcon}>Add a card</span>
          <span className={styles.mobileOnlyIcon}>Add a task</span>
        </button>
      )}

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
    </div>
  );
}
