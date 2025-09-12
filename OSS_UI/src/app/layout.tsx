import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import ThemeProvider from '@/components/theme/Provider';
import MainLayout from './MainLayout';

const inter = Inter({ subsets: ['latin'], display: 'swap', fallback: ['Arial', 'sans-serif'] });

export const metadata: Metadata = {
  title: 'OSSLAB - AI Assistant Dashboard',
  description: 'OSSLAB is a local-first, autonomous AI agent for data science and research.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24..48,400..700,0..1,-50..200&display=swap"
        />
      </head>
      <body>
        <ThemeProvider>
          <MainLayout>{children}</MainLayout>
          <Toaster 
            richColors 
            toastOptions={{
              style: {
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)'
              }
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
