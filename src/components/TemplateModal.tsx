'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useBoardContext } from '@/context/BoardContext';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import type { BoardTemplate } from '@/utils/templates';
import TemplatePicker from './TemplatePicker';
import styles from './TemplateModal.module.css';

interface Props {
  onClose: () => void;
}

export default function TemplateModal({ onClose }: Props) {
  const { createBoard } = useBoardContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleUse(template: BoardTemplate) {
    await createBoard(template.title, template.columns); // opens the new board
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="template-modal-title">Create from template</h2>
            <p>Pick a template to see its board, then create it.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.content}>
          <TemplatePicker onUse={handleUse} fill />
        </div>
      </div>
    </div>
  );
}
