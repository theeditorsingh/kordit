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
import { prisma } from "@/lib/prisma";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let initialBoards: any[] = [];

  if (session?.user?.id) {
    initialBoards = await prisma.board.findMany({
      where: {
        members: { some: { userId: session.user.id } },
        isArchived: false,
      },
      include: {
        columns: { orderBy: { order: 'asc' } },
        cards: { orderBy: { order: 'asc' } },
        members: { include: { user: true } },
        owner: { select: { username: true } },
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0052CC" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            <BoardProvider initialBoards={initialBoards}>
              <TopProgressBar />
              <OfflineBanner />
              {children}
            </BoardProvider>
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
