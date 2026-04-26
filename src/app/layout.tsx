import type { Metadata } from 'next';
import './globals.css';
import { BoardProvider } from '@/context/BoardContext';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'Kordit — Task Management',
  description: 'A modern Kanban board and task management tool inspired by Trello and Google Tasks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <BoardProvider>
            {children}
          </BoardProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
