'use client';
import { useState } from 'react';
import { useBoardContext } from '@/context/BoardContext';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Search, LayoutGrid, List, Calendar, Plus, X, Menu, Share2 } from 'lucide-react';
import VisibilityDropdown from './VisibilityDropdown';
import ShareModal from './ShareModal';
import { ViewMode } from '@/types';
import styles from './TopNav.module.css';

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  search: string;
  setSearch: (s: string) => void;
}

export default function TopNav({ view, setView, search, setSearch }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { activeBoard } = useBoardContext();
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#0052CC"/>
            <rect x="6" y="6" width="8" height="12" rx="2" fill="white" opacity="0.9"/>
            <rect x="18" y="6" width="8" height="8" rx="2" fill="white" opacity="0.7"/>
            <rect x="18" y="18" width="8" height="8" rx="2" fill="white" opacity="0.5"/>
          </svg>
          <span className={styles.logoText}>Kordit</span>
        </div>
        {activeBoard && (
          <span className={styles.boardName}>{activeBoard.title}</span>
        )}
      </div>

      <div className={styles.center}>
        {activeBoard && (
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${view === 'board' ? styles.active : ''}`}
              onClick={() => setView('board')}
              title="Board View"
            >
              <LayoutGrid size={15} /> Board
            </button>
            <button
              className={`${styles.viewTab} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
              title="List View"
            >
              <List size={15} /> List
            </button>
            <button
              className={`${styles.viewTab} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
              title="Calendar View"
            >
              <Calendar size={15} /> Calendar
            </button>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {activeBoard && (
          <>
            <VisibilityDropdown />
            <div className={styles.searchWrap} style={{ marginLeft: 8 }}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search cards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowShareModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <Share2 size={14} /> Share
            </button>
          </>
        )}
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Toggle theme" style={{ marginLeft: 8 }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
    </header>
  );
}
