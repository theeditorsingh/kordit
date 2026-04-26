'use client';
import { useTheme } from '@/context/ThemeContext';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import Board from '@/components/Board';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import { useState } from 'react';
import { ViewMode } from '@/types';

export default function Home() {
  const { theme } = useTheme();
  const { activeBoard } = useBoardContext();
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');

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
              <h3>No board selected</h3>
              <p>Create a new board from the sidebar to get started.</p>
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
