'use client';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun, Moon, Search, LayoutGrid, List, Calendar, X, Share2, User, LogOut,
  Zap, Palette, Save, Copy, Sparkles, Undo2, Redo2, Menu, Shield
} from 'lucide-react';
import VisibilityDropdown from './VisibilityDropdown';
import ShareModal from './ShareModal';
import AutomationPanel from './AutomationPanel';
import WeeklyDigest from './WeeklyDigest';
import AuditLogPanel from './AuditLogPanel';
import { ViewMode } from '@/types';
import styles from './TopNav.module.css';

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  search: string;
  setSearch: (s: string) => void;
  onMenuClick?: () => void;
}

const GRADIENTS = [
  'linear-gradient(135deg, #0052CC, #6554C0)',
  'linear-gradient(135deg, #36B37E, #00B8D9)',
  'linear-gradient(135deg, #FF5630, #FF991F)',
  'linear-gradient(135deg, #6554C0, #FF7452)',
  'linear-gradient(135deg, #172B4D, #0052CC)',
  'linear-gradient(135deg, #00B8D9, #36B37E)',
];

export default function TopNav({ view, setView, search, setSearch, onMenuClick }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { activeBoard, updateBoard, saveBoardAsTemplate, undo, redo, canUndo, canRedo } = useBoardContext();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Activate keyboard shortcuts
  useUndoRedo();

  function setBoardBackground(background: string, backgroundType: 'color' | 'gradient' | 'image') {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, { background, backgroundType });
    setShowBgPicker(false);
  }

  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        {/* Hamburger for mobile */}
        <button
          className={`btn btn-ghost btn-icon ${styles.hamburger}`}
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          id="hamburger-btn"
        >
          <Menu size={18} />
        </button>

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

      <div className={styles.center} id="view-switcher">
        {activeBoard && (
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${view === 'board' ? styles.active : ''}`}
              onClick={() => setView('board')}
              title="Board View"
            >
              <LayoutGrid size={15} /> <span className={styles.tabLabel}>Board</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
              title="List View"
            >
              <List size={15} /> <span className={styles.tabLabel}>List</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
              title="Calendar View"
            >
              <Calendar size={15} /> <span className={styles.tabLabel}>Calendar</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {activeBoard && (
          <>
            {/* Undo / Redo */}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              style={{ opacity: canUndo ? 1 : 0.35 }}
            >
              <Undo2 size={15} />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              style={{ opacity: canRedo ? 1 : 0.35 }}
            >
              <Redo2 size={15} />
            </button>

            <VisibilityDropdown />

            {/* Board Background */}
            <div style={{ position: 'relative', marginLeft: 4 }}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowBgPicker(!showBgPicker)}
                title="Board background"
              >
                <Palette size={15} />
              </button>
              {showBgPicker && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowBgPicker(false)} />
                  <div className={styles.bgPicker}>
                    <div className={styles.bgPickerTitle}>Board Background</div>
                    <div className={styles.bgGrid}>
                      {GRADIENTS.map((g, i) => (
                        <button
                          key={i}
                          className={styles.bgSwatch}
                          style={{ background: g }}
                          onClick={() => setBoardBackground(g, 'gradient')}
                        />
                      ))}
                      <button
                        className={styles.bgSwatch}
                        style={{ background: 'var(--bg-base)', border: '2px dashed var(--border)' }}
                        onClick={() => setBoardBackground('', 'color')}
                        title="Remove background"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Automations */}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setShowAutomations(true)}
              title="Automations"
              style={{ marginLeft: 4 }}
            >
              <Zap size={15} />
            </button>

            {/* Save as Template */}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => {
                if (confirm('Save this board as a template? A copy will be created with the same columns.')) {
                  saveBoardAsTemplate(activeBoard.id);
                }
              }}
              title="Save as template"
              style={{ marginLeft: 4 }}
            >
              <Copy size={15} />
            </button>

            {/* AI Weekly Digest */}
            <button
              className={`btn btn-ghost btn-sm ${styles.aiBtn}`}
              onClick={() => setShowDigest(true)}
              title="AI Weekly Digest"
              style={{ marginLeft: 4 }}
              id="ai-digest-btn"
            >
              <Sparkles size={14} />
              <span className={styles.tabLabel}>AI Digest</span>
            </button>

            {/* Audit Log (admin) */}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setShowAuditLog(true)}
              title="Audit Log"
              style={{ marginLeft: 4 }}
            >
              <Shield size={15} />
            </button>

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
              <Share2 size={14} /> <span className={styles.tabLabel}>Share</span>
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
      {showAutomations && activeBoard && <AutomationPanel boardId={activeBoard.id} onClose={() => setShowAutomations(false)} />}
      {showDigest && activeBoard && <WeeklyDigest boardId={activeBoard.id} boardTitle={activeBoard.title} onClose={() => setShowDigest(false)} />}
      {showAuditLog && activeBoard && <AuditLogPanel boardId={activeBoard.id} onClose={() => setShowAuditLog(false)} />}
    </header>
  );
}
