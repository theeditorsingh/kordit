'use client';
import { useState, useEffect, useRef } from 'react';
import { Board, Card, ChecklistItem, Label, Priority } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import { motion } from 'framer-motion';
import CommentSection from './CommentSection';
import {
  X, Plus, Trash2, Check, Calendar, Tag, Users, AlignLeft, List,
  Image, Clock, Play, Pause, Link2, Repeat, AlertTriangle, Sparkles, Loader2
} from 'lucide-react';
import { getInitials } from '@/utils/storage';
import styles from './CardModal.module.css';

interface Props { card: Card; board: Board; columnId: string; onClose: () => void; }

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const LABEL_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9','#FF7452','#FFC400'];
const COVER_COLORS = ['#0052CC','#36B37E','#FF5630','#FF991F','#6554C0','#00B8D9','#FF7452','#FFC400','#172B4D','#091E42'];

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function CardModal({ card, board, columnId, onClose }: Props) {
  const { dispatch, deleteCard: deleteCardFn, updateCard } = useBoardContext();
  const [data, setData] = useState<Card>({ ...card });
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'ai'>('details');
  const [timerDisplay, setTimerDisplay] = useState(data.timeSpent || 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI state
  const [aiLoading, setAiLoading] = useState<'subtasks' | 'date' | 'categorize' | null>(null);
  const [aiDateReasoning, setAiDateReasoning] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<string[]>([]);

  const isTimerRunning = !!data.timerStarted;

  useEffect(() => {
    if (isTimerRunning && data.timerStarted) {
      const startTime = new Date(data.timerStarted).getTime();
      const baseTime = data.timeSpent || 0;

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimerDisplay(baseTime + elapsed);
      }, 1000);

      return (
    <motion.div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && save()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="modal-box"
        style={{ maxWidth: 860 }}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
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
          <div className={styles.mainColumn}>
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

              {/* Inline AI Subtasks */}
              <div style={{ marginTop: 8 }}>
                <button
                  className={`btn btn-ghost btn-sm`}
                  onClick={aiGenerateSubtasks}
                  disabled={!!aiLoading}
                  style={{ color: 'var(--accent)' }}
                >
                  {aiLoading === 'subtasks' ? <><Loader2 size={13} className={styles.spin} /> Generating...</> : <><Sparkles size={13} /> Break into Subtasks</>}
                </button>
                {aiError && aiLoading === 'subtasks' && <div className={styles.aiError} style={{ marginTop: 4 }}>{aiError}</div>}
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

          <div className={styles.sidebarColumn}>
            {/* Quick Actions Row */}
            <div className={styles.quickActions}>
              <button
                className={`${styles.quickBtn} ${showCoverPicker ? styles.quickActive : ''}`}
                onClick={() => setShowCoverPicker(!showCoverPicker)}
              >
                <Image size={13} /> Cover
              </button>
              <button
                className={`${styles.quickBtn} ${showDependencies ? styles.quickActive : ''}`}
                onClick={() => setShowDependencies(!showDependencies)}
              >
                <Link2 size={13} /> Dependencies
              </button>
              <button
                className={`${styles.quickBtn} ${showRecurring ? styles.quickActive : ''}`}
                onClick={() => setShowRecurring(!showRecurring)}
              >
                <Repeat size={13} /> Recurring
              </button>
            </div>

            {/* Cover Picker */}
            {showCoverPicker && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Image size={14} /> Cover Color</div>
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

            {/* Labels */}
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

            {/* Due Date */}
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
                type="date"
                className="input"
                style={{ width: '100%' }}
                value={data.dueDate ?? ''}
                onChange={(e) => setData((d) => ({ ...d, dueDate: e.target.value || null }))}
              />
            </div>

            {/* Time Tracking */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}><Clock size={14} /> Time Tracking</div>
              <div className={styles.timerRow}>
                <span className={styles.timerDisplay} style={{ fontSize: 16 }}>{formatTime(timerDisplay)}</span>
                <button
                  className={`btn btn-sm ${isTimerRunning ? 'btn-danger' : 'btn-primary'}`}
                  onClick={toggleTimer}
                >
                  {isTimerRunning ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Start</>}
                </button>
              </div>
            </div>

            {/* Dependencies */}
            {showDependencies && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Link2 size={14} /> Blocked By</div>
                {blockedByCards.length > 0 && (
                  <div className={styles.depList}>
                    {blockedByCards.map(c => (
                      <div key={c.id} className={styles.depItem}>
                        <AlertTriangle size={12} style={{ color: '#FF5630' }} />
                        <span>{c.title}</span>
                        <button className={styles.depRemove} onClick={() => toggleDependency(c.id)}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <select
                  className="input"
                  style={{ fontSize: 12 }}
                  value=""
                  onChange={(e) => { if (e.target.value) toggleDependency(e.target.value); }}
                >
                  <option value="">Add dependency...</option>
                  {allCards.filter(c => !(data.blockedBy || []).includes(c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recurring */}
            {showRecurring && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}><Repeat size={14} /> Recurring Task</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={data.isRecurring || false}
                      onChange={(e) => setData(d => ({ ...d, isRecurring: e.target.checked }))}
                    />
                    Enable recurring
                  </label>
                </div>
                {data.isRecurring && (
                  <select
                    className="input"
                    style={{ fontSize: 12, marginTop: 6 }}
                    value={data.recurringRule || 'daily'}
                    onChange={(e) => setData(d => ({ ...d, recurringRule: e.target.value }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className="btn btn-danger btn-sm" onClick={deleteCard}>
            <Trash2 size={13}/> Delete Card
          </button>
          <button className="btn btn-primary" onClick={save}>Save Changes</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
