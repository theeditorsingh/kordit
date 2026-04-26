'use client';
import { useState, useRef, useEffect } from 'react';
import { useBoardContext } from '@/context/BoardContext';
import { Lock, Users, Building, Globe, X, Check, ChevronDown } from 'lucide-react';
import { Visibility } from '@/types';
import styles from './VisibilityDropdown.module.css';

export default function VisibilityDropdown() {
  const { state, activeBoard, dispatch } = useBoardContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!activeBoard) return null;

  const handleSelect = (visibility: Visibility) => {
    dispatch({ type: 'UPDATE_BOARD_VISIBILITY', boardId: activeBoard.id, visibility });
    setIsOpen(false);
  };

  const getIcon = (v: Visibility) => {
    switch(v) {
      case 'Private': return <Lock size={14} />;
      case 'Workspace': return <Users size={14} />;
      case 'Public': return <Globe size={14} />;
      default: return <Users size={14} />;
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.triggerBtn} onClick={() => setIsOpen(!isOpen)}>
        {getIcon(activeBoard.visibility || 'Workspace')}
        {activeBoard.visibility || 'Workspace'}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span>Change visibility</span>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.options}>
            <button
              className={`${styles.option} ${(activeBoard.visibility || 'Workspace') === 'Private' ? styles.active : ''}`}
              onClick={() => handleSelect('Private')}
            >
              <div className={styles.optionIcon}><Lock size={16} /></div>
              <div className={styles.optionContent}>
                <div className={styles.optionTitle}>Private</div>
                <div className={styles.optionDescription}>Board members and Workspace admins can see and edit this board.</div>
              </div>
              {(activeBoard.visibility || 'Workspace') === 'Private' && <Check size={16} className={styles.checkIcon} />}
            </button>

            <button
              className={`${styles.option} ${(activeBoard.visibility || 'Workspace') === 'Workspace' ? styles.active : ''}`}
              onClick={() => handleSelect('Workspace')}
            >
              <div className={styles.optionIcon}><Users size={16} /></div>
              <div className={styles.optionContent}>
                <div className={styles.optionTitle}>Workspace</div>
                <div className={styles.optionDescription}>All members of the Workspace can see and edit this board.</div>
              </div>
              {(activeBoard.visibility || 'Workspace') === 'Workspace' && <Check size={16} className={styles.checkIcon} />}
            </button>

            <button className={`${styles.option} ${styles.disabled}`} disabled>
              <div className={styles.optionIcon}><Building size={16} /></div>
              <div className={styles.optionContent}>
                <div className={styles.optionTitle}>Organization</div>
                <div className={styles.optionDescription}>All members of the organization can see this board. The board must be added to an enterprise Workspace to enable this.</div>
              </div>
            </button>

            <button
              className={`${styles.option} ${(activeBoard.visibility || 'Workspace') === 'Public' ? styles.active : ''}`}
              onClick={() => handleSelect('Public')}
            >
              <div className={styles.optionIcon}><Globe size={16} /></div>
              <div className={styles.optionContent}>
                <div className={styles.optionTitle}>Public</div>
                <div className={styles.optionDescription}>Anyone on the internet can see this board. Only board members can edit.</div>
              </div>
              {(activeBoard.visibility || 'Workspace') === 'Public' && <Check size={16} className={styles.checkIcon} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
