import type { MetadataRoute } from 'next';

// ✅ Required for static export compatibility
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OSSLAB - AI Assistant Dashboard',
    short_name: 'OSSLAB',
    description: 'OSSLAB is a local-first, autonomous AI agent for data science and research.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-50.png',
        sizes: '50x50',
        type: 'image/png',
      },
      {
        src: '/icon-100.png',
        sizes: '100x100',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '440x440',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
