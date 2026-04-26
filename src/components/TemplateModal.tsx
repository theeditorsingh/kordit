'use client';
import { useBoardContext } from '@/context/BoardContext';
import { X, ExternalLink, ArrowLeft } from 'lucide-react';
import { TEMPLATES, BoardTemplate } from '@/utils/templates';
import styles from './TemplateModal.module.css';

interface Props {
  onClose: () => void;
}

export default function TemplateModal({ onClose }: Props) {
  const { createBoard } = useBoardContext();

  const handleSelect = (template: BoardTemplate) => {
    createBoard(template.title, template.columns);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            <button className={styles.closeBtn} style={{ marginRight: 8 }} onClick={onClose}>
              <ArrowLeft size={16} />
            </button>
            Create from template
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.sectionTitle}>Top templates</div>
          <div className={styles.templateList}>
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} className={styles.templateItem} onClick={() => handleSelect(tpl)}>
                <div className={styles.templateIcon} style={{ backgroundColor: tpl.color }} />
                <span className={styles.templateTitle}>{tpl.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.exploreInfo}>
            <ExternalLink size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>See hundreds of templates from the Kordit community</span>
          </div>
          <button className={styles.exploreBtn}>Explore templates</button>
        </div>
      </div>
    </div>
  );
}
