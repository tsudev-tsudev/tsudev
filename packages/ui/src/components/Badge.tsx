import React from 'react';

// rounded-sm chứ không phải rounded-full: viên thuốc bo tròn hoàn toàn là hình
// ngôn ngữ của mạng xã hội. Nhãn trạng thái trong giao diện sản phẩm là hình chữ
// nhật bo nhẹ — nó đọc như dữ liệu, không như một cái huy hiệu.
const TONES = {
  brand: 'bg-[var(--glow)] text-brandink border-transparent',
  teal: 'text-teal border-current bg-transparent',
  neutral: 'bg-panel2 text-inksoft border-transparent',
  outline: 'bg-transparent text-muted border-hairstrong',
  success: 'text-success border-current bg-transparent',
  warning: 'text-warning border-current bg-transparent',
} as const;

export type BadgeTone = keyof typeof TONES;

type BadgeProps = {
  children?: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  mono?: boolean;
};

export const Badge = ({ children, tone = 'neutral', className = '', mono = false }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold ${
      mono ? 'font-mono' : ''
    } ${TONES[tone] ?? TONES.neutral} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
