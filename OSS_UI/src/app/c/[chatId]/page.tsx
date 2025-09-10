'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ChatHandoffPage() {
  const params = useParams<{ chatId: string }>();
  const router = useRouter();

  useEffect(() => {
    const id = params?.chatId || 'default';
    try {
      localStorage.setItem('activeChatId', id);
      localStorage.setItem('activeChatId:updatedAt', String(Date.now()));
      // Also broadcast for same-tab listeners
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('osslab-chat');
        bc.postMessage({ type: 'switch', chatId: id });
        bc.close();
      }
    } catch {}

    // Redirect with query so the right panel can read it in the same tab
    router.replace(`/?chatId=${encodeURIComponent(id)}`);
  }, [params?.chatId, router]);

  return null;
}
