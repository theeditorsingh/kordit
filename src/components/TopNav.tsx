'use client';
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun, Moon, Search, LayoutGrid, List, Calendar, X, Share2, User, LogOut,
  Zap, Palette, Save, Copy, Sparkles, Undo2, Redo2, Menu, Shield, MoreHorizontal
} from 'lucide-react';
import VisibilityDropdown from './VisibilityDropdown';
import ShareModal from './ShareModal';
import AutomationPanel from './AutomationPanel';
import WeeklyDigest from './WeeklyDigest';
import AuditLogPanel from './AuditLogPanel';
import { ViewMode } from '@/types';
import styles from './TopNav.module.css';
import NotificationBell from './NotificationBell';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import { useReminders } from '@/hooks/useReminders';

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
  const [showMore, setShowMore] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Activate keyboard shortcuts
  useUndoRedo();

  // Start reminder checker
  useReminders();

  function setBoardBackground(background: string, backgroundType: 'color' | 'gradient' | 'image') {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, { background, backgroundType });
    setShowBgPicker(false);
  }

  return (
    <>
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
          <img src="/kordit-logo.svg" alt="Kordit" width={26} height={26} />
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
            {/* Undo / Redo — always visible */}
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

            {/* Desktop-only actions (hidden on mobile) */}
            <div className={styles.desktopOnly}>
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

              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowAutomations(true)}
                title="Automations"
                style={{ marginLeft: 4 }}
              >
                <Zap size={15} />
              </button>

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

              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowAuditLog(true)}
                title="Audit Log"
                style={{ marginLeft: 4 }}
              >
                <Shield size={15} />
              </button>
            </div>

            {/* Mobile: More button */}
            <button
              className={`btn btn-ghost btn-icon btn-sm ${styles.mobileOnly}`}
              onClick={() => setShowMore(true)}
              title="More actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Desktop search (hidden on mobile) */}
            <div className={`${styles.searchWrap} ${styles.desktopOnly}`} style={{ marginLeft: 8 }}>
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

            {/* Mobile search icon */}
            <button
              className={`btn btn-ghost btn-icon btn-sm ${styles.mobileOnly}`}
              onClick={() => { setShowMobileSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              title="Search"
            >
              <Search size={18} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowShareModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <Share2 size={14} /> <span className={styles.tabLabel}>Share</span>
            </button>
          </>
        )}

        <NotificationBell />

        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Toggle theme" style={{ marginLeft: 4 }}>
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

      {/* Mobile More Actions Bottom Sheet */}
      {showMore && (
        <>
          <div className="modal-overlay" onClick={() => setShowMore(false)} style={{ zIndex: 400 }}>
            <div className="modal-box" style={{ maxWidth: '100%', position: 'fixed', bottom: 0, borderRadius: '20px 20px 0 0', padding: '8px 0 24px' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, background: 'var(--border-subtle)', borderRadius: 2, margin: '8px auto 12px' }} />
              <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { icon: <Palette size={18} />, label: 'Board Background', action: () => { setShowMore(false); setShowBgPicker(true); } },
                  { icon: <Zap size={18} />, label: 'Automations', action: () => { setShowMore(false); setShowAutomations(true); } },
                  { icon: <Copy size={18} />, label: 'Save as Template', action: () => { setShowMore(false); if (activeBoard && confirm('Save as template?')) saveBoardAsTemplate(activeBoard.id); } },
                  { icon: <Sparkles size={18} />, label: 'AI Weekly Digest', action: () => { setShowMore(false); setShowDigest(true); } },
                  { icon: <Shield size={18} />, label: 'Audit Log', action: () => { setShowMore(false); setShowAuditLog(true); } },
                  { icon: <Share2 size={18} />, label: 'Share Board', action: () => { setShowMore(false); setShowShareModal(true); } },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                      padding: '14px 20px', background: 'none', border: 'none', borderRadius: 10,
                      fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Full-screen mobile search */}
      {showMobileSearch && (
        <div className={styles.mobileSearchOverlay}>
          <div className={styles.mobileSearchHeader}>
            <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              className={styles.mobileSearchInput}
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { setShowMobileSearch(false); setSearch(''); }}
              style={{ flexShrink: 0 }}
            >
              <X size={20} />
            </button>
          </div>
          {search && (
            <div className={styles.mobileSearchHint}>
              Showing results for &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      )}
    </header>
    <NotificationPermissionBanner />
    </>
  );
}
