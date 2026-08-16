module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // MỘT nguồn sự thật: mọi màu trỏ về biến CSS trong
        // packages/ui/src/tokens.css, nơi hai chế độ sáng/tối được định nghĩa.
        //
        // Trước đây ở đây còn một thang `primary` 50→900 cắm cứng mã hex, song
        // song với bảng token. Hai bảng màu trong một dự án thì chúng sẽ lệch
        // nhau, và thang cắm cứng KHÔNG đổi theo chế độ — dùng `bg-primary-100`
        // ở chế độ tối cho ra một mảng xanh nhạt chói giữa nền đen.
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
        brandcontrast: 'var(--primary-contrast)',
        teal: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        onvivid: 'var(--on-vivid)',
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
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
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
