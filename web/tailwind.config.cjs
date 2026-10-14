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
    },
  },
  plugins: [],
};
