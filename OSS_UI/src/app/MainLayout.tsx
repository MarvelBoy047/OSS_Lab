'use client';

import OSSLABSidebar from '@/components/OSSLABSidebar';
import { AIAssistantPanel } from '@/components/AIAssistant/AIAssistantPanel';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showAssistant =
    pathname === '/' ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/notebook') ||
    pathname.startsWith('/presentation') ||
    pathname === '/dashboard';

  const uploadEnabled =
    pathname === '/' || pathname.startsWith('/c/') || pathname === '/dashboard';

  return (
    <div className="flex h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <OSSLABSidebar uploadEnabled={uploadEnabled} />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">{children}</main>
      {showAssistant && <AIAssistantPanel />}
    </div>
  );
}
