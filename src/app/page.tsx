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
      // Preserve ?reset=true so the board page can open the Security modal
      const resetParam = new URLSearchParams(window.location.search).get('reset');
      if (resetParam === 'true') {
        // Store in localStorage as a reliable bridge across navigation
        localStorage.setItem('kordit_password_reset', 'true');
      }
      const query = resetParam === 'true' ? '?reset=true' : '';
      router.replace(`/${session.user.username}/${firstBoard.slug}${query}`);
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
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>🎉</span>
              Welcome to Kordit!
              <span style={{ display: 'inline-block' }}>🎉</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Get started by choosing a template below.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', textAlign: 'left' }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => createBoard(tpl.title, tpl.columns)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-card, var(--bg-surface))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    height: '110px',
                    textAlign: 'left',
                    padding: 0,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ width: '100%', height: '35%', backgroundColor: tpl.color, opacity: 0.9, borderRadius: '16px 16px 0 0' }} />
                  <div style={{ padding: '10px 14px', width: '100%', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{tpl.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
