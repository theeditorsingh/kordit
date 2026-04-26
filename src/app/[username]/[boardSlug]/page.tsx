'use client';
import { useTheme } from '@/context/ThemeContext';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import Board from '@/components/Board';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import { useState, useEffect, use } from 'react';
import { ViewMode } from '@/types';

export default function BoardPage({ params }: { params: Promise<{ username: string, boardSlug: string }> }) {
  const { theme } = useTheme();
  const { state, activeBoard, setActiveBoardId } = useBoardContext();
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  
  // Unwrap params for Next.js 15+
  const unwrappedParams = use(params);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync URL slug to Context
  // Note: we match by slug only — the username segment in the URL belongs to the
  // board owner, which may differ from the currently logged-in viewer.
  useEffect(() => {
    const boardFromUrl = state.boards.find(b => b.slug === unwrappedParams.boardSlug);
    if (boardFromUrl && boardFromUrl.id !== state.activeBoardId) {
      setActiveBoardId(boardFromUrl.id);
    }
  }, [unwrappedParams.boardSlug, state.boards, state.activeBoardId, setActiveBoardId]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="app-layout" data-theme={theme}>
      <TopNav view={view} setView={setView} search={search} setSearch={setSearch} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          {!activeBoard ? (
            <div className="empty-state" style={{ flex: 1, height: '100%' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <h3>Board not found</h3>
              <p>This board might have been deleted or you don't have access.</p>
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
    </div>
  );
}
