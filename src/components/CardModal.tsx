'use client';
import { useState, useEffect, useRef } from 'react';
import { Board, Card, ChecklistItem, Label, Priority } from '@/types';
import { useBoardContext } from '@/context/BoardContext';

import { useDialogFocus } from '@/hooks/useDialogFocus';
import CommentSection from './CommentSection';
import ColorField from './ColorField';
import { useConfirm } from './ConfirmDialog';
import {
  X, Plus, Trash2, Check, Calendar, Tag, Users, AlignLeft, List,
  Image as ImageIcon, Sparkles, Loader2, Bell, CheckCircle2, MoveRight, Copy
} from 'lucide-react';
import { getInitials } from '@/utils/storage';
import styles from './CardModal.module.css';
import { copyCardAcrossBoardsAction, moveCardAcrossBoardsAction } from '@/actions/boardActions';

interface Props { card: Card; board: Board; columnId: string; onClose: () => void; }

const PRIORITIES: Priority[] = ['none', 'urgent', 'high', 'medium', 'low'];
// Two rows of ten: strong colours on top, softer versions underneath
const LABEL_COLORS = [
  '#C00000', '#FF5630', '#FF991F', '#FFC400', '#7AB648', '#36B37E', '#00B8D9', '#0052CC', '#172B4D', '#6554C0',
  '#E774BB', '#FF7452', '#F5CD47', '#B3D334', '#57D9A3', '#79E2F2', '#4C9AFF', '#8777D9', '#8993A4', '#42526E',
];
const COVER_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9','#FF7452','#FFC400','#172B4D','#091E42'];

// Board-level label (from DB)
interface BoardLabel { id: string; name: string; color: string; }

type SaveStatus = 'idle' | 'saving' | 'saved';

function getReminderOption(dueDate: string, reminderAt: string): string {
  const due = new Date(dueDate).getTime();
  const rem = new Date(reminderAt).getTime();
  const diff = due - rem;
  if (diff <= 0) return 'at-time';
  if (Math.abs(diff - 15 * 60_000) < 60_000) return '15-min';
  if (Math.abs(diff - 60 * 60_000) < 60_000) return '1-hour';
  if (Math.abs(diff - 24 * 60 * 60_000) < 60_000) return '1-day';
  return 'at-time';
}

/** Convert any date string to the YYYY-MM-DDTHH:mm format needed by datetime-local inputs */
function toDatetimeLocal(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CardModal({ card, board, columnId, onClose }: Props) {
  const { state: boardState, deleteCard: deleteCardFn, updateCard, updateBoard, notifyError } = useBoardContext();
  const confirm = useConfirm();
  // Custom label colours saved on this board
  const savedColors = board.labelColors ?? [];
  const [showMoreColors, setShowMoreColors] = useState(false);
  const [customColor, setCustomColor] = useState('#1A73E8');
  const [data, setData] = useState<Card>({ ...card });
  // Snapshot of the card as it was when the modal opened, used to work out what changed
  const originalRef = useRef<Card>(card);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);


  // Board-level label library
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([]);
  const [recentLabels, setRecentLabels] = useState<BoardLabel[]>([]);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const closingRef = useRef(false);

  // AI state
  const [aiLoading, setAiLoading] = useState<'subtasks' | 'date' | 'categorize' | null>(null);
  const [aiDateReasoning, setAiDateReasoning] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<string[]>([]);
  const [targetBoardId, setTargetBoardId] = useState(board.id);
  const [targetColumnId, setTargetColumnId] = useState(columnId);
  const [transferBusy, setTransferBusy] = useState<'move' | 'copy' | null>(null);
  const [transferMessage, setTransferMessage] = useState('');

  const modalBoxRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  useDialogFocus(modalBoxRef);

  // ── Auto-focus title on open ────────────────────────────────────────────
  useEffect(() => {
    // On touch screens focusing would pop the keyboard over the card, so leave it
    if (window.matchMedia('(hover: none)').matches) return;
    // Short delay to allow animation to settle
    if (window.matchMedia('(max-width: 768px)').matches) return;
    const t = setTimeout(() => titleInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // ── Load board-level labels ─────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/boards/${board.id}/labels`)
      .then(r => r.json())
      .then((labels: BoardLabel[]) => {
        if (Array.isArray(labels)) {
          setBoardLabels(labels);
          // Show the 5 most recent as "recently used"
          setRecentLabels(labels.slice(0, 5));
        }
      })
      .catch(() => {/* non-fatal */});
  }, [board.id]);

  // ── Close label dropdown when clicking outside ─────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        labelDropdownRef.current &&
        !labelDropdownRef.current.contains(e.target as Node) &&
        labelInputRef.current &&
        !labelInputRef.current.contains(e.target as Node)
      ) {
        setLabelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Keyboard shortcuts: Ctrl+Enter to save, Escape to cancel ─────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || (e.target as HTMLElement)?.closest('[role="alertdialog"]')) return;
      // Escape: cancel with an unsaved-changes check
      if (e.key === 'Escape') {
        e.preventDefault();
        void requestClose();
        return;
      }
      // Ctrl+Enter: save & close
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        save();
        return;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function requestClose() {
    if (savingRef.current || transferBusy) return;
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      const dirty = JSON.stringify(data) !== JSON.stringify(originalRef.current);
      if (!dirty || await confirm('Discard your unsaved card changes?', { title: 'Unsaved changes', confirmLabel: 'Discard changes', danger: true })) onClose();
    } finally { closingRef.current = false; }
  }

  async function save() {
    if (savingRef.current) return;
    if (!data.title.trim()) { setSaveError('Enter a card title before saving.'); titleInputRef.current?.focus(); return; }
    savingRef.current = true;
    setSaveStatus('saving');
    setSaveError('');
    try {
    const original = originalRef.current;
    const patch: Partial<Card> = {};
    (Object.keys(data) as (keyof Card)[]).forEach((key) => {
      if (JSON.stringify(data[key]) !== JSON.stringify(original[key])) {
        (patch as Record<string, unknown>)[key] = data[key];
      }
    });
    if (Object.keys(patch).length > 0) {
      const latest = board.cards[card.id] ?? card;
      const saved = await updateCard(board.id, { ...latest, ...patch }, patch);
      if (!saved) throw new Error('Could not save. Your edits are still here. Please try again.');
    }
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      savingRef.current = false;
      setSaveStatus('idle');
    }
  }

  async function transferCard(kind: 'move' | 'copy') {
    const targetBoard = boardState.boards.find((item) => item.id === targetBoardId);
    if (!targetBoard || !targetColumnId || savingRef.current) return;
    savingRef.current = true;
    setTransferBusy(kind);
    setTransferMessage('');
    try {
      const original = originalRef.current;
      const patch: Partial<Card> = {};
      (Object.keys(data) as (keyof Card)[]).forEach((key) => {
        if (JSON.stringify(data[key]) !== JSON.stringify(original[key])) (patch as Record<string, unknown>)[key] = data[key];
      });
      if (Object.keys(patch).length && !await updateCard(board.id, { ...(board.cards[card.id] ?? card), ...patch }, patch)) throw new Error('Save failed. Please retry before moving or copying.');
      if (kind === 'move') {
        await moveCardAcrossBoardsAction(card.id, targetBoardId, targetColumnId);
        onClose();
        if (targetBoard.id !== board.id && targetBoard.ownerUsername) window.location.assign(`/${targetBoard.ownerUsername}/${targetBoard.slug}`);
      } else {
        await copyCardAcrossBoardsAction(card.id, targetBoardId, targetColumnId);
        setTransferMessage(`Copied to ${targetBoard.title}`);
      }
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : `Couldn’t ${kind} the card`);
    } finally {
      savingRef.current = false;
      setTransferBusy(null);
    }
  }

  function deleteCard() {
    // No confirmation: the delete message that appears has an Undo button
    deleteCardFn(board.id, columnId, card.id);
    onClose();
  }

  function toggleAssignee(memberId: string) {
    setData((d) => ({
      ...d,
      assigneeIds: d.assigneeIds.includes(memberId)
        ? d.assigneeIds.filter((id) => id !== memberId)
        : [...d.assigneeIds, memberId],
    }));
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const item: ChecklistItem = { id: crypto.randomUUID(), text: newCheckItem.trim(), done: false };
    setData((d) => ({ ...d, checklist: [...d.checklist, item] }));
    setNewCheckItem('');
  }

  function toggleCheckItem(id: string) {
    setData((d) => ({
      ...d,
      checklist: d.checklist.map((c) => c.id === id ? { ...c, done: !c.done } : c),
    }));
  }

  function removeCheckItem(id: string) {
    setData((d) => ({ ...d, checklist: d.checklist.filter((c) => c.id !== id) }));
  }

  // ── Label helpers ───────────────────────────────────────────────────────

  /** Pick an existing board label or create a new one */
  async function selectOrCreateLabel(name: string, color: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Check if already on this card
    if (data.labels.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) {
      setLabelDropdownOpen(false);
      setNewLabelName('');
      setLabelFilter('');
      return;
    }

    // Add to card locally
    const label: Label = { id: crypto.randomUUID(), name: trimmed, color };
    setData((d) => ({ ...d, labels: [...d.labels, label] }));

    // Persist to board label library
    try {
      const res = await fetch(`/api/boards/${board.id}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, color }),
      });
      if (res.ok) {
        const saved: BoardLabel = await res.json();
        setBoardLabels(prev => {
          const without = prev.filter(l => l.id !== saved.id);
          return [saved, ...without];
        });
        setRecentLabels(prev => {
          const without = prev.filter(l => l.name !== saved.name);
          return [saved, ...without].slice(0, 5);
        });
      }
    } catch {/* non-fatal */}

    setNewLabelName('');
    setLabelFilter('');
    setShowLabelForm(false);
    setLabelDropdownOpen(false);
  }

  // Remove a label from the board's list. Cards keep their own copy, so this card
  // and every other card that already has the label are left exactly as they are.
  async function removeBoardLabel(label: BoardLabel) {
    const ok = await confirm(`Remove "${label.name}" from the label list? Cards that already use it keep it.`, { title: 'Remove label', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/boards/${board.id}/labels?id=${encodeURIComponent(label.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Request failed');
      setBoardLabels((prev) => prev.filter((l) => l.id !== label.id));
      setRecentLabels((prev) => prev.filter((l) => l.id !== label.id));
    } catch {
      notifyError("Couldn't remove the label.");
    }
  }

  // "More colours": use the picked colour now and keep it in the board's saved list
  function applyCustomColor() {
    setNewLabelColor(customColor);
    if (!LABEL_COLORS.includes(customColor) && !savedColors.includes(customColor)) {
      updateBoard(board.id, { labelColors: [...savedColors, customColor].slice(-30) });
    }
    setShowMoreColors(false);
  }

  // Only the swatch goes; labels already using that colour are untouched
  function removeSavedColor(color: string) {
    updateBoard(board.id, { labelColors: savedColors.filter((c) => c !== color) });
  }

  function removeLabel(id: string) {
    setData((d) => ({ ...d, labels: d.labels.filter((l) => l.id !== id) }));
  }


  const doneCount = data.checklist.filter((c) => c.done).length;
  const totalCount = data.checklist.length;

  // Filtered label dropdown options
  const cardLabelNames = new Set(data.labels.map(l => l.name.toLowerCase()));
  const filteredBoardLabels = boardLabels.filter(l =>
    !cardLabelNames.has(l.name.toLowerCase()) &&
    l.name.toLowerCase().includes(labelFilter.toLowerCase())
  );
  const filteredRecentLabels = recentLabels.filter(l =>
    !cardLabelNames.has(l.name.toLowerCase()) &&
    l.name.toLowerCase().includes(labelFilter.toLowerCase())
  );
  const showCreateOption = labelFilter.trim() &&
    !boardLabels.some(l => l.name.toLowerCase() === labelFilter.trim().toLowerCase()) &&
    !cardLabelNames.has(labelFilter.trim().toLowerCase());

  // ── AI Functions ────────────────────────────────────────────────────────
  async function aiGenerateSubtasks() {
    setAiLoading('subtasks');
    setAiError(null);
    setSuggestedSubtasks([]);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subtasks', payload: { cardTitle: data.title, cardDescription: data.description } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSuggestedSubtasks(json.subtasks || []);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  }

  function addSuggestedSubtask(text: string) {
    const item: ChecklistItem = { id: crypto.randomUUID(), text, done: false };
    setData(d => ({ ...d, checklist: [...d.checklist, item] }));
    setSuggestedSubtasks(prev => prev.filter(s => s !== text));
  }

  function addAllSubtasks() {
    const items: ChecklistItem[] = suggestedSubtasks.map(text => ({ id: crypto.randomUUID(), text, done: false }));
    setData(d => ({ ...d, checklist: [...d.checklist, ...items] }));
    setSuggestedSubtasks([]);
  }

  async function aiSuggestDueDate() {
    setAiLoading('date');
    setAiError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'smart_due_date', payload: { cardTitle: data.title, priority: data.priority } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(d => ({ ...d, dueDate: json.suggestedDate }));
      setAiDateReasoning(json.reasoning);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  }

  async function aiCategorize() {
    setAiLoading('categorize');
    setAiError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_categorize', payload: { cardTitle: data.title } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const newLabels: Label[] = json.labels.map((name: string) => ({ id: crypto.randomUUID(), name, color: LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)] }));
      setData(d => ({ ...d, priority: json.priority as Priority, labels: [...d.labels, ...newLabels] }));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={modalBoxRef}
        className={`modal-box ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Card: ${data.title || 'Untitled'}`}
        style={{ maxWidth: 860 }}
        tabIndex={-1}
      >
        {/* Cover */}
        {(data.coverColor || data.coverImage) && (
          <div
            className={styles.cover}
            style={{
              background: data.coverImage ? `url(${data.coverImage}) center/cover` : data.coverColor,
            }}
          />
        )}

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.priorityRow} inert={saveStatus === 'saving' || !!transferBusy}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                className={`badge badge-${p} ${data.priority === p ? styles.priorityActive : styles.priorityBtn}`}
                onClick={() => setData((d) => ({ ...d, priority: p }))}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={requestClose} aria-label="Close card"><X size={18}/></button>
        </div>

        <div className={styles.body} inert={saveStatus === 'saving'}>
          {/* ── LEFT: Main Content ── */}
          <div className={styles.mainColumn}>
            {/* Title */}
            <input
              ref={titleInputRef}
              className={styles.titleInput}
              value={data.title}
              onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
              placeholder="Card title..."
            />

            {/* Description */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}><AlignLeft size={14}/> Description</div>
              <textarea
                className={`input ${styles.descInput}`}
                value={data.description}
                onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                placeholder="Add a description..."
                rows={3}
              />
            </div>

            {/* Checklist */}
            <div className={styles.section}>
              <div className={styles.sectionLabel} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><List size={14}/> Checklist</span>
                {totalCount > 0 && (
                  <span className={styles.checkProgress}>{doneCount}/{totalCount}</span>
                )}
              </div>
              {totalCount > 0 && (
                <div className="progress-bar" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${(doneCount / totalCount) * 100}%` }} />
                </div>
              )}
              <ul className={styles.checklist}>
                {data.checklist.map((item) => (
                  <li key={item.id} className={styles.checkItem}>
                    <button
                      className={`${styles.checkBox} ${item.done ? styles.checked : ''}`}
                      onClick={() => toggleCheckItem(item.id)}
                    >
                      {item.done && <Check size={11}/>}
                    </button>
                    <span className={`${styles.checkText} ${item.done ? styles.strikethrough : ''}`}>{item.text}</span>
                    <button className={styles.removeCheck} onClick={() => removeCheckItem(item.id)}>
                      <X size={11}/>
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.addCheck}>
                <input
                  className="input"
                  style={{ fontSize: 12, padding: '6px 10px' }}
                  placeholder="Add checklist item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCheckItem()}
                />
                <button className="btn btn-ghost btn-sm" onClick={addCheckItem}><Plus size={14}/></button>
              </div>

              {/* Inline AI: Generate Subtasks */}
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={aiGenerateSubtasks}
                  disabled={!!aiLoading}
                  style={{ color: 'var(--accent)' }}
                >
                  {aiLoading === 'subtasks' ? <><Loader2 size={13} className={styles.spin} /> Generating...</> : <><Sparkles size={13} /> Break into Subtasks</>}
                </button>
                {aiError && aiLoading === null && <div className={styles.aiError} style={{ marginTop: 4 }}>{aiError}</div>}
                {suggestedSubtasks.length > 0 && (
                  <div className={styles.aiSuggestions} style={{ marginTop: 8 }}>
                    <div className={styles.aiSuggestHeader}>
                      <span>Suggested subtasks:</span>
                      <button className="btn btn-ghost btn-sm" onClick={addAllSubtasks}>Add All</button>
                    </div>
                    {suggestedSubtasks.map((s, i) => (
                      <div key={i} className={styles.aiSuggestItem}>
                        <span>{s}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => addSuggestedSubtask(s)}
                          style={{ fontSize: 11, padding: '2px 8px' }}>+ Add</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div style={{ marginTop: 16 }}>
              <CommentSection boardId={board.id} cardId={card.id} />
            </div>
          </div>

          {/* ── RIGHT: Sidebar ── */}
          <div className={styles.sidebarColumn}>
            {/* Quick Actions Row */}
            <div className={styles.quickActions}>
              <button
                className={`${styles.quickBtn} ${showCoverPicker ? styles.quickActive : ''}`}
                onClick={() => setShowCoverPicker(!showCoverPicker)}
              >
                <ImageIcon size={13} /> Cover
              </button>
            </div>

            {/* Cover Picker */}
            {showCoverPicker && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><ImageIcon size={14} /> Cover Color</div>
                <div className={styles.coverGrid}>
                  {COVER_COLORS.map(c => (
                    <button
                      key={c}
                      className={`${styles.coverSwatch} ${data.coverColor === c ? styles.coverActive : ''}`}
                      style={{ background: c }}
                      onClick={() => setData(d => ({ ...d, coverColor: c, coverImage: '' }))}
                    />
                  ))}
                  <button
                    className={styles.coverSwatch}
                    style={{ background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setData(d => ({ ...d, coverColor: '', coverImage: '' }))}
                    title="Remove cover"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── LABELS (moved to top of sidebar) ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={14}/> Labels</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={aiCategorize}
                  disabled={!!aiLoading}
                  style={{ color: 'var(--accent)', padding: '2px 6px', fontSize: 11 }}
                  title="Auto-Categorize Priority & Labels"
                >
                  {aiLoading === 'categorize' ? <Loader2 size={11} className={styles.spin} /> : <Tag size={11} />} Auto
                </button>
              </div>
              <div className={styles.labelList}>
                {data.labels.map((l) => (
                  <span key={l.id} className={styles.labelChip} style={{ background: l.color }}>
                    {l.name}
                    <button onClick={() => removeLabel(l.id)} className={styles.chipX}><X size={10}/></button>
                  </span>
                ))}

                {/* Combobox trigger */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowLabelForm(true); setLabelDropdownOpen(true); setTimeout(() => labelInputRef.current?.focus(), 50); }}
                >
                  <Plus size={12}/> Add
                </button>
              </div>

              {/* Label combobox form */}
              {showLabelForm && (
                <div className={styles.labelForm}>
                  <div className={styles.labelComboWrap} style={{ position: 'relative' }}>
                    <input
                      ref={labelInputRef}
                      className="input"
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                      placeholder="Search or create label..."
                      value={labelFilter || newLabelName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLabelFilter(val);
                        setNewLabelName(val);
                        setLabelDropdownOpen(true);
                      }}
                      onFocus={() => setLabelDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLabelName.trim()) {
                          selectOrCreateLabel(newLabelName, newLabelColor);
                        }
                        if (e.key === 'Escape') {
                          // Close only the label picker, not the whole card
                          e.stopPropagation();
                          setLabelDropdownOpen(false);
                          setShowLabelForm(false);
                        }
                      }}
                    />

                    {/* Dropdown */}
                    {labelDropdownOpen && (
                      <div ref={labelDropdownRef} className={styles.labelDropdown}>
                        {/* Recently used section */}
                        {filteredRecentLabels.length > 0 && (
                          <>
                            <div className={styles.labelDropdownGroup}>Recently used</div>
                            {filteredRecentLabels.map(l => (
                              <div key={l.id} className={styles.labelOptionRow}>
                                <button
                                  className={styles.labelOption}
                                  onMouseDown={(e) => { e.preventDefault(); selectOrCreateLabel(l.name, l.color); }}
                                >
                                  <span className={styles.labelOptionDot} style={{ background: l.color }} />
                                  <span className={styles.labelOptionName}>{l.name}</span>
                                </button>
                                <button
                                  className={styles.labelOptionRemove}
                                  onMouseDown={(e) => { e.preventDefault(); removeBoardLabel(l); }}
                                  title="Remove from label list"
                                  aria-label={`Remove label ${l.name} from the list`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                            {filteredBoardLabels.filter(l => !filteredRecentLabels.some(r => r.id === l.id)).length > 0 && (
                              <div className={styles.labelDropdownDivider} />
                            )}
                          </>
                        )}

                        {/* All board labels (excluding recently used) */}
                        {filteredBoardLabels.filter(l => !filteredRecentLabels.some(r => r.id === l.id)).map(l => (
                          <div key={l.id} className={styles.labelOptionRow}>
                            <button
                              className={styles.labelOption}
                              onMouseDown={(e) => { e.preventDefault(); selectOrCreateLabel(l.name, l.color); }}
                            >
                              <span className={styles.labelOptionDot} style={{ background: l.color }} />
                              <span className={styles.labelOptionName}>{l.name}</span>
                            </button>
                            <button
                              className={styles.labelOptionRemove}
                              onMouseDown={(e) => { e.preventDefault(); removeBoardLabel(l); }}
                              title="Remove from label list"
                              aria-label={`Remove label ${l.name} from the list`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Create new option */}
                        {showCreateOption && (
                          <button
                            className={`${styles.labelOption} ${styles.labelOptionCreate}`}
                            onMouseDown={(e) => { e.preventDefault(); selectOrCreateLabel(newLabelName, newLabelColor); }}
                          >
                            <Plus size={12} />
                            <span>Create &ldquo;<strong>{labelFilter.trim()}</strong>&rdquo;</span>
                          </button>
                        )}

                        {/* Empty state */}
                        {filteredRecentLabels.length === 0 && filteredBoardLabels.length === 0 && !showCreateOption && (
                          <div className={styles.labelDropdownEmpty}>
                            {boardLabels.length === 0 ? 'No labels yet — type to create one' : 'No matching labels'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Color picker for new labels */}
                  <div className={styles.colorPicker}>
                    {LABEL_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`${styles.colorDot} ${newLabelColor === c ? styles.colorActive : ''}`}
                        style={{ background: c }}
                        onClick={() => setNewLabelColor(c)}
                        aria-label={`Colour ${c}`}
                      />
                    ))}
                  </div>

                  {/* Custom colours saved on this board */}
                  {savedColors.length > 0 && (
                    <>
                      <div className={styles.colorGroupLabel}>Saved colours</div>
                      <div className={styles.colorPicker}>
                        {savedColors.map((c) => (
                          <span key={c} className={styles.savedColor}>
                            <button
                              className={`${styles.colorDot} ${newLabelColor === c ? styles.colorActive : ''}`}
                              style={{ background: c }}
                              onClick={() => setNewLabelColor(c)}
                              aria-label={`Saved colour ${c}`}
                              title={c}
                            />
                            <button
                              className={styles.savedColorRemove}
                              onClick={() => removeSavedColor(c)}
                              title="Remove saved colour"
                              aria-label={`Remove saved colour ${c}`}
                            >
                              <X size={8} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  <button className={styles.moreColorsBtn} onClick={() => setShowMoreColors(!showMoreColors)} aria-expanded={showMoreColors}>
                    <span className={styles.moreColorsSwatch} /> More colours…
                  </button>
                  {showMoreColors && (
                    <div className={styles.moreColors}>
                      <ColorField label="Custom colour" value={customColor} onChange={setCustomColor} />
                      <button className="btn btn-primary btn-sm" onClick={applyCustomColor}>Use &amp; save</button>
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => selectOrCreateLabel(newLabelName, newLabelColor)}
                    disabled={!newLabelName.trim()}
                  >
                    Add Label
                  </button>
                </div>
              )}
            </div>

            {/* Members / Assignees */}
            {board.members.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Users size={14}/> Assignees</div>
                <div className={styles.memberGrid}>
                  {board.members.map((m) => {
                    const assigned = data.assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        className={`${styles.memberChip} ${assigned ? styles.memberAssigned : ''}`}
                        onClick={() => toggleAssignee(m.id)}
                      >
                        <span className="avatar avatar-sm" style={{ background: m.color }}>{getInitials(m.name)}</span>
                        <span className={styles.memberName}>{m.name}</span>
                        {assigned && <Check size={12} className={styles.memberCheck}/>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Due Date + Inline AI Suggest */}
            <div className={styles.section}>
              <div className={styles.sectionLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14}/> Due Date</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={aiSuggestDueDate}
                  disabled={!!aiLoading}
                  style={{ color: 'var(--accent)', padding: '2px 6px', fontSize: 11 }}
                  title="AI Suggest Date"
                >
                  {aiLoading === 'date' ? <Loader2 size={11} className={styles.spin} /> : <Calendar size={11} />} Suggest
                </button>
              </div>
              {aiDateReasoning && (
                <div className={styles.aiReasoning} style={{ fontSize: 11, marginBottom: 4 }}>
                  <span>📌 {aiDateReasoning}</span>
                </div>
              )}
              <input
                type="datetime-local"
                className="input"
                style={{ width: '100%' }}
                value={data.dueDate ? toDatetimeLocal(data.dueDate) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const iso = new Date(val).toISOString();
                    setData((d) => ({
                      ...d,
                      dueDate: iso,
                      reminderAt: d.reminderAt ? d.reminderAt : iso,
                    }));
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('kordit-has-reminder', 'true');
                    }
                  } else {
                    setData((d) => ({ ...d, dueDate: null, reminderAt: null }));
                  }
                }}
              />
            </div>

            {/* Reminder Picker */}
            {data.dueDate && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Bell size={14} /> Remind Me</div>
                <select
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={data.reminderAt ? getReminderOption(data.dueDate, data.reminderAt) : 'none'}
                  onChange={(e) => {
                    const val = e.target.value;
                    let reminderAt: string | null = null;
                    if (val !== 'none' && data.dueDate) {
                      const due = new Date(data.dueDate);
                      switch (val) {
                        case 'at-time': reminderAt = due.toISOString(); break;
                        case '15-min': reminderAt = new Date(due.getTime() - 15 * 60_000).toISOString(); break;
                        case '1-hour': reminderAt = new Date(due.getTime() - 60 * 60_000).toISOString(); break;
                        case '1-day': reminderAt = new Date(due.getTime() - 24 * 60 * 60_000).toISOString(); break;
                      }
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('kordit-has-reminder', 'true');
                      }
                    }
                    setData(d => ({ ...d, reminderAt }));
                  }}
                >
                  <option value="none">None</option>
                  <option value="at-time">At due time</option>
                  <option value="15-min">15 minutes before</option>
                  <option value="1-hour">1 hour before</option>
                  <option value="1-day">1 day before</option>
                </select>
              </div>
            )}

            <details className={styles.advancedSection}>
              <summary>Move or copy</summary>
              <select
                className="input"
                style={{ width: '100%', marginBottom: 8 }}
                aria-label="Destination board"
                value={targetBoardId}
                onChange={(event) => {
                  const nextBoard = boardState.boards.find((item) => item.id === event.target.value);
                  setTargetBoardId(event.target.value);
                  setTargetColumnId(nextBoard?.columns[0]?.id ?? '');
                }}
              >
                {boardState.boards.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <select aria-label="Destination column" className="input" style={{ width: '100%', marginBottom: 8 }} value={targetColumnId} onChange={(event) => setTargetColumnId(event.target.value)}>
                {boardState.boards.find((item) => item.id === targetBoardId)?.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" disabled={!!transferBusy || !targetColumnId} onClick={() => transferCard('move')}>
                  {transferBusy === 'move' ? <Loader2 size={13} className={styles.spin} /> : <MoveRight size={13} />} Move
                </button>
                <button className="btn btn-ghost btn-sm" disabled={!!transferBusy || !targetColumnId} onClick={() => transferCard('copy')}>
                  {transferBusy === 'copy' ? <Loader2 size={13} className={styles.spin} /> : <Copy size={13} />} Copy
                </button>
              </div>
              {transferMessage && <p style={{ margin: '7px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{transferMessage}</p>}
            </details>


          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <details className={styles.cardActions} inert={saveStatus === 'saving'}><summary>More actions</summary><button className="btn btn-danger btn-sm" onClick={deleteCard}>
            <Trash2 size={13}/> Delete Card
          </button></details>
          {saveError && <p className={styles.saveError} role="alert">{saveError}</p>}
          <div className={styles.footerRight}>
            {/* Saved indicator */}
            {saveStatus === 'saving' && (
              <span className={styles.saveIndicator}>
                <Loader2 size={13} className={styles.spin} /> Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className={`${styles.saveIndicator} ${styles.saveIndicatorSaved}`}>
                <CheckCircle2 size={13} /> Saved
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className={styles.saveHint}>Ctrl+Enter to save</span>
            )}
            <button className="btn btn-ghost" disabled={saveStatus === 'saving' || !!transferBusy} onClick={requestClose} title="Cancel editing">Cancel</button>
            <button className="btn btn-primary" disabled={saveStatus === 'saving'} onClick={save}>{saveStatus === 'saving' ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
