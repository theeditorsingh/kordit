'use client';
import { useBoardContext } from '@/context/BoardContext';
import { X, Trash2, ArrowRight, Copy, ChevronDown } from 'lucide-react';
import styles from './BulkActionBar.module.css';

export default function BulkActionBar() {
  const { state, activeBoard, clearSelection, bulkDelete, bulkMove, bulkCopy } = useBoardContext();
  
  const selectedCount = state.selectedCardIds.length;

  if (selectedCount === 0 || !activeBoard) return null;

  const handleDelete = () => {
    if (confirm(`Delete ${selectedCount} cards? This cannot be undone.`)) {
      bulkDelete(activeBoard.id, state.selectedCardIds);
    }
  };

  const handleMove = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const colId = e.target.value;
    if (!colId) return;
    bulkMove(activeBoard.id, state.selectedCardIds, colId);
    e.target.value = ""; // reset dropdown
  };

  const handleCopy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const colId = e.target.value;
    if (!colId) return;
    bulkCopy(activeBoard.id, state.selectedCardIds, colId);
    e.target.value = ""; // reset dropdown
  };

  return (
    <div className={styles.actionBar}>
      <div className={styles.count}>
        <button className={styles.closeBtn} onClick={clearSelection} title="Clear selection">
          <X size={14} />
        </button>
        {selectedCount} card{selectedCount > 1 ? 's' : ''} selected
      </div>

      <div className={styles.actions}>
        <div className={styles.selectWrap}>
          <select className={styles.select} onChange={handleMove} defaultValue="">
            <option value="" disabled>Move to...</option>
            {activeBoard.columns.map(col => (
              <option key={`move-${col.id}`} value={col.id}>{col.title}</option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.selectIcon} />
        </div>

        <div className={styles.selectWrap}>
          <select className={styles.select} onChange={handleCopy} defaultValue="">
            <option value="" disabled>Copy to...</option>
            {activeBoard.columns.map(col => (
              <option key={`copy-${col.id}`} value={col.id}>{col.title}</option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.selectIcon} />
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 8px' }} />

        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          <Trash2 size={14} /> Delete All
        </button>
      </div>
    </div>
  );
}
