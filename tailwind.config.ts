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
      // Fondos con degradado/glow reutilizando SOLO la paleta existente
      // (nada de colores nuevos, solo más presencia visual del acento).
      backgroundImage: {
        'gradient-hero': 'radial-gradient(120% 120% at 50% -10%, rgba(198,241,53,0.16) 0%, rgba(15,17,21,0) 60%)',
        'gradient-accent': 'linear-gradient(135deg, #C6F135 0%, #8FD13F 100%)',
        'gradient-card-glow': 'radial-gradient(140% 140% at 100% 0%, rgba(198,241,53,0.10) 0%, rgba(26,29,35,0) 55%)',
        'gradient-fade-top': 'linear-gradient(180deg, rgba(198,241,53,0.10) 0%, rgba(15,17,21,0) 100%)',
        shimmer: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(198,241,53,0.15), 0 8px 30px -8px rgba(198,241,53,0.35)',
        'glow-lg': '0 0 0 1px rgba(198,241,53,0.18), 0 20px 60px -12px rgba(198,241,53,0.45)',
        card: '0 4px 24px -8px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(198,241,53,0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(198,241,53,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 3.5s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.2s ease-out infinite',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
    },
  },
  plugins: [],
};

export default config;
