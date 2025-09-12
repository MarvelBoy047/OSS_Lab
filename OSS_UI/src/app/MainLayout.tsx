'use client';

import OSSLABSidebar from '@/components/OSSLABSidebar';
import { AIAssistantPanel } from '@/components/AIAssistant/AIAssistantPanel';
import { FileProvider } from '@/lib/hooks/useFileContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // ✅ ADD: Reset key system at parent level
  const [aiPanelKey, setAiPanelKey] = useState(Date.now());

  const showAssistant = pathname === '/' ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/notebook') ||
    pathname.startsWith('/presentation') ||
    pathname === '/dashboard';

  const uploadEnabled = pathname === '/' ||
    pathname.startsWith('/c/') ||
    pathname === '/dashboard';

  // ✅ ADD: Listen for reset events from localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ai_panel_reset_trigger') {
        console.log('🔄 MainLayout detected reset trigger - forcing AI panel remount');
        setAiPanelKey(Date.now());
        // Clean up the trigger
        localStorage.removeItem('ai_panel_reset_trigger');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check for direct reset triggers (same tab)
    const checkReset = () => {
      const resetTrigger = localStorage.getItem('ai_panel_reset_trigger');
      if (resetTrigger) {
        console.log('🔄 MainLayout detected reset trigger - forcing AI panel remount');
        setAiPanelKey(Date.now());
        localStorage.removeItem('ai_panel_reset_trigger');
      }
    };

    const interval = setInterval(checkReset, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <FileProvider>
      <div className="flex h-screen bg-[var(--bg-primary)]">
        <OSSLABSidebar uploadEnabled={uploadEnabled} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
        
        {/* ✅ FIXED: Add key prop to force complete remount on reset */}
        {showAssistant && <AIAssistantPanel key={aiPanelKey} />}
      </div>
    </FileProvider>
  );
}
