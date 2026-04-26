'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Search, LayoutGrid, List, Calendar, Plus, X, Menu, Share2, User, LogOut } from 'lucide-react';
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
  const [showUserMenu, setShowUserMenu] = useState(false);

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

        <div style={{ position: 'relative', marginLeft: 8 }}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            title="User Settings"
          >
            <User size={16} />
          </button>

          {showUserMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                onClick={() => setShowUserMenu(false)}
              />
              <div 
                className={styles.userDropdown}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  width: '200px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  User Settings
                </div>
                <button 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 86, 48, 0.1)';
                    e.currentTarget.style.color = '#FF5630';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
    </header>
  );
}
