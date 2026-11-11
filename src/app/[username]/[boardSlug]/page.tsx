'use client';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { SkeletonBoard, SkeletonListView } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import { doneProgress } from '@/components/TopProgressBar';
import { useState, useEffect, use, Suspense, lazy } from 'react';
import { Card, ViewMode } from '@/types';
import { useSession } from 'next-auth/react';
import { CardFilters, NO_FILTERS, cardMatchesFilters, cardMatchesSearch, hasActiveFilters } from '@/utils/search';
import { getDoneCardIds } from '@/utils/columns';

const Board = lazy(() => import('@/components/Board'));
const TableView = lazy(() => import('@/components/TableView'));
const CalendarView = lazy(() => import('@/components/CalendarView'));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour'));

export default function BoardPage({ params }: { params: Promise<{ username: string, boardSlug: string }> }) {
  const { state, activeBoard, setActiveBoardId } = useBoardContext();
  const [view, setViewState] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CardFilters>(NO_FILTERS);
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Body scroll lock when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Unwrap params for Next.js 15+
  const unwrappedParams = use(params);

  useEffect(() => {
    setMounted(true);
    doneProgress();
    // Restore the view from the address bar (?view=table) so a reload or shared link keeps it
    const fromUrl = new URLSearchParams(window.location.search).get('view');
    if (fromUrl === 'table' || fromUrl === 'calendar') setViewState(fromUrl);
  }, []);

  function setView(next: ViewMode) {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === 'board') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(window.history.state, '', url);
  }

  const boardFromSlug = state.boards.find(b => b.slug === unwrappedParams.boardSlug);

  // Quick filters: one test handed to whichever view is showing
  const filtersOn = hasActiveFilters(filters);
  const doneCardIds = activeBoard ? getDoneCardIds(activeBoard) : new Set<string>();
  const cardFilter = filtersOn
    ? (card: Card) => cardMatchesFilters(card, filters, { userId: session?.user?.id, doneCardIds })
    : undefined;
  const boardCards = activeBoard ? Object.values(activeBoard.cards) : [];
  const shownCount = boardCards.filter((c) => cardMatchesSearch(c, search) && (!cardFilter || cardFilter(c))).length;

  // Sync URL slug to Context
  useEffect(() => {
    const boardFromUrl = state.boards.find(b => b.slug === unwrappedParams.boardSlug);
    if (boardFromUrl && boardFromUrl.id !== state.activeBoardId) {
      setActiveBoardId(boardFromUrl.id);
    }
  }, [unwrappedParams.boardSlug, state.boards, state.activeBoardId, setActiveBoardId]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [unwrappedParams.boardSlug]);

  if (!mounted) {
    return (
      <div className="app-layout">
        <div style={{ height: 52, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }} />
        <div className="app-body">
          <div style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }} />
          <main className="main-content">
            <SkeletonBoard />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <TopNav
        view={view}
        setView={setView}
        search={search}
        setSearch={setSearch}
        onMenuClick={() => setSidebarOpen(prev => !prev)}
        filters={filters}
        setFilters={setFilters}
        filterCounts={{ shown: shownCount, total: boardCards.length }}
      />
      <div className="app-body" style={{ position: 'relative' }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 199,
            }}
            className="mobile-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {state.boards.length > 0 && !boardFromSlug ? (
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                variant="no-results"
                title="Board not found"
                description="This board doesn't exist, was archived, or you don't have access to it. Pick another board from the sidebar."
              />
            </div>
          ) : !activeBoard ? (
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState variant="no-boards" />
            </div>
          ) : view === 'board' ? (
            <Suspense fallback={<SkeletonBoard />}>
              <Board board={activeBoard} search={search} cardFilter={cardFilter} />
            </Suspense>
          ) : view === 'table' ? (
            <Suspense fallback={<SkeletonListView />}>
              <TableView board={activeBoard} search={search} cardFilter={cardFilter} />
            </Suspense>
          ) : (
            <Suspense fallback={<SkeletonBoard />}>
              <CalendarView board={activeBoard} search={search} cardFilter={cardFilter} />
            </Suspense>
          )}
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
    </div>
  );
}
