import type { Config } from 'tailwindcss';

const config: Config = {
  // The content paths remain the same, correctly scanning your project files.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  
  // darkMode is not actively used by the new CSS variable theme, but is kept for future-proofing.
  darkMode: 'class',

  theme: {
    extend: {
      // SIMPLIFIED: The colors are now directly mapped to the CSS variables
      // defined in globals.css. The old light/dark theme functions are removed.
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'accent': 'var(--accent)',
        'input-border': 'var(--input-border)',
        'input-focus': 'var(--input-focus)',
        'cyan-accent': 'var(--cyan-accent)',
        'green-accent': 'var(--green-accent)',
        'orange-accent': 'var(--orange-accent)',
      },
      // The font family is correctly set to 'Inter' for the new design.
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  
  // The necessary plugins for our current UI are preserved.
  plugins: [
    require('@tailwindcss/typography'), 
    require('@tailwindcss/container-queries')
  ],
};

export default config;