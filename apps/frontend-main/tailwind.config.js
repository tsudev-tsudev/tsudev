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
        // nhau, và thang cắm cứng KHÔNG đổi theo chế độ - dùng `bg-primary-100`
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
        // Màu icon theo chức năng - dùng qua `text-icon-create`, `text-icon-danger`…
        icon: {
          nav: 'var(--icon-nav)',
          create: 'var(--icon-create)',
          edit: 'var(--icon-edit)',
          danger: 'var(--icon-danger)',
          info: 'var(--icon-info)',
          trust: 'var(--icon-trust)',
        },
      },
      // Thang chữ theo bậc của giao diện sản phẩm (Fluent), không phải bậc mặc
      // định của Tailwind. Khác biệt thật sự nằm ở khoảng giữa: mặc định nhảy
      // 16 → 18 → 20 → 24, quá dày để tạo được thứ bậc rõ ràng, nên trang nào
      // cũng có ba cỡ chữ trông gần giống nhau. Bậc dưới đây nhảy 16 → 20 → 24
      // → 28, mỗi bậc đủ xa để mắt đọc ra ngay đâu là tiêu đề, đâu là thân.
      //
      // Chiều cao dòng đi kèm từng bậc: chữ càng lớn thì tỉ lệ dòng càng phải
      // NHỎ, nếu không tiêu đề hai dòng bị rời ra thành hai khối không liên quan.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.5rem', { lineHeight: '2rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.5rem', { lineHeight: '3rem' }],
        '5xl': ['3.25rem', { lineHeight: '3.5rem' }],
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
