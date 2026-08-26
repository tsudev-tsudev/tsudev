import React from 'react';

/**
 * Nhãn trạng thái - DESIGN_SYSTEM.md §5: chữ 12px/500, đệm 2px 8px, radius-sm,
 * nền màu trạng thái nhạt 12% + chữ màu trạng thái đậm.
 *
 * "12% + chữ màu trạng thái" là hai yêu cầu kéo ngược nhau ở chế độ Sáng: màu
 * `--success` gốc đặt lên chính tint 12% của nó chỉ đạt 4.27:1, dưới ngưỡng AA
 * mà §1 đòi. Nên bảng token có sẵn CẶP `--<trạng thái>-tint` (nền, tính sẵn) và
 * `--<trạng thái>-ink` (chữ, đậm hơn ở chế độ Sáng, trùng màu gốc ở Ấm và Tối).
 * Cả hai đều nằm trong tokens/extensions.tsudev-web.json và bị contrast.test.ts canh.
 *
 * rounded-sm chứ không phải rounded-full: viên thuốc bo tròn hoàn toàn là hình
 * ngôn ngữ của mạng xã hội. Nhãn trạng thái trong giao diện sản phẩm là hình chữ
 * nhật bo nhẹ - nó đọc như dữ liệu, không như một cái huy hiệu.
 */
const TONES = {
  brand: 'bg-glow text-link border-transparent',
  teal: 'bg-transparent text-accent border-current',
  neutral: 'bg-subtle text-fg-secondary border-transparent',
  outline: 'bg-transparent text-fg-muted border-line-control',
  success: 'bg-success-tint text-success-ink border-transparent',
  warning: 'bg-warning-tint text-warning-ink border-transparent',
  danger: 'bg-danger-tint text-danger-ink border-transparent',
  info: 'bg-info-tint text-info-ink border-transparent',
} as const;

export type BadgeTone = keyof typeof TONES;

type BadgeProps = {
  children?: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  mono?: boolean;
  /**
   * Hình đi kèm. §1 cấm để màu ĐỨNG MỘT MÌNH mang nghĩa - khoảng 1 trong 12 nam
   * giới không phân biệt được đỏ với xanh lá, và với họ một hàng nhãn chỉ khác
   * nhau ở sắc độ là một hàng nhãn giống hệt nhau.
   */
  icon?: React.ReactNode;
};

export const Badge = ({
  children,
  tone = 'neutral',
  className = '',
  mono = false,
  icon,
}: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium ${
      mono ? 'font-mono' : ''
    } ${TONES[tone] ?? TONES.neutral} ${className}`}
  >
    {icon && <span aria-hidden="true">{icon}</span>}
    {children}
  </span>
);

export default Badge;
