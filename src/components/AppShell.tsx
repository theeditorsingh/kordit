'use client';
/**
 * The signed-in app frame: top bar, sidebar (a drawer on phones) and the main area.
 * Used by the board page and by Home, My Tasks, Inbox and workspace pages.
 */
import { useEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { useBoardContext } from '@/context/BoardContext';
import type { ViewMode } from '@/types';

type TopNavProps = ComponentProps<typeof TopNav>;

interface Props {
  children: ReactNode;
  /** Board pages pass their view/search/filter state; other pages can omit it */
  nav?: Partial<Omit<TopNavProps, 'onMenuClick'>>;
  /** Extra class on <main> (e.g. page padding) */
  mainClassName?: string;
  /** Pages that are not a board (Home, Inbox…) clear the active board so the header has no board controls */
  noBoard?: boolean;
}

const noopSubscribe = () => () => {};

export default function AppShell({ children, nav, mainClassName, noBoard }: Props) {
  // TopNav and Sidebar read browser-only values (localStorage, navigator), so render after mount
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { state, setActiveBoardId } = useBoardContext();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Pages without a board still need TopNav's required props
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Close the drawer when the route changes (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (noBoard && state.activeBoardId) setActiveBoardId(null);
  }, [noBoard, state.activeBoardId, setActiveBoardId]);

  if (!mounted) {
    return (
      <div className="app-layout">
        <div style={{ height: 60, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }} />
        <div className="app-body"><main className="main-content" /></div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <TopNav
        view={nav?.view ?? view}
        setView={nav?.setView ?? setView}
        search={nav?.search ?? search}
        setSearch={nav?.setSearch ?? setSearch}
        filters={nav?.filters}
        setFilters={nav?.setFilters}
        filterCounts={nav?.filterCounts}
        onMenuClick={() => setSidebarOpen((open) => !open)}
      />
      <div className="app-body" style={{ position: 'relative' }}>
        {sidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
            className="mobile-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={`main-content ${mainClassName ?? ''}`}>{children}</main>
      </div>
    </div>
  );
}
