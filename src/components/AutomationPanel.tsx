'use client';
import { useState, useEffect } from 'react';
import { Automation, AutomationTrigger, AutomationAction } from '@/types';
import { useBoardContext } from '@/context/BoardContext';
import {
  createAutomationAction, updateAutomationAction, deleteAutomationAction
} from '@/actions/boardActions';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, X, ArrowRight } from 'lucide-react';
import styles from './AutomationPanel.module.css';

interface Props {
  boardId: string;
  onClose: () => void;
}

const TRIGGERS: { value: AutomationTrigger; label: string; description: string }[] = [
  { value: 'card_moved_to', label: 'Card moved to column', description: 'When a card enters a specific column' },
  { value: 'card_created', label: 'Card created', description: 'When a new card is created' },
  { value: 'checklist_completed', label: 'Checklist completed', description: 'When all checklist items are done' },
  { value: 'due_date_passed', label: 'Due date passed', description: 'When a card becomes overdue' },
];

const ACTIONS: { value: AutomationAction; label: string }[] = [
  { value: 'move_card', label: 'Move card to column' },
  { value: 'set_priority', label: 'Set priority' },
  { value: 'complete_checklist', label: 'Mark all checklist items done' },
  { value: 'set_due_date', label: 'Set due date' },
];

export default function AutomationPanel({ boardId, onClose }: Props) {
  const { activeBoard } = useBoardContext();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('card_moved_to');
  const [conditionColId, setConditionColId] = useState('');
  const [action, setAction] = useState<AutomationAction>('move_card');
  const [targetColId, setTargetColId] = useState('');
  const [targetPriority, setTargetPriority] = useState('urgent');
  const [daysFromNow, setDaysFromNow] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/automations?boardId=${boardId}`);
        if (res.ok) setAutomations(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [boardId]);

  async function handleCreate() {
    if (!name.trim()) return;

    const condition: Record<string, any> = {};
    if (trigger === 'card_moved_to' && conditionColId) {
      condition.columnId = conditionColId;
    }

    const actionConfig: Record<string, any> = {};
    if (action === 'move_card' && targetColId) actionConfig.targetColumnId = targetColId;
    if (action === 'set_priority') actionConfig.priority = targetPriority;
    if (action === 'set_due_date') actionConfig.daysFromNow = daysFromNow;

    try {
      const rawAuto = await createAutomationAction(boardId, name, trigger, condition, action, actionConfig);
      const auto: Automation = {
        id: rawAuto.id,
        name: rawAuto.name,
        isActive: rawAuto.isActive,
        trigger: rawAuto.trigger as AutomationTrigger,
        condition: rawAuto.condition as Record<string, any>,
        action: rawAuto.action as AutomationAction,
        actionConfig: rawAuto.actionConfig as Record<string, any>,
        boardId: rawAuto.boardId,
      };
      setAutomations(prev => [auto, ...prev]);
      resetForm();
    } catch (e) {
      console.error("Failed to create automation", e);
    }
  }

  async function handleToggle(autoId: string, isActive: boolean) {
    try {
      await updateAutomationAction(boardId, autoId, { isActive: !isActive });
      setAutomations(prev => prev.map(a => a.id === autoId ? { ...a, isActive: !isActive } : a));
    } catch (e) {
      console.error("Failed to toggle automation", e);
    }
  }

  async function handleDelete(autoId: string) {
    try {
      await deleteAutomationAction(boardId, autoId);
      setAutomations(prev => prev.filter(a => a.id !== autoId));
    } catch (e) {
      console.error("Failed to delete automation", e);
    }
  }

  function resetForm() {
    setShowForm(false);
    setName('');
    setTrigger('card_moved_to');
    setConditionColId('');
    setAction('move_card');
    setTargetColId('');
    setTargetPriority('urgent');
    setDaysFromNow(0);
  }

  function getTriggerLabel(t: string) {
    return TRIGGERS.find(tr => tr.value === t)?.label || t;
  }
  function getActionLabel(a: string) {
    return ACTIONS.find(ac => ac.value === a)?.label || a;
  }

  const columns = activeBoard?.columns || [];

  return (
    <div className="modal-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-scale-in" style={{ maxWidth: 520 }}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Zap size={18} />
            <h2>Automations</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>Loading automations...</div>
          ) : (
            <>
              {automations.length === 0 && !showForm && (
                <div className={styles.empty}>
                  <Zap size={32} />
                  <p>No automations yet. Create one to automate repetitive tasks.</p>
                </div>
              )}

              {automations.map((auto) => (
                <div key={auto.id} className={styles.autoItem}>
                  <div className={styles.autoInfo}>
                    <div className={styles.autoName}>{auto.name}</div>
                    <div className={styles.autoRule}>
                      <span className={styles.triggerBadge}>{getTriggerLabel(auto.trigger)}</span>
                      <ArrowRight size={12} />
                      <span className={styles.actionBadge}>{getActionLabel(auto.action)}</span>
                    </div>
                  </div>
                  <div className={styles.autoActions}>
                    <button
                      className={styles.toggleBtn}
                      onClick={() => handleToggle(auto.id, auto.isActive)}
                      title={auto.isActive ? 'Disable' : 'Enable'}
                    >
                      {auto.isActive
                        ? <ToggleRight size={20} style={{ color: '#36B37E' }} />
                        : <ToggleLeft size={20} style={{ color: 'var(--text-muted)' }} />
                      }
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(auto.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {showForm ? (
                <div className={styles.form}>
                  <input
                    className="input"
                    placeholder="Automation name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />

                  <div className={styles.formRow}>
                    <label className={styles.label}>When</label>
                    <select className={styles.select} value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
                      {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {trigger === 'card_moved_to' && (
                    <div className={styles.formRow}>
                      <label className={styles.label}>Column</label>
                      <select className={styles.select} value={conditionColId} onChange={(e) => setConditionColId(e.target.value)}>
                        <option value="">Any column</option>
                        {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )}

                  <div className={styles.formRow}>
                    <label className={styles.label}>Then</label>
                    <select className={styles.select} value={action} onChange={(e) => setAction(e.target.value as AutomationAction)}>
                      {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>

                  {action === 'move_card' && (
                    <div className={styles.formRow}>
                      <label className={styles.label}>To column</label>
                      <select className={styles.select} value={targetColId} onChange={(e) => setTargetColId(e.target.value)}>
                        <option value="">Select column</option>
                        {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )}

                  {action === 'set_priority' && (
                    <div className={styles.formRow}>
                      <label className={styles.label}>Priority</label>
                      <select className={styles.select} value={targetPriority} onChange={(e) => setTargetPriority(e.target.value)}>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  )}

                  {action === 'set_due_date' && (
                    <div className={styles.formRow}>
                      <label className={styles.label}>Days from now</label>
                      <input
                        type="number"
                        className="input"
                        style={{ maxWidth: 100 }}
                        value={daysFromNow}
                        onChange={(e) => setDaysFromNow(parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                  )}

                  <div className={styles.formActions}>
                    <button className="btn btn-primary btn-sm" onClick={handleCreate}>Create</button>
                    <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className={styles.addBtn} onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Create Automation
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
