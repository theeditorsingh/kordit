'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useBoardContext } from '@/context/BoardContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun, Moon, Search, LayoutGrid, Table2, Calendar, X, Share2, User, LogOut,
  Zap, Palette, Copy, Sparkles, Undo2, Redo2, Menu, Settings, ListFilter, ChevronDown, BarChart3, Users, Check, MoreHorizontal
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

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
import { HeaderMenu, HeaderMenuDivider, HeaderMenuItem, HeaderMenuLabel, HeaderMenuSwitch, HeaderMenuUser } from './HeaderMenu';
import { getInitials } from '@/utils/storage';

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
  const { state, activeBoard, updateBoard, saveBoardAsTemplate, undo, redo, canUndo, canRedo } = useBoardContext();
  const router = useRouter();
  const { data: session } = useSession();
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showDesktopMore, setShowDesktopMore] = useState(false);
  // TopNav only renders after mount (both pages wait for it), so navigator is available
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const confirm = useConfirm();
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  // Desktop search is an icon until opened; it stays open while it has text
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  // An empty search box closes on any press outside it. (Blur alone isn't enough:
  // pressing the board doesn't move focus, because drag-and-drop handles the press.)
  useEffect(() => {
    if (!searchOpen || search) return;
    const onDown = (e: PointerEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [searchOpen, search]);
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
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const openSearch = () => {
        if (!window.matchMedia('(min-width: 769px)').matches) return false;
        if (desktopSearchRef.current) desktopSearchRef.current.focus();
        else setSearchOpen(true); // the input focuses itself when it appears
        return true;
      };
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (openSearch()) e.preventDefault();
        return;
      }
      // Leave Ctrl+Z alone while typing so the browser's own text undo works
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      // "/" jumps to the search box
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (openSearch()) e.preventDefault();
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

  // Mobile board bar: open tasks only, the same rule the column counts use
  const openTaskCount = activeBoard
    ? activeBoard.columns.reduce((n, col) => n + col.cardIds.filter((id) => {
        const c = activeBoard.cards[id];
        return c && !c.completedAt;
      }).length, 0)
    : 0;
  const switchableBoards = state.boards.filter((b) => !b.isArchived);

  function openBoard(boardId: string) {
    setShowBoardMenu(false);
    const board = state.boards.find((b) => b.id === boardId);
    if (!board || board.id === activeBoard?.id) return;
    // Same navigation the sidebar uses
    const targetUsername = board.ownerUsername || session?.user?.username;
    if (targetUsername) router.push(`/${targetUsername}/${board.slug}`);
  }

  const boardMenu = showBoardMenu && activeBoard && (
    <>
      <div className={styles.boardMenuScrim} onClick={() => setShowBoardMenu(false)} />
      <ul className={styles.boardMenu} role="listbox" aria-label="Switch board">
        {switchableBoards.map((b) => (
          <li key={b.id}>
            <button
              role="option"
              aria-selected={b.id === activeBoard.id}
              className={`${styles.boardMenuItem} ${b.id === activeBoard.id ? styles.boardMenuItemActive : ''}`}
              onClick={() => openBoard(b.id)}
            >
              <span className={styles.boardMenuName}>{b.title}</span>
              {b.id === activeBoard.id && <Check size={16} />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  // Account: name and a round avatar (profile image, or initials)
  const displayName = session?.user?.name || session?.user?.username || 'Account';
  const avatar = (size: number) => (
    session?.user?.image
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={session.user.image} alt="" width={size} height={size} className={styles.avatar} style={{ width: size, height: size }} />
      : <span className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">{getInitials(displayName)}</span>
  );

  // On mobile, Profile opens the actions sheet (it also holds the account items); desktop keeps the dropdown
  function onProfileClick() {
    if (window.matchMedia('(max-width: 768px)').matches) setShowMore(true);
    else setShowUserMenu(!showUserMenu);
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
          <div className={`${styles.desktopBoardSwitch} ${styles.desktopOnly}`}>
            <span className={styles.headerDivider} aria-hidden="true" />
            <div className={styles.boardSwitchWrap}>
              <button
                className={styles.desktopBoardBtn}
                onClick={() => setShowBoardMenu(!showBoardMenu)}
                aria-haspopup="listbox"
                aria-expanded={showBoardMenu}
                title={activeBoard.title}
                aria-label={`Board: ${activeBoard.title}. Switch board`}
              >
                <span className={styles.desktopBoardName}>{activeBoard.title}</span>
                <ChevronDown size={16} />
              </button>
              {boardMenu}
            </div>
          </div>
        )}
      </div>

      <div className={styles.center} id="view-switcher">
        {activeBoard && (
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${view === 'board' ? styles.active : ''}`}
              onClick={() => setView('board')}
              title="Board View"
              aria-label="Board View" aria-pressed={view === 'board'}
            >
              <LayoutGrid size={15} /> <span className={styles.tabLabel}>Board</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'table' ? styles.active : ''}`}
              onClick={() => setView('table')}
              title="Table View"
              aria-label="Table View" aria-pressed={view === 'table'}
            >
              <Table2 size={15} /> <span className={styles.tabLabel}>Table</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === 'calendar' ? styles.active : ''}`}
              onClick={() => setView('calendar')}
              title="Calendar View"
              aria-label="Calendar View" aria-pressed={view === 'calendar'}
            >
              <Calendar size={15} /> <span className={styles.tabLabel}>Calendar</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {activeBoard && (
          <>
            {/* Desktop tool strip: icons, or the search box when it is open */}
            <div className={`${styles.toolStrip} ${styles.desktopOnly}`}>
              {searchOpen || search ? (
                <div className={styles.searchWrap} ref={searchWrapRef}>
                  <Search size={16} className={styles.searchIcon} />
                  <input
                    ref={desktopSearchRef}
                    className={styles.searchInput}
                    placeholder="Search cards..."
                    aria-label="Search cards"
                    aria-keyshortcuts="/ Control+K Meta+K"
                    value={search}
                    autoFocus
                    onChange={(e) => setSearch(e.target.value)}
                    onBlur={() => { if (!search) setSearchOpen(false); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearch(''); setSearchOpen(false); } }}
                  />
                  <button className={styles.searchClear} onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="Clear and close search" title="Close search (Esc)">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button className={styles.toolIcon} onClick={() => setSearchOpen(true)} title={`Search cards (${isMac ? '⌘K' : 'Ctrl K'})`} aria-label="Search cards">
                    <Search size={18} />
                  </button>
                  {filters && setFilters && (
                    <button
                      className={`${styles.toolIcon} ${activeFilterCount > 0 || showFilters ? styles.toolIconOn : ''}`}
                      onClick={(e) => { setFilterAnchor(e.currentTarget.getBoundingClientRect()); setShowFilters(!showFilters); }}
                      aria-haspopup="menu"
                      aria-expanded={showFilters}
                      title="Filter cards"
                      aria-label={activeFilterCount > 0 ? `Filter cards (${activeFilterCount} on)` : 'Filter cards'}
                    >
                      <ListFilter size={18} />
                      {activeFilterCount > 0 && <span className={styles.toolBadge}>{activeFilterCount}</span>}
                    </button>
                  )}
                  <button
                    className={`${styles.toolIcon} ${showBgPicker ? styles.toolIconOpen : ''}`}
                    onClick={(e) => { setBgAnchor(e.currentTarget.getBoundingClientRect()); setShowBgPicker(!showBgPicker); }}
                    aria-haspopup="dialog"
                    aria-expanded={showBgPicker}
                    title="Board color"
                    aria-label="Board color"
                  >
                    <Palette size={18} />
                  </button>
                  <button
                    className={`${styles.toolIcon} ${styles.aiIcon}`}
                    onClick={() => setShowDigest(true)}
                    title="AI Weekly Digest"
                    aria-label="AI Weekly Digest"
                    id="ai-digest-btn"
                  >
                    <Sparkles size={18} />
                  </button>
                  <span className={styles.toolDivider} aria-hidden="true" />
                  <button className={styles.toolIcon} onClick={undo} disabled={!canUndo} title={`Undo (${isMac ? '⌘Z' : 'Ctrl+Z'})`} aria-label="Undo">
                    <Undo2 size={18} />
                  </button>
                  <button className={styles.toolIcon} onClick={redo} disabled={!canRedo} title={`Redo (${isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z'})`} aria-label="Redo">
                    <Redo2 size={18} />
                  </button>
                </>
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
            <button className={`btn btn-primary btn-sm ${styles.shareBtn} ${styles.mobileHide}`} onClick={() => setShowShareModal(true)}>
              <Share2 size={14} /> <span className={styles.shareBtnLabel}>Share</span>
            </button>

            {/* Board menu */}
            <div className={`${styles.moreWrap} ${styles.desktopOnly}`}>
              <button
                className={styles.toolIcon}
                onClick={() => setShowDesktopMore(!showDesktopMore)}
                aria-haspopup="menu"
                aria-expanded={showDesktopMore}
                title="Board menu"
                aria-label="Board menu"
              >
                <MoreHorizontal size={18} />
              </button>
              {showDesktopMore && (
                <HeaderMenu label="Board menu" onClose={() => setShowDesktopMore(false)}>
                  <HeaderMenuLabel>Board</HeaderMenuLabel>
                  <HeaderMenuItem icon={<Zap size={16} />} label="Automations" onSelect={() => { setShowDesktopMore(false); setShowAutomations(true); }} />
                  <HeaderMenuItem
                    icon={<Copy size={16} />}
                    label="Save as template"
                    onSelect={async () => {
                      setShowDesktopMore(false);
                      if (await confirm('A copy of this board will be created with the same columns and no cards.', { title: 'Save as template', confirmLabel: 'Create copy', danger: false })) saveBoardAsTemplate(activeBoard.id);
                    }}
                  />
                </HeaderMenu>
              )}
            </div>
          </>
        )}


        <NotificationBell />

        <div className={styles.profileWrap} style={{ position: 'relative' }}>
          <button
            className={`btn btn-ghost btn-icon ${styles.profileBtn}`}
            onClick={onProfileClick}
            title="Account"
            aria-label="User Settings"
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
          >
            <User size={16} className={styles.profileIcon} />
            {avatar(30)}
          </button>

          {showUserMenu && (
            <HeaderMenu label="Account" onClose={() => setShowUserMenu(false)}>
              <HeaderMenuUser name={displayName} email={session?.user?.email} avatar={avatar(36)} />
              <HeaderMenuDivider />
              <HeaderMenuItem icon={<Settings size={16} />} label="Profile & Settings" id="open-profile-settings-btn" onSelect={() => { setShowUserMenu(false); setShowProfile(true); }} />
              <HeaderMenuItem icon={<BarChart3 size={16} />} label="Analytics" onSelect={() => { setShowUserMenu(false); setShowAnalytics(true); }} />
              <HeaderMenuItem icon={<Users size={16} />} label="Team workspace" onSelect={() => { setShowUserMenu(false); setShowTeam(true); }} />
              <HeaderMenuDivider />
              <HeaderMenuSwitch
                icon={theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                label="Theme"
                value={theme}
                options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
                onChange={() => toggleTheme()}
              />
              <HeaderMenuDivider />
              <HeaderMenuItem icon={<LogOut size={16} />} label="Sign out" danger onSelect={() => signOut({ callbackUrl: '/login' })} />
            </HeaderMenu>
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
              style={{ maxWidth: '100%', position: 'fixed', bottom: 0, borderRadius: '28px 28px 0 0', padding: '4px 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', maxHeight: '85dvh', overflowY: 'auto', ...moreSheetSwipe.dragStyle }}
              onClick={e => e.stopPropagation()}
              onTouchStart={moreSheetSwipe.onTouchStart}
              onTouchMove={moreSheetSwipe.onTouchMove}
              onTouchEnd={moreSheetSwipe.onTouchEnd}
            >
              <div style={{ width: 32, height: 4, background: 'var(--m3-outline-variant, var(--border-subtle))', borderRadius: 9999, margin: '12px auto 16px', opacity: 0.6 }} />
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ...(activeBoard ? [
                  { icon: <Undo2 size={20} />, label: 'Undo', action: () => { setShowMore(false); undo(); }, disabled: !canUndo },
                  { icon: <Redo2 size={20} />, label: 'Redo', action: () => { setShowMore(false); redo(); }, disabled: !canRedo },
                  ...(filters && setFilters ? [{ icon: <ListFilter size={20} />, label: activeFilterCount > 0 ? `Filters (${activeFilterCount} on)` : 'Filters', action: () => { setShowMore(false); setFilterAnchor(null); setShowFilters(true); } }] : []),
                  { icon: <Palette size={20} />, label: 'Board Background', action: () => { setShowMore(false); setBgAnchor(null); setShowBgPicker(true); } },
                  { icon: <Zap size={20} />, label: 'Automations', action: () => { setShowMore(false); setShowAutomations(true); } },
                  { icon: <Copy size={20} />, label: 'Save as Template', action: async () => { setShowMore(false); if (activeBoard && await confirm('A copy of this board will be created with the same columns and no cards.', { title: 'Save as template', confirmLabel: 'Create copy', danger: false })) saveBoardAsTemplate(activeBoard.id); } },
                  { icon: <Sparkles size={20} />, label: 'AI Weekly Digest', action: () => { setShowMore(false); setShowDigest(true); } },
                  { icon: <Share2 size={20} />, label: 'Share Board', action: () => { setShowMore(false); setShowShareModal(true); } },
                  ] : []),
                  { icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />, label: theme === 'dark' ? 'Use Light Theme' : 'Use Dark Theme', action: () => { setShowMore(false); toggleTheme(); } },
                  { icon: <Settings size={20} />, label: 'Profile & Settings', action: () => { setShowMore(false); setShowProfile(true); } },
                  { icon: <BarChart3 size={20} />, label: 'Analytics', action: () => { setShowMore(false); setShowAnalytics(true); } },
                  { icon: <Users size={20} />, label: 'Team workspace', action: () => { setShowMore(false); setShowTeam(true); } },
                  { icon: <LogOut size={20} />, label: 'Sign Out', action: () => { setShowMore(false); signOut({ callbackUrl: '/login' }); } },
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

    {/* Mobile board bar: board name + counts, icon view switcher */}
    {activeBoard && (
      <div className={styles.boardBar}>
        <div className={styles.boardBarInfo}>
          <button
            className={styles.boardTitleBtn}
            onClick={() => setShowBoardMenu(!showBoardMenu)}
            aria-haspopup="listbox"
            aria-expanded={showBoardMenu}
            aria-label={`Board: ${activeBoard.title}. Switch board`}
          >
            <span className={styles.boardTitleText}>{activeBoard.title}</span>
            <ChevronDown size={20} className={styles.boardTitleChevron} />
          </button>
          <div className={styles.boardMeta}>
            {activeBoard.columns.length} column{activeBoard.columns.length === 1 ? '' : 's'} · {openTaskCount} task{openTaskCount === 1 ? '' : 's'}
          </div>
          {boardMenu}
        </div>
        <div className={styles.viewIcons} role="group" aria-label="View" id="view-switcher-mobile">
          {([
            ['board', LayoutGrid, 'Board view'],
            ['table', Table2, 'Table view'],
            ['calendar', Calendar, 'Calendar view'],
          ] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              className={`${styles.viewIcon} ${view === v ? styles.viewIconActive : ''}`}
              onClick={() => setView(v)}
              aria-label={label}
              aria-pressed={view === v}
              title={label}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </div>
    )}
    <NotificationPermissionBanner />
    </>
  );
}
