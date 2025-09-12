import { redirect } from 'next/navigation';

// ✅ Fetch chat IDs from backend for static generation
export async function generateStaticParams() {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${API_BASE}/api/conversations`, {
      cache: 'force-cache',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch conversations: ${response.status}`);
      return []; // Fallback for build
    }

    const data = await response.json();
    const conversations = data.conversations || [];
    
    return conversations.map((conv: any) => ({
      chatId: conv.id,
    }));
    
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    return []; // Fallback for build errors
  }
}

// ✅ REMOVED: dynamicParams = true (not compatible with static export)

interface ChatHandoffPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatHandoffPage({ params }: ChatHandoffPageProps) {
  const { chatId } = await params;
  const id = chatId || 'default';
  
  console.log(`🔄 Redirecting chat: ${id} to main dashboard`);
  
  // Server-side redirect to main page with chatId
  redirect(`/?chatId=${encodeURIComponent(id)}`);
}
