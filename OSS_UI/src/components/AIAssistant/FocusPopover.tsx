'use client';

import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';

const focusModes = [
  { key: 'webSearch', title: 'Web', description: 'Search across the entire Internet', icon: 'public' },
  { key: 'academicSearch', title: 'Academic', description: 'Search academic papers', icon: 'school' },
  { key: 'socialSearch', title: 'Social', description: 'Discussions and opinions', icon: 'groups' },
  { key: 'financeSearch', title: 'Finance', description: 'Search SEC filings', icon: 'monitoring' },
];

// Toggle switch component
const CustomToggle = ({ checked }: { checked: boolean }) => (
  <div className={cn('relative flex h-7 w-14 cursor-pointer rounded-full bg-bg-secondary p-1 transition-colors duration-200 ease-in-out')}>
    <span aria-hidden="true" className={cn(checked ? 'translate-x-7 bg-cyan-accent' : 'translate-x-0 bg-text-secondary', 'pointer-events-none inline-block h-5 w-5 transform rounded-full ring-0 transition duration-200 ease-in-out')} />
  </div>
);

export const FocusPopover = () => {
  // FIXED: Default web search to OFF (false)
  const [focusMode, setFocusMode] = useState(''); // No default selection
  const [webSearchEnabled, setWebSearchEnabled] = useState(false); // FIXED: Default OFF

  // Load saved preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('osslab_focus_mode') || '';
      const savedWebSearch = localStorage.getItem('osslab_web_search_enabled') === 'true';
      
      setFocusMode(savedMode);
      setWebSearchEnabled(savedWebSearch); // Will be false by default
      
      console.log('🔧 Focus settings loaded:', { savedMode, webSearchEnabled: savedWebSearch });
    }
  }, []);

  const handleModeToggle = (mode: string) => {
    if (focusMode === mode) {
      // Disable if clicking the same mode
      setFocusMode('');
      setWebSearchEnabled(false);
      localStorage.setItem('osslab_focus_mode', '');
      localStorage.setItem('osslab_web_search_enabled', 'false');
    } else {
      // Enable the selected mode
      setFocusMode(mode);
      const isWebSearch = mode === 'webSearch';
      setWebSearchEnabled(isWebSearch);
      localStorage.setItem('osslab_focus_mode', mode);
      localStorage.setItem('osslab_web_search_enabled', String(isWebSearch));
    }
    
    console.log('🔧 Focus mode changed:', { mode: focusMode === mode ? '' : mode, webSearch: focusMode === mode ? false : mode === 'webSearch' });
  };

  return (
    <Popover className="relative">
      <PopoverButton className="chat-tool-icon outline-none">
        <span className="material-symbols-outlined">
          {focusMode ? focusModes.find(m => m.key === focusMode)?.icon || 'public' : 'public'}
        </span>
      </PopoverButton>
      <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
        <PopoverPanel className="absolute bottom-full mb-2 w-80 -translate-x-1/3 rounded-xl bg-[#1C1C1C] border border-input-border shadow-2xl">
          <div className="p-4 space-y-1">
            <div className="text-sm text-text-secondary mb-3 px-3">
              Web Search: {webSearchEnabled ? 'ON' : 'OFF'} (Default: OFF)
            </div>
            {focusModes.map((mode) => (
              <PopoverButton
                as="div"
                key={mode.key}
                onClick={() => handleModeToggle(mode.key)}
                className="flex items-center justify-between p-3 hover:bg-bg-tertiary rounded-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary">{mode.icon}</span>
                  <div>
                    <p className="font-semibold text-text-primary text-sm">{mode.title}</p>
                    <p className="text-text-secondary text-xs">{mode.description}</p>
                  </div>
                </div>
                <CustomToggle checked={focusMode === mode.key} />
              </PopoverButton>
            ))}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};
