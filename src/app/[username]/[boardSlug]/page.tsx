'use client';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { SkeletonBoard, SkeletonListView } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import { doneProgress } from '@/components/TopProgressBar';
import { useState, useEffect, use, Suspense, lazy } from 'react';
import { ViewMode } from '@/types';

const Board = lazy(() => import('@/components/Board'));
const TableView = lazy(() => import('@/components/TableView'));
const CalendarView = lazy(() => import('@/components/CalendarView'));
const OnboardingTour = lazy(() => import('@/components/OnboardingTour'));

export default function BoardPage({ params }: { params: Promise<{ username: string, boardSlug: string }> }) {
  const { state, activeBoard, setActiveBoardId } = useBoardContext();
  const [view, setViewState] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
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
              <Board board={activeBoard} search={search} />
            </Suspense>
          ) : view === 'table' ? (
            <Suspense fallback={<SkeletonListView />}>
              <TableView board={activeBoard} search={search} />
            </Suspense>
          ) : (
            <Suspense fallback={<SkeletonBoard />}>
              <CalendarView board={activeBoard} search={search} />
            </Suspense>
          )}
        </main>
      </div>

      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
    </div>
  );
}
