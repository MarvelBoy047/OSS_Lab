'use client';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  // FIX: Set a fixed screen height to create a boundary for the child to scroll within.
  return (
    <div className="h-screen bg-black text-white">
      {children}
    </div>
  );
}