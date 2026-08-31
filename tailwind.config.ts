import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
      sans: ['var(--font-inter)'],
    },
      colors: {
        page: '#0F1115',
        card: '#1A1D23',
        cardhover: '#22262F',
        accent: '#C6F135',
        accentsoft: 'rgba(198, 241, 53, 0.12)',
        danger: '#FF6B6B',
        dangersoft: 'rgba(255, 107, 107, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
