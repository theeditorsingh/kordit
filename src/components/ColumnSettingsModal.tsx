'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Trash2, X } from 'lucide-react';
import { Board, Column, ColumnSettings, ColumnSort, Label, Priority } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { useConfirm } from './ConfirmDialog';
import ColorField from './ColorField';
import { SORT_OPTIONS } from '@/utils/columnSettings';
import { isHexColor } from '@/utils/boardBackground';
import styles from './ColumnSettingsModal.module.css';

interface Props {
  column: Column;
  board: Board;
  onClose: () => void;
}

const COL_COLORS = ['#0052CC', '#36B37E', '#FF5630', '#FF991F', '#6554C0', '#00B8D9', '#172B4D'];
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ColumnSettingsModal({ column, board, onClose }: Props) {
  const { updateColumn, bulkMove, bulkDelete, deleteColumn } = useBoardContext();
  const confirm = useConfirm();
  const settings = column.settings ?? {};

  const [title, setTitle] = useState(column.title);
  const [color, setColor] = useState(column.color);
  const [showCustomColor, setShowCustomColor] = useState(!COL_COLORS.includes(column.color));
  const [wipLimit, setWipLimit] = useState(column.wipLimit || 0);
  const [sortBy, setSortBy] = useState<ColumnSort>(settings.sortBy ?? 'manual');
  const [defaultPriority, setDefaultPriority] = useState<Priority>(settings.defaultPriority ?? 'none');
  const [defaultLabel, setDefaultLabel] = useState<Label | null>(settings.defaultLabel ?? null);
  const [autoComplete, setAutoComplete] = useState(!!settings.autoComplete);
  const [moveTarget, setMoveTarget] = useState('');

  // Labels to offer as the default: the board's label list, plus the current choice if it was removed from it
  const [labelOptions, setLabelOptions] = useState<Label[]>(settings.defaultLabel ? [settings.defaultLabel] : []);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/boards/${board.id}/labels`)
      .then((r) => r.json())
      .then((labels: Label[]) => {
        if (cancelled || !Array.isArray(labels)) return;
        setLabelOptions((current) => {
          const byName = new Map<string, Label>();
          [...labels, ...current].forEach((l) => { if (!byName.has(l.name)) byName.set(l.name, l); });
          return [...byName.values()];
        });
      })
      .catch(() => { /* the picker just stays with what it has */ });
    return () => { cancelled = true; };
  }, [board.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cards = column.cardIds.map((id) => board.cards[id]).filter(Boolean);
  const openIds = cards.filter((c) => !c.completedAt).map((c) => c.id);
  const completedIds = cards.filter((c) => c.completedAt).map((c) => c.id);
  const otherColumns = board.columns.filter((c) => c.id !== column.id);
  const canSave = title.trim().length > 0 && isHexColor(color);

  function save() {
    if (!canSave) return;
    const next: ColumnSettings = {};
    if (sortBy !== 'manual') next.sortBy = sortBy;
    if (defaultPriority !== 'none') next.defaultPriority = defaultPriority;
    if (defaultLabel) next.defaultLabel = defaultLabel;
    if (autoComplete) next.autoComplete = true;
    updateColumn(board.id, column.id, {
      title: title.trim(),
      color,
      wipLimit: Math.max(0, wipLimit),
      settings: next,
    });
    onClose();
  }

  function moveAll() {
    if (!moveTarget || cards.length === 0) return;
    bulkMove(board.id, cards.map((c) => c.id), moveTarget);
    setMoveTarget('');
  }

  async function deleteCompleted() {
    const n = completedIds.length;
    if (n === 0) return;
    if (await confirm(`Delete ${n} completed card${n === 1 ? '' : 's'} from "${column.title}"?`, { title: 'Delete completed cards' })) {
      bulkDelete(board.id, completedIds);
    }
  }

  async function removeColumn() {
    const n = cards.length;
    const what = n > 0 ? ` and its ${n} card${n === 1 ? '' : 's'}` : '';
    if (await confirm(`Delete "${column.title}"${what}?`, { title: 'Delete column' })) {
      deleteColumn(board.id, column.id);
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${styles.box}`} role="dialog" aria-modal="true" aria-label={`Settings for column ${column.title}`}>
        <div className={styles.header}>
          <span className={styles.heading}>Column settings</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* ── General ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>General</h3>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className={styles.field}>
              <span className={styles.label}>Colour</span>
              <div className={styles.swatches}>
                {COL_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`${styles.swatch} ${color === c ? styles.swatchActive : ''}`}
                    style={{ background: c }}
                    onClick={() => { setColor(c); setShowCustomColor(false); }}
                    aria-label={`Colour ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
                <button
                  className={`${styles.swatch} ${styles.swatchCustom} ${showCustomColor ? styles.swatchActive : ''}`}
                  style={showCustomColor ? { background: color } : undefined}
                  onClick={() => setShowCustomColor(true)}
                  title="Custom colour"
                  aria-label="Custom colour"
                >
                  {!showCustomColor && '+'}
                </button>
              </div>
              {showCustomColor && <ColorField label="Custom colour" value={color} onChange={setColor} />}
            </div>
            <label className={styles.field}>
              <span className={styles.label}>WIP limit</span>
              <span className={styles.inline}>
                <input
                  type="number"
                  className="input"
                  style={{ width: 90 }}
                  min={0}
                  value={wipLimit}
                  onChange={(e) => setWipLimit(parseInt(e.target.value) || 0)}
                />
                <span className={styles.hint}>Most open cards allowed. 0 = no limit.</span>
              </span>
            </label>
          </section>

          {/* ── Sort ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sort cards</h3>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as ColumnSort)} aria-label="Sort cards">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {sortBy !== 'manual' && (
              <p className={styles.hint}>Cards can&apos;t be dragged into a different position inside this column while it is sorted. Dragging to another column still works.</p>
            )}
          </section>

          {/* ── New cards ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>New cards</h3>
            <p className={styles.hint}>Cards added to this column start with these.</p>
            <div className={styles.twoCols}>
              <label className={styles.field}>
                <span className={styles.label}>Priority</span>
                <select className="input" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value as Priority)}>
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Label</span>
                <select
                  className="input"
                  value={defaultLabel?.name ?? ''}
                  onChange={(e) => setDefaultLabel(labelOptions.find((l) => l.name === e.target.value) ?? null)}
                >
                  <option value="">None</option>
                  {labelOptions.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* ── Automation ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Automation</h3>
            <label className={styles.check}>
              <input type="checkbox" checked={autoComplete} onChange={(e) => setAutoComplete(e.target.checked)} />
              <span>
                Mark cards completed when moved here
                <span className={styles.hint}>They go straight to this column&apos;s Completed section.</span>
              </span>
            </label>
          </section>

          {/* ── Bulk actions (apply immediately) ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Bulk actions</h3>
            <div className={styles.inline}>
              <select
                className="input"
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                aria-label="Move all cards to"
                disabled={cards.length === 0 || otherColumns.length === 0}
              >
                <option value="">Move all {cards.length} card{cards.length === 1 ? '' : 's'} to…</option>
                {otherColumns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={moveAll} disabled={!moveTarget}>
                <ArrowRight size={14} /> Move
              </button>
            </div>
            <button className={`btn btn-ghost btn-sm ${styles.rowBtn}`} onClick={deleteCompleted} disabled={completedIds.length === 0}>
              <Trash2 size={14} /> Delete completed cards ({completedIds.length})
            </button>
            <button className={`btn btn-danger btn-sm ${styles.rowBtn}`} onClick={removeColumn}>
              <Trash2 size={14} /> Delete column
            </button>
            <p className={styles.hint}>{openIds.length} open, {completedIds.length} completed.</p>
          </section>
        </div>

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!canSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
