/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          app: '#0a0a0b',
          panel: '#111113',
          card: '#18181b',
          hover: '#1f1f23',
          line: '#2a2a2e',
        },
        ink: {
          strong: '#f4f4f5',
          base: '#a1a1aa',
          faint: '#71717a',
        },
        brand: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          soft: '#1e1b4b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0' }],
        sm: ['0.875rem', { lineHeight: '1.55', letterSpacing: '0' }],
        base: ['0.9375rem', { lineHeight: '1.65' }],
        lg: ['1.0625rem', { lineHeight: '1.6' }],
        xl: ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.015em' }],
        '2xl': ['1.5rem', { lineHeight: '1.35', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.025em' }],
      },
    },
  },
  plugins: [],
};
