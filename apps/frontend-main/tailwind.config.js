/**
 * Tailwind KHÔNG giữ giá trị nào. Mọi khoá dưới đây trỏ về một biến CSS trong
 * packages/ui/src/tokens.css, và file đó được SINH RA từ tokens/design-tokens.json
 * (`npm run tokens:sync`). Nhờ vậy mọi class màu/khoảng cách/bo góc trong app đều
 * truy ngược được về nguồn chân lý duy nhất, đúng yêu cầu của
 * docs/PROJECT_STRUCTURE.md - và ba chế độ Sáng/Ấm/Tối đổi theo `data-theme` mà
 * không class nào phải biết là có ba chế độ.
 *
 * Vì sao chữ nằm trong nhóm `fg` chứ không phẳng ra thành `text-primary`: token
 * chuẩn có CẢ `--text-primary` (chữ thân bài) lẫn `--primary` (xanh thương hiệu).
 * Phẳng ra thì `text-primary` mang hai nghĩa và không ai đọc ra được nghĩa nào -
 * `text-fg` / `text-primary` thì rạch ròi. Ánh xạ vẫn 1:1 với biến CSS.
 */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nền - --bg-*. Thứ bậc dựng bằng độ sáng nền:
        // base (nền trang) < surface (card & modal) < subtle (khối lồng, header bảng).
        // Ở chế độ Sáng và Ấm chiều này ĐẢO so với chế độ Tối - card sáng hơn nền
        // trang. Giữ nguyên chiều của chế độ tối sẽ cho ra card xám trên nền
        // trắng, tức là card trông như bị vô hiệu hoá.
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        hovered: 'var(--bg-hover)',

        // Viền - --border*. Luôn phẳng 1px solid (DESIGN_SYSTEM.md §2).
        // `control` là ranh giới của VÙNG TƯƠNG TÁC (nút phụ, ô nhập) và phải đạt
        // 3:1 theo WCAG 1.4.11; `strong` là nhấn mạnh trang trí và không đạt
        // ngưỡng đó ở bảng màu v1.0.0 - xem $accessibility_gap trong
        // tokens/design-tokens.json.
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          control: 'var(--border-control)',
        },

        // Chữ - --text-*.
        fg: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        link: 'var(--text-link)',

        // Thương hiệu - --primary*.
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
        },
        'on-primary': 'var(--on-primary)',
        focus: 'var(--focus-ring)',

        // Trạng thái. `-ink`/`-tint` là cặp dành cho badge nền nhạt: màu trạng
        // thái ĐẶC chỉ đủ tương phản khi dùng làm NỀN (với chữ `on-status`), đặt
        // nó làm CHỮ trên chính tint 12% của nó thì ở chế độ Sáng chỉ đạt ~4.1:1.
        success: {
          DEFAULT: 'var(--success)',
          ink: 'var(--success-ink)',
          tint: 'var(--success-tint)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          ink: 'var(--warning-ink)',
          tint: 'var(--warning-tint)',
        },
        danger: { DEFAULT: 'var(--danger)', ink: 'var(--danger-ink)', tint: 'var(--danger-tint)' },
        info: { DEFAULT: 'var(--info)', ink: 'var(--info-ink)', tint: 'var(--info-tint)' },
        'on-status': 'var(--on-status)',

        // Mở rộng của tsudev-web.
        accent: 'var(--accent)',
        glow: 'var(--glow)',
        // Màu icon theo NHÓM HÀNH ĐỘNG - dùng qua `text-icon-create`, `text-icon-danger`…
        icon: {
          nav: 'var(--icon-nav)',
          create: 'var(--icon-create)',
          edit: 'var(--icon-edit)',
          danger: 'var(--icon-danger)',
          info: 'var(--icon-info)',
          trust: 'var(--icon-trust)',
        },
      },

      // Thang chữ §4: 12/13/14/15/16/18(H4)/20(H3)/24(H2)/30(H1), cộng ba bậc
      // display cho hero (extensions.tsudev-web.typography).
      //
      // Đây là `fontSize` GHI ĐÈ, không phải `extend`. Với `extend`, thang mặc
      // định của Tailwind sống song song với thang token - và nó đã sống thật:
      // 41 chỗ trong app dùng `text-xl`…`text-6xl`, tức là 41 cỡ chữ KHÔNG truy
      // ngược được về design-tokens.json, đúng thứ mà quy ước cấm. Ghi đè thì
      // một class ngoài bảng này không sinh ra CSS nào và lộ ra ngay khi nhìn,
      // thay vì âm thầm lấy một giá trị cắm cứng của Tailwind.
      //
      // Chiều cao dòng đi kèm từng bậc: chữ càng lớn thì tỉ lệ dòng càng phải
      // NHỎ, nếu không tiêu đề hai dòng bị rời ra thành hai khối không liên quan.
      //
      // Không có bậc nào dưới 12px, kể cả chú thích - §4 cấm.
      fontSize: {
        xs: ['var(--fs-xs)', { lineHeight: '1.5' }],
        sm: ['var(--fs-body-desktop)', { lineHeight: '1.5' }],
        base: ['var(--fs-body-web)', { lineHeight: 'var(--lh-body)' }],
        lg: ['var(--fs-h4)', { lineHeight: 'var(--lh-long)' }],
        xl: ['var(--fs-h3)', { lineHeight: 'var(--lh-heading)' }],
        '2xl': ['var(--fs-h2)', { lineHeight: 'var(--lh-heading)' }],
        '3xl': ['var(--fs-h1)', { lineHeight: 'var(--lh-heading)' }],
        '4xl': ['var(--fs-display-sm)', { lineHeight: '1.15' }],
        '5xl': ['var(--fs-display-md)', { lineHeight: '1.1' }],
        '6xl': ['var(--fs-display-lg)', { lineHeight: '1.05' }],
        // Bí danh gọi theo vai trò - ưu tiên dùng những tên này ở mã mới, chúng
        // nói ra ý định thay vì nói ra một bậc trong thang.
        h4: ['var(--fs-h4)', { lineHeight: 'var(--lh-heading)' }],
        h3: ['var(--fs-h3)', { lineHeight: 'var(--lh-heading)' }],
        h2: ['var(--fs-h2)', { lineHeight: 'var(--lh-heading)' }],
        h1: ['var(--fs-h1)', { lineHeight: 'var(--lh-heading)' }],
      },
      fontWeight: {
        normal: 'var(--fw-regular)',
        medium: 'var(--fw-medium)',
        semibold: 'var(--fw-semibold)',
        bold: 'var(--fw-bold)',
      },
      letterSpacing: {
        heading: 'var(--ls-heading)',
        caps: 'var(--ls-caps-label)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
        mono: ['var(--font-mono)'],
      },

      // Bo góc: none cho khung layout (header/footer/sidebar - thẳng tắp),
      // sm cho badge/checkbox, md cho button/input, lg cho card/modal/bảng.
      // `full` chỉ còn hợp lệ cho avatar và chấm trạng thái tròn.
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },

      // Lưới 4px của §3. Giữ thang mặc định của Tailwind (cũng là bội số 4px) và
      // thêm bí danh token để style viết tay khớp đúng cùng một lưới.
      spacing: {
        sp1: 'var(--sp-1)',
        sp2: 'var(--sp-2)',
        sp3: 'var(--sp-3)',
        sp4: 'var(--sp-4)',
        sp5: 'var(--sp-5)',
        sp6: 'var(--sp-6)',
        sp8: 'var(--sp-8)',
        sp10: 'var(--sp-10)',
        sp12: 'var(--sp-12)',
        // Chiều cao theo mật độ (Comfortable/Compact) - đổi bằng data-density.
        control: 'var(--control-h)',
        row: 'var(--row-h)',
        item: 'var(--list-item-h)',
      },
      maxWidth: {
        // Khối văn bản dài tối đa 72ch để mắt đảo dòng không mỏi (§3).
        measure: 'var(--measure)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        'modal-overlay': 'var(--z-modal-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--motion-easing)',
      },

      container: { center: true, padding: 'var(--sp-4)' },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'none' },
        },
        'pulse-glow': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .6s var(--motion-easing) both',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
