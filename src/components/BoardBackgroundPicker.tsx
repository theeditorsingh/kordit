'use client';
import { useEffect, useState } from 'react';
import { ArrowUp, ArrowLeftRight, Check, X } from 'lucide-react';
import { Board } from '@/types';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import {
  BackgroundType, DEFAULT_GRADIENT, PRESET_COLORS, PRESET_GRADIENTS,
  buildGradient, isHexColor, isValidBackground, parseGradient,
} from '@/utils/boardBackground';
import styles from './BoardBackgroundPicker.module.css';

interface Props {
  board: Board;
  onApply: (background: string, backgroundType: BackgroundType) => void;
  onClose: () => void;
}

type Tab = 'presets' | 'solid' | 'gradient';

// Clockwise from "to top"; the arrow icon is rotated by the same angle
const DIRECTIONS = [
  { angle: 0, label: 'Bottom to top' },
  { angle: 45, label: 'Bottom-left to top-right' },
  { angle: 90, label: 'Left to right' },
  { angle: 135, label: 'Top-left to bottom-right' },
  { angle: 180, label: 'Top to bottom' },
  { angle: 225, label: 'Top-right to bottom-left' },
  { angle: 270, label: 'Right to left' },
  { angle: 315, label: 'Bottom-right to top-left' },
];

/** A native colour picker paired with a hex text box */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  // While typing, show what was typed (it may not be a full hex yet); otherwise show the value
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;

  return (
    <label className={styles.colorField}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorInput}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} colour picker`}
        />
        <input
          className={`input ${styles.hexInput}`}
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label} hex code`}
          aria-invalid={!isHexColor(text)}
          onChange={(e) => {
            let next = e.target.value.trim();
            if (next && !next.startsWith('#')) next = `#${next}`;
            setDraft(next);
            if (isHexColor(next)) onChange(next.toUpperCase());
          }}
          onBlur={() => setDraft(null)}
        />
      </span>
    </label>
  );
}

export default function BoardBackgroundPicker({ board, onApply, onClose }: Props) {
  const current = board.background || '';
  const currentGradient = board.backgroundType === 'gradient' ? parseGradient(current) : null;
  const currentSolid = board.backgroundType === 'color' && isHexColor(current) ? current.toUpperCase() : null;

  const [tab, setTab] = useState<Tab>(
    currentSolid ? 'solid' : currentGradient && !PRESET_GRADIENTS.includes(current) ? 'gradient' : 'presets'
  );
  const [solid, setSolid] = useState(currentSolid ?? PRESET_COLORS[0]);
  const [from, setFrom] = useState((currentGradient?.from ?? DEFAULT_GRADIENT.from).toUpperCase());
  const [to, setTo] = useState((currentGradient?.to ?? DEFAULT_GRADIENT.to).toUpperCase());
  const [angle, setAngle] = useState(currentGradient?.angle ?? DEFAULT_GRADIENT.angle);

  const swipe = useSwipeDown({ onDismiss: onClose });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gradient = buildGradient(angle, from, to);
  const preview = tab === 'solid' ? solid : tab === 'gradient' ? gradient : current;

  function apply(background: string, type: BackgroundType) {
    if (!isValidBackground(type, background)) return;
    onApply(background, type);
    onClose();
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={styles.picker}
        role="dialog"
        aria-label="Board background"
        style={swipe.dragStyle}
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
      >
        <div className={styles.grabber} />
        <div className={styles.header}>
          <span className={styles.title}>Board background</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div
          className={`${styles.preview} ${preview ? '' : styles.previewEmpty}`}
          style={preview ? { background: preview } : undefined}
        >
          {!preview && 'No background'}
        </div>

        <div className={styles.tabs} role="tablist">
          {(['presets', 'solid', 'gradient'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'presets' ? 'Presets' : t === 'solid' ? 'Solid' : 'Gradient'}
            </button>
          ))}
        </div>

        {tab === 'presets' && (
          <div className={styles.grid}>
            {PRESET_GRADIENTS.map((g) => (
              <button
                key={g}
                className={`${styles.swatch} ${current === g ? styles.swatchActive : ''}`}
                style={{ background: g }}
                onClick={() => apply(g, 'gradient')}
                aria-label="Preset gradient"
              >
                {current === g && <Check size={14} />}
              </button>
            ))}
            <button
              className={`${styles.swatch} ${styles.swatchNone} ${!current ? styles.swatchActive : ''}`}
              onClick={() => apply('', 'color')}
              title="No background"
              aria-label="No background"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {tab === 'solid' && (
          <>
            <div className={styles.grid}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.swatch} ${styles.swatchSmall} ${solid === c ? styles.swatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setSolid(c)}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
            <ColorField label="Custom colour" value={solid} onChange={setSolid} />
            <button className={`btn btn-primary ${styles.apply}`} onClick={() => apply(solid, 'color')}>
              Apply colour
            </button>
          </>
        )}

        {tab === 'gradient' && (
          <>
            <div className={styles.gradientRow}>
              <ColorField label="Start" value={from} onChange={setFrom} />
              <button
                className={`btn btn-ghost btn-icon btn-sm ${styles.swap}`}
                onClick={() => { setFrom(to); setTo(from); }}
                title="Swap colours"
                aria-label="Swap colours"
              >
                <ArrowLeftRight size={14} />
              </button>
              <ColorField label="End" value={to} onChange={setTo} />
            </div>
            <div className={styles.fieldLabel}>Direction</div>
            <div className={styles.directions}>
              {DIRECTIONS.map((d) => (
                <button
                  key={d.angle}
                  className={`${styles.direction} ${angle === d.angle ? styles.directionActive : ''}`}
                  onClick={() => setAngle(d.angle)}
                  title={d.label}
                  aria-label={d.label}
                  aria-pressed={angle === d.angle}
                >
                  <ArrowUp size={14} style={{ transform: `rotate(${d.angle}deg)` }} />
                </button>
              ))}
            </div>
            <button className={`btn btn-primary ${styles.apply}`} onClick={() => apply(gradient, 'gradient')}>
              Apply gradient
            </button>
          </>
        )}
      </div>
    </>
  );
}
