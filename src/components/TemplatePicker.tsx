'use client';
/**
 * Template chooser: illustrated cards on the left, a preview of the selected
 * template's board on the right. Selecting only previews; "Use this template"
 * (or double-click / Enter on a card) creates the board.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { TEMPLATES, type BoardTemplate } from '@/utils/templates';
import TemplateArt from './TemplateArt';
import styles from './TemplatePicker.module.css';

interface Props {
  onUse: (template: BoardTemplate) => void | Promise<void>;
  /** Fill the parent's height (dialog); otherwise the preview keeps its own height and stays in view */
  fill?: boolean;
}

// Placeholder cards per preview column (neutral bars, not invented tasks)
const BARS = [3, 2, 3, 1, 2, 2, 1];

export default function TemplatePicker({ onUse, fill }: Props) {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];

  async function pick(template: BoardTemplate) {
    if (busy) return;
    setBusy(true);
    try { await onUse(template); } finally { setBusy(false); }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 2, ArrowLeft: -1, ArrowUp: -2 };
    if (event.key === 'Enter') { event.preventDefault(); pick(TEMPLATES[index]); return; }
    let next = -1;
    if (event.key in step) next = index + step[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TEMPLATES.length - 1;
    if (next < 0 || next >= TEMPLATES.length) return;
    event.preventDefault();
    const id = TEMPLATES[next].id;
    setSelectedId(id);
    cardRefs.current[id]?.focus();
  }

  if (!selected) return null;

  return (
    <div className={`${styles.picker} ${fill ? styles.fill : ''}`}>
      <div className={styles.cards} role="radiogroup" aria-label="Board templates">
        {TEMPLATES.map((tpl, index) => {
          const active = tpl.id === selected.id;
          return (
            <button
              key={tpl.id}
              ref={(el) => { cardRefs.current[tpl.id] = el; }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              className={`${styles.card} ${active ? styles.cardActive : ''}`}
              style={{ '--tpl': tpl.color } as CSSProperties}
              onClick={() => setSelectedId(tpl.id)}
              onDoubleClick={() => pick(tpl)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <span className={styles.art}><TemplateArt templateId={tpl.id} /></span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>{tpl.title}</span>
                <span className={styles.cardMeta}>{tpl.columns.length} columns</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.preview} aria-live="polite" aria-label={`Preview: ${selected.title}`} style={{ '--tpl': selected.color } as CSSProperties}>
        <div className={styles.previewHead}>
          <span className={styles.previewArt}><TemplateArt templateId={selected.id} size={40} /></span>
          <div className={styles.previewText}>
            <h3 className={styles.previewTitle}>{selected.title}</h3>
            <p className={styles.previewDesc}>{selected.description}</p>
          </div>
        </div>

        <div className={styles.miniBoard} aria-hidden="true">
          {selected.columns.map((col, i) => (
            <div key={`${col.title}-${i}`} className={styles.miniCol}>
              <div className={styles.miniColHead}>
                <span className={styles.miniDot} style={{ background: col.color }} />
                <span className={styles.miniColTitle}>{col.title}</span>
              </div>
              {Array.from({ length: BARS[i % BARS.length] }).map((_, b) => (
                <span key={b} className={styles.miniCard}><i style={{ width: `${[78, 56, 68][b % 3]}%` }} /></span>
              ))}
              <span className={styles.miniAdd} />
            </div>
          ))}
        </div>
        {/* The same information for screen readers */}
        <p className={styles.srOnly}>Columns: {selected.columns.map((c) => c.title).join(', ')}.</p>

        <div className={styles.previewFoot}>
          <span className={styles.previewNote}>Creates a board named “{selected.title}” with {selected.columns.length} columns.</span>
          <button type="button" className={`btn btn-primary ${styles.useBtn}`} onClick={() => pick(selected)} disabled={busy}>
            {busy ? 'Creating…' : 'Use this template'} <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
