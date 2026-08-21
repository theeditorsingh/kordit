'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useTheme } from '@/context/ThemeContext';
import { clearPasswordForResetAction } from '@/actions/userActions';
import {
  Sun, Moon, Search, LayoutGrid, Table2, Calendar, X, Share2, User, LogOut,
  Zap, Palette, Save, Copy, Sparkles, Undo2, Redo2, Menu, MoreHorizontal, Settings
} from 'lucide-react';

import AutomationPanel from './AutomationPanel';
import WeeklyDigest from './WeeklyDigest';
import ShareModal from './ShareModal';
import ProfileModal from './ProfileModal';
import { ViewMode } from '@/types';
import styles from './TopNav.module.css';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import { useReminders } from '@/hooks/useReminders';
import { useSwipeDown } from '@/hooks/useSwipeDown';

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
  const [showMore, setShowMore] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile'|'security'|'danger'>('profile');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Swipe-down to dismiss the More sheet
  const moreSheetSwipe = useSwipeDown({ onDismiss: () => setShowMore(false) });

  // Auto-open profile on password reset return (user clicked magic link in email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('reset') === 'true';
    const fromStorage = localStorage.getItem('kordit_password_reset') === 'true';
    
    if (fromUrl || fromStorage) {
      // Clean up both signals so they don't re-trigger
      if (fromUrl) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      localStorage.removeItem('kordit_password_reset');
      
      // Open the Security tab right away
      setProfileTab('security');
      setShowProfile(true);
      
      // Clear old password in the background (user proved identity via magic link)
      clearPasswordForResetAction().catch(console.error);
    }
  }, []);

  // Undo/Redo keyboard shortcuts (inlined from useUndoRedo)
  const handleUndoRedoKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    },
    [undo, redo]
  );
  useEffect(() => {
    window.addEventListener('keydown', handleUndoRedoKey);
    return () => window.removeEventListener('keydown', handleUndoRedoKey);
  }, [handleUndoRedoKey]);

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
              className={`${styles.viewTab} ${view === 'table' ? styles.active : ''}`}
              onClick={() => setView('table')}
              title="Table View"
            >
              <Table2 size={15} /> <span className={styles.tabLabel}>Table</span>
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
            {/* Undo / Redo — desktop only (available in More sheet on mobile) */}
            <div className={styles.desktopOnly}>
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
            </div>

            {/* Desktop-only actions (hidden on mobile) */}
            <div className={styles.desktopOnly}>

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
            {/* Share — icon-only on mobile (tabLabel hidden at ≤768px) */}
            <button className="btn btn-primary btn-sm" onClick={() => setShowShareModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <Share2 size={14} /> <span className={styles.tabLabel}>Share</span>
            </button>
          </>
        )}

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
                  borderRadius: '16px',
                  width: '220px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Account
                </div>
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    minHeight: '44px',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  onClick={() => { setShowUserMenu(false); setShowProfile(true); }}
                  id="open-profile-settings-btn"
                >
                  <Settings size={16} />
                  Profile {'&'} Settings
                </button>
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    minHeight: '44px',
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
                  <LogOut size={16} />
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
      {showProfile && (
        <ProfileModal 
          onClose={() => {
            setShowProfile(false);
            setProfileTab('profile'); // reset tab for next time
          }} 
          initialTab={profileTab}
        />
      )}
      {/* Mobile More Actions Bottom Sheet */}
      {showMore && (
        <>
          <div className="modal-overlay" onClick={() => setShowMore(false)} style={{ zIndex: 400 }}>
            <div
              className="modal-box"
              style={{ maxWidth: '100%', position: 'fixed', bottom: 0, borderRadius: '28px 28px 0 0', padding: '4px 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', ...moreSheetSwipe.dragStyle }}
              onClick={e => e.stopPropagation()}
              onTouchStart={moreSheetSwipe.onTouchStart}
              onTouchMove={moreSheetSwipe.onTouchMove}
              onTouchEnd={moreSheetSwipe.onTouchEnd}
            >
              <div style={{ width: 32, height: 4, background: 'var(--m3-outline-variant, var(--border-subtle))', borderRadius: 9999, margin: '12px auto 16px', opacity: 0.6 }} />
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { icon: <Undo2 size={20} />, label: 'Undo', action: () => { setShowMore(false); undo(); }, disabled: !canUndo },
                  { icon: <Redo2 size={20} />, label: 'Redo', action: () => { setShowMore(false); redo(); }, disabled: !canRedo },
                  { icon: <Palette size={20} />, label: 'Board Background', action: () => { setShowMore(false); setShowBgPicker(true); } },
                  { icon: <Zap size={20} />, label: 'Automations', action: () => { setShowMore(false); setShowAutomations(true); } },
                  { icon: <Copy size={20} />, label: 'Save as Template', action: () => { setShowMore(false); if (activeBoard && confirm('Save as template?')) saveBoardAsTemplate(activeBoard.id); } },
                  { icon: <Sparkles size={20} />, label: 'AI Weekly Digest', action: () => { setShowMore(false); setShowDigest(true); } },
                  { icon: <Share2 size={20} />, label: 'Share Board', action: () => { setShowMore(false); setShowShareModal(true); } },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    disabled={(item as any).disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, width: '100%',
                      padding: '16px 20px', background: 'none', border: 'none', borderRadius: 9999,
                      fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', cursor: (item as any).disabled ? 'default' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                      minHeight: 56, WebkitTapHighlightColor: 'transparent',
                      opacity: (item as any).disabled ? 0.35 : 1,
                    }}
                  >
                    <span style={{
                      width: 40, height: 40, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-subtle)', color: 'var(--accent)', flexShrink: 0,
                    }}>{item.icon}</span>
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
