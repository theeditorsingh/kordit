'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun, Moon, Search, LayoutGrid, Table2, Calendar, X, Share2, User, LogOut,
  Zap, Palette, Save, Copy, Sparkles, Undo2, Redo2, Menu, MoreHorizontal, Settings, ListFilter, ChevronDown, BarChart3, Users
} from 'lucide-react';

import AutomationPanel from './AutomationPanel';
import WeeklyDigest from './WeeklyDigest';
import ShareModal from './ShareModal';
import ProfileModal from './ProfileModal';
import BoardBackgroundPicker from './BoardBackgroundPicker';
import FilterMenu from './FilterMenu';
import { CardFilters } from '@/utils/search';
import type { BackgroundType } from '@/utils/boardBackground';
import { ViewMode } from '@/types';
import styles from './TopNav.module.css';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import { useReminders } from '@/hooks/useReminders';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import { useConfirm } from './ConfirmDialog';
import NotificationBell from './NotificationBell';
import AnalyticsModal from './AnalyticsModal';
import TeamModal from './TeamModal';

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  search: string;
  setSearch: (s: string) => void;
  onMenuClick?: () => void;
  /** Quick filters (board page only). Omit to hide the Filter button. */
  filters?: CardFilters;
  setFilters?: (f: CardFilters) => void;
  filterCounts?: { shown: number; total: number };
}

export default function TopNav({ view, setView, search, setSearch, onMenuClick, filters, setFilters, filterCounts }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { activeBoard, updateBoard, saveBoardAsTemplate, undo, redo, canUndo, canRedo } = useBoardContext();
  const confirm = useConfirm();
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgAnchor, setBgAnchor] = useState<DOMRect | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const activeFilterCount = filters ? Object.values(filters).filter(Boolean).length : 0;
  const [showDigest, setShowDigest] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile'|'preferences'|'security'|'danger'>('profile');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
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
      
      // The server decides whether the current password may be skipped
      // (only right after a magic-link sign-in). Nothing is cleared here.
    }
  }, []);

  // Undo/Redo keyboard shortcuts (inlined from useUndoRedo)
  const handleUndoRedoKey = useCallback(
    (e: KeyboardEvent) => {
      // Leave Ctrl+Z alone while typing so the browser's own text undo works
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      // "/" jumps to the search box
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && desktopSearchRef.current) {
        e.preventDefault();
        desktopSearchRef.current.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
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

  function setBoardBackground(background: string, backgroundType: BackgroundType) {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, { background, backgroundType });
  }

  return (
    <>
    <header className={`${styles.nav} ${activeBoard ? styles.hasBoard : ''}`}>
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
          <img
            src="/Kordit_Logo.svg"
            alt="Kordit"
            width={26}
            height={26}
            className={styles.logoLight}
          />
          <img
            src="/Kordit_White_Tile_Dark_Mode.svg"
            alt="Kordit"
            width={26}
            height={26}
            className={styles.logoDark}
          />
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
              aria-label="Board View"
            >
              <LayoutGrid size={15} /> <span className={styles.tabLabel}>Board</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'table' ? styles.active : ''}`}
              onClick={() => setView('table')}
              title="Table View"
              aria-label="Table View"
            >
              <Table2 size={15} /> <span className={styles.tabLabel}>Table</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
              title="Calendar View"
              aria-label="Calendar View"
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
            <div className={`${styles.btnGroup} ${styles.desktopOnly}`}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo (Ctrl+Z)"
                style={{ opacity: canUndo ? 1 : 0.35 }}
              >
                <Undo2 size={15} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo (Ctrl+Shift+Z)"
                style={{ opacity: canRedo ? 1 : 0.35 }}
              >
                <Redo2 size={15} />
              </button>
            </div>

            {/* Desktop-only secondary board actions */}
            <div className={`${styles.desktopTools} ${styles.desktopOnly}`}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={(e) => { setBgAnchor(e.currentTarget.getBoundingClientRect()); setShowBgPicker(!showBgPicker); }}
                title="Board background"
                aria-label="Board background"
                aria-expanded={showBgPicker}
              >
                <Palette size={15} />
              </button>

              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowAutomations(true)}
                title="Automations"
                aria-label="Automations"
              >
                <Zap size={15} />
              </button>

              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={async () => {
                  if (await confirm('A copy of this board will be created with the same columns and no cards.', { title: 'Save as template', confirmLabel: 'Create copy', danger: false })) {
                    saveBoardAsTemplate(activeBoard.id);
                  }
                }}
                title="Save as template"
                aria-label="Save as template"
              >
                <Copy size={15} />
              </button>
            </div>

            {/* AI Digest */}
            <button
              className={`btn btn-ghost btn-sm ${styles.aiBtn} ${styles.desktopOnly}`}
              onClick={() => setShowDigest(true)}
              title="AI Weekly Digest"
              aria-label="AI Weekly Digest"
              id="ai-digest-btn"
            >
              <Sparkles size={14} />
              <span className={styles.aiBtnLabel}>AI Digest</span>
            </button>

            {/* Mobile: More button */}
            <button
              className={`btn btn-ghost btn-icon btn-sm ${styles.mobileOnly}`}
              onClick={() => setShowMore(true)}
              title="More actions"
              aria-label="More actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Filter dropdown — desktop (on mobile it is in the More sheet) */}
            {filters && setFilters && (
              <div className={styles.desktopOnly}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { setFilterAnchor(e.currentTarget.getBoundingClientRect()); setShowFilters(!showFilters); }}
                  aria-haspopup="menu"
                  aria-expanded={showFilters}
                  title="Filter cards"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    ...(activeFilterCount > 0 ? { color: 'var(--accent)', background: 'var(--accent-subtle)' } : {}),
                  }}
                >
                  <ListFilter size={14} />
                  <span className={styles.filterBtnLabel}>Filter</span>
                  {activeFilterCount > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                      background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{activeFilterCount}</span>
                  )}
                  <ChevronDown size={13} />
                </button>
              </div>
            )}

            {/* Desktop search (hidden on mobile) */}
            <div className={`${styles.searchWrap} ${styles.desktopOnly}`}>
              <Search size={14} className={styles.searchIcon} />
              <input
                ref={desktopSearchRef}
                className={styles.searchInput}
                placeholder="Search cards...  ( / )"
                aria-label="Search cards"
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
              aria-label="Search"
            >
              <Search size={18} />
            </button>

            {/* Share */}
            <button className={`btn btn-primary btn-sm ${styles.mobileHide}`} onClick={() => setShowShareModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Share2 size={14} /> <span className={styles.shareBtnLabel}>Share</span>
            </button>

            <div className={`${styles.divider} ${styles.desktopOnly}`} />
          </>
        )}

        <button className={`btn btn-ghost btn-icon ${activeBoard ? styles.mobileHide : ''}`} onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <NotificationBell />

        <div className={styles.profileWrap} style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="User Settings"
            aria-label="User Settings"
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
                  borderRadius: 'var(--ui-modal-radius)',
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
                    borderRadius: 'var(--ui-control-radius)',
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
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 12, background: 'none', border: 'none', borderRadius: 'var(--ui-control-radius)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}
                  onClick={() => { setShowUserMenu(false); setShowAnalytics(true); }}
                >
                  <BarChart3 size={16} /> Analytics
                </button>
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 12, background: 'none', border: 'none', borderRadius: 'var(--ui-control-radius)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}
                  onClick={() => { setShowUserMenu(false); setShowTeam(true); }}
                >
                  <Users size={16} /> Team workspace
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
                    borderRadius: 'var(--ui-control-radius)',
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
      {showFilters && filters && setFilters && (
        <FilterMenu
          filters={filters}
          onChange={setFilters}
          shown={filterCounts?.shown ?? 0}
          total={filterCounts?.total ?? 0}
          anchorRect={filterAnchor}
          onClose={() => setShowFilters(false)}
        />
      )}
      {/* Outside the desktop-only group so the mobile "More" sheet can open it too */}
      {showBgPicker && activeBoard && (
        <BoardBackgroundPicker
          key={activeBoard.id}
          board={activeBoard}
          anchorRect={bgAnchor}
          onApply={setBoardBackground}
          onClose={() => setShowBgPicker(false)}
        />
      )}
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
      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}
      {showTeam && <TeamModal onClose={() => setShowTeam(false)} />}
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
                  ...(filters && setFilters ? [{ icon: <ListFilter size={20} />, label: activeFilterCount > 0 ? `Filters (${activeFilterCount} on)` : 'Filters', action: () => { setShowMore(false); setFilterAnchor(null); setShowFilters(true); } }] : []),
                  { icon: <Palette size={20} />, label: 'Board Background', action: () => { setShowMore(false); setBgAnchor(null); setShowBgPicker(true); } },
                  { icon: <Zap size={20} />, label: 'Automations', action: () => { setShowMore(false); setShowAutomations(true); } },
                  { icon: <Copy size={20} />, label: 'Save as Template', action: async () => { setShowMore(false); if (activeBoard && await confirm('A copy of this board will be created with the same columns and no cards.', { title: 'Save as template', confirmLabel: 'Create copy', danger: false })) saveBoardAsTemplate(activeBoard.id); } },
                  { icon: <Sparkles size={20} />, label: 'AI Weekly Digest', action: () => { setShowMore(false); setShowDigest(true); } },
                  { icon: <Share2 size={20} />, label: 'Share Board', action: () => { setShowMore(false); setShowShareModal(true); } },
                  { icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />, label: theme === 'dark' ? 'Use Light Theme' : 'Use Dark Theme', action: () => { setShowMore(false); toggleTheme(); } },
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
