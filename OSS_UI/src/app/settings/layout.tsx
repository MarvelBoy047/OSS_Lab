'use client';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  // DO NOT render <html> or <body> here - only the root layout should have these
  return (
    <div className="min-h-full bg-black text-white">
      {children}
    </div>
  );
}
