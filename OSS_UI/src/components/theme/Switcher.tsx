// src/components/theme/Switcher.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
            theme === 'light' 
              ? 'bg-white text-black shadow-sm' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Sun size={16} />
          Light
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
            theme === 'dark' 
              ? 'text-black shadow-sm' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
          style={{ 
            backgroundColor: theme === 'dark' ? 'var(--cyan-accent)' : 'transparent'
          }}
        >
          <Moon size={16} />
          Dark
        </button>
      </div>
    </div>
  );
}
