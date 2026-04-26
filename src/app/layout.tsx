import type { Metadata } from 'next';
import './globals.css';
import { BoardProvider } from '@/context/BoardContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Kordit — Task Management',
  description: 'A modern Kanban board and task management tool inspired by Trello and Google Tasks.',
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let initialBoards: any[] = [];

  if (session?.user?.id) {
    initialBoards = await prisma.board.findMany({
      where: { ownerId: session.user.id },
      include: {
        columns: { orderBy: { order: 'asc' } },
        cards: { orderBy: { order: 'asc' } },
        members: { include: { user: true } },
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <BoardProvider initialBoards={initialBoards}>
              {children}
            </BoardProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
