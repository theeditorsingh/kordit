'use client';
import { useTheme } from '@/context/ThemeContext';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import Board from '@/components/Board';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import OnboardingTour from '@/components/OnboardingTour';
import EmptyState from '@/components/EmptyState';
import { useState, useEffect, use } from 'react';
import { ViewMode } from '@/types';

export default function BoardPage({ params }: { params: Promise<{ username: string, boardSlug: string }> }) {
  const { theme } = useTheme();
  const { state, activeBoard, setActiveBoardId } = useBoardContext();
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Unwrap params for Next.js 15+
  const unwrappedParams = use(params);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    return null;
  }

  return (
    <div className="app-layout" data-theme={theme}>
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
              display: 'none',
            }}
            className="mobile-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          {!activeBoard ? (
            <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState variant="no-boards" />
            </div>
          ) : view === 'board' ? (
            <Board board={activeBoard} search={search} />
          ) : view === 'list' ? (
            <ListView board={activeBoard} search={search} />
          ) : (
            <CalendarView board={activeBoard} />
          )}
        </main>
      </div>
      <OnboardingTour />
    </div>
  );
}
