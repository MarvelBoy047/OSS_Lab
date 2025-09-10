// src/components/theme/Provider.tsx
'use client';

import { ThemeProvider } from 'next-themes';

const ThemeProviderComponent = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      disableTransitionOnChange={false}
      themes={['light', 'dark']}
    >
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderComponent;
