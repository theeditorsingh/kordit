'use client';
import { useBoardContext } from '@/context/BoardContext';
import { X, ExternalLink, ArrowLeft } from 'lucide-react';
import styles from './TemplateModal.module.css';

interface Props {
  onClose: () => void;
}

const TEMPLATES = [
  { id: '1', title: '1-on-1 Meeting Agenda', color: '#8b5a2b' },
  { id: '2', title: 'Agile Board Template | Kordit', color: '#ff7f50' },
  { id: '3', title: 'Company Overview', color: '#87ceeb' },
  { id: '4', title: 'Design Huddle', color: '#ff69b4' },
  { id: '5', title: 'Go To Market Strategy Template', color: '#00ced1' },
  { id: '6', title: 'Mise-En-Place Personal Productivity', color: '#556b2f' },
  { id: '7', title: 'Project Management', color: '#9370db' },
  { id: '8', title: 'Remote Team Meetings', color: '#e6e6fa' },
  { id: '9', title: 'Simple Project Board', color: '#32cd32' },
  { id: '10', title: 'Teaching: Weekly Planning', color: '#ffa07a' },
];

export default function TemplateModal({ onClose }: Props) {
  const { createBoard } = useBoardContext();

  const handleSelect = (template: typeof TEMPLATES[0]) => {
    // In a real app, this would clone the template's columns and cards
    createBoard(template.title);
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
