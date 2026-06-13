import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0b10',
          soft: '#10121b',
          card: '#141622',
          elevated: '#1a1d2b',
        },
        border: {
          DEFAULT: '#232636',
          soft: '#2c3042',
        },
        rift: {
          gold: '#c8a85a',
          cyan: '#26d0ce',
          blue: '#3b82f6',
          red: '#ef4444',
          purple: '#8b5cf6',
          green: '#22c55e',
        },
        muted: '#8b91a7',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(38, 208, 206, 0.35)',
        'glow-gold': '0 0 24px -6px rgba(200, 168, 90, 0.4)',
        card: '0 4px 24px -8px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseglow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        pulseglow: 'pulseglow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
