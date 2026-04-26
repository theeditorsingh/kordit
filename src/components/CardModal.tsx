'use client';
import { useState } from 'react';
import { Board, Card, ChecklistItem, Label, Priority } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { X, Plus, Trash2, Check, Calendar, Tag, Users, AlignLeft, List } from 'lucide-react';
import { getInitials } from '@/utils/storage';
import styles from './CardModal.module.css';

interface Props { card: Card; board: Board; columnId: string; onClose: () => void; }

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const LABEL_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9','#FF7452','#FFC400'];

export default function CardModal({ card, board, columnId, onClose }: Props) {
  const { dispatch } = useBoardContext();
  const [data, setData] = useState<Card>({ ...card });
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelForm, setShowLabelForm] = useState(false);

  function save() {
    dispatch({ type: 'UPDATE_CARD', boardId: board.id, card: data });
    onClose();
  }

  function deleteCard() {
    if (confirm('Delete this card?')) {
      dispatch({ type: 'DELETE_CARD', boardId: board.id, columnId, cardId: card.id });
      onClose();
    }
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

  function addLabel() {
    if (!newLabelName.trim()) return;
    const label: Label = { id: crypto.randomUUID(), name: newLabelName.trim(), color: newLabelColor };
    setData((d) => ({ ...d, labels: [...d.labels, label] }));
    setNewLabelName(''); setShowLabelForm(false);
  }

  function removeLabel(id: string) {
    setData((d) => ({ ...d, labels: d.labels.filter((l) => l.id !== id) }));
  }

  const doneCount = data.checklist.filter((c) => c.done).length;
  const totalCount = data.checklist.length;

  return (
    <div className="modal-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && save()}>
      <div className="modal-box animate-scale-in">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.priorityRow}>
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
          <button className="btn btn-ghost btn-icon" onClick={save}><X size={18}/></button>
        </div>

        <div className={styles.body}>
          {/* Title */}
          <input
            className={styles.titleInput}
            value={data.title}
            onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
            placeholder="Card title..."
          />

          {/* Description */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}><AlignLeft size={14}/> Description</div>
            <textarea
              className="input"
              value={data.description}
              onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Due Date */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}><Calendar size={14}/> Due Date</div>
            <input
              type="date"
              className="input"
              style={{ maxWidth: 200 }}
              value={data.dueDate ?? ''}
              onChange={(e) => setData((d) => ({ ...d, dueDate: e.target.value || null }))}
            />
          </div>

          {/* Labels */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}><Tag size={14}/> Labels</div>
            <div className={styles.labelList}>
              {data.labels.map((l) => (
                <span key={l.id} className={styles.labelChip} style={{ background: l.color }}>
                  {l.name}
                  <button onClick={() => removeLabel(l.id)} className={styles.chipX}><X size={10}/></button>
                </span>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLabelForm(!showLabelForm)}>
                <Plus size={12}/> Add
              </button>
            </div>
            {showLabelForm && (
              <div className={styles.labelForm}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                  placeholder="Label name..."
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                />
                <div className={styles.colorPicker}>
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`${styles.colorDot} ${newLabelColor === c ? styles.colorActive : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewLabelColor(c)}
                    />
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" onClick={addLabel}>Add</button>
              </div>
            )}
          </div>

          {/* Members */}
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

          {/* Checklist */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              <List size={14}/> Checklist
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
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className="btn btn-danger btn-sm" onClick={deleteCard}>
            <Trash2 size={13}/> Delete Card
          </button>
          <button className="btn btn-primary" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
