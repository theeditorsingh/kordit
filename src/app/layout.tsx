import type { Metadata } from 'next';
import './globals.css';
import { BoardProvider } from '@/context/BoardContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthProvider from '@/components/AuthProvider';
import OfflineBanner from '@/components/OfflineBanner';
import TopProgressBar from '@/components/TopProgressBar';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Kordit - Task Management, Simplified',
  description: 'A modern Kanban board and task management tool inspired by Trello and Google Tasks.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kordit',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadBoardsForUser } from "@/lib/loadBoards";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let initialBoards: any[] = [];

  if (session?.user?.id) {
    initialBoards = await loadBoardsForUser(session.user.id);
  }

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0052CC" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kordit_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            <ConfirmProvider>
              <BoardProvider initialBoards={initialBoards}>
                <TopProgressBar />
                <OfflineBanner />
                {children}
              </BoardProvider>
            </ConfirmProvider>
          </ThemeProvider>
        </AuthProvider>
        {/* Register Service Worker */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) {
                    console.log('SW registered:', reg.scope);
                  })
                  .catch(function(err) {
                    console.log('SW registration failed:', err);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
