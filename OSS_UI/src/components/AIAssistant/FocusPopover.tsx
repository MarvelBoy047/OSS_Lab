'use client';

import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';

const focusModes = [
  { key: 'webSearch', title: 'Web', description: 'Search across the entire Internet', icon: 'public' },
  { key: 'academicSearch', title: 'Academic', description: 'Search academic papers', icon: 'school' },
  { key: 'socialSearch', title: 'Social', description: 'Discussions and opinions', icon: 'groups' },
  { key: 'financeSearch', title: 'Finance', description: 'Search SEC filings', icon: 'monitoring' },
];

// This is a simple toggle switch component we'll use inside the popover
const CustomToggle = ({ checked }: { checked: boolean }) => (
  <div className={cn('relative flex h-7 w-14 cursor-pointer rounded-full bg-bg-secondary p-1 transition-colors duration-200 ease-in-out')}>
    <span aria-hidden="true" className={cn(checked ? 'translate-x-7 bg-cyan-accent' : 'translate-x-0 bg-text-secondary', 'pointer-events-none inline-block h-5 w-5 transform rounded-full ring-0 transition duration-200 ease-in-out')} />
  </div>
);

export const FocusPopover = () => {
  const [focusMode, setFocusMode] = useState('webSearch'); // This now controls the single selection

  return (
    <Popover className="relative">
      <PopoverButton className="chat-tool-icon outline-none">
        <span className="material-symbols-outlined">public</span>
      </PopoverButton>
      <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
        <PopoverPanel className="absolute bottom-full mb-2 w-80 -translate-x-1/3 rounded-xl bg-[#1C1C1C] border border-input-border shadow-2xl">
          <div className="p-4 space-y-1">
            {focusModes.map((mode) => (
              <PopoverButton // Close panel on selection
                as="div"
                key={mode.key}
                onClick={() => setFocusMode(mode.key)} // Set this as the one active mode
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