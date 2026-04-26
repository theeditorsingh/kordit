'use client';
import { useTheme } from '@/context/ThemeContext';
import { useBoardContext } from '@/context/BoardContext';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ViewMode } from '@/types';
import { TEMPLATES } from '@/utils/templates';

export default function Home() {
  const { theme } = useTheme();
  const { state, createBoard } = useBoardContext();
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && state.boards.length > 0 && session?.user?.username) {
      // Redirect to the first board
      const firstBoard = state.boards[0];
      router.replace(`/${session.user.username}/${firstBoard.slug}`);
    }
  }, [mounted, state.boards, session, router]);

  if (!mounted || state.boards.length > 0) {
    return null; // Prevent hydration mismatch or flash before redirect
  }

  return (
    <div className="app-layout" data-theme={theme}>
      <TopNav view={view} setView={setView} search={search} setSearch={setSearch} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ padding: '40px', background: 'var(--bg-default)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--text-primary)' }}>Welcome to Kordit!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Get started by choosing a template below.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', textAlign: 'left' }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => createBoard(tpl.title, tpl.columns)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: tpl.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{tpl.title}</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
