module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066FF',
          50: '#F2F7FF',
          100: '#E6F0FF',
          200: '#BFD9FF',
          300: '#99C1FF',
          400: '#4D9BFF',
          500: '#0066FF',
          600: '#0053D6',
          700: '#003EA3',
          800: '#002A70',
          900: '#00163D',
        },
        accent: '#00C2A8',
        // theme-aware tokens (driven by CSS variables in tokens.css)
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        panel2: 'var(--panel-2)',
        hairline: 'var(--border)',
        hairstrong: 'var(--border-strong)',
        ink: 'var(--ink)',
        inksoft: 'var(--ink-soft)',
        muted: 'var(--muted)',
        brand: 'var(--primary)',
        brandink: 'var(--primary-ink)',
        teal: 'var(--accent)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: { xl: '16px' },
      container: { center: true, padding: '1rem' },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'none' },
        },
        'pulse-glow': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.2,.7,.2,1) both',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
