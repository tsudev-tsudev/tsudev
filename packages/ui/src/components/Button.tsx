import React from 'react';

/**
 * Nút - DESIGN_SYSTEM.md §5.
 *
 * Bốn trạng thái BẮT BUỘC cho mọi vùng tương tác, và ba trong bốn cái chỉ hỏng
 * với người không dùng chuột nên rất dễ lọt khi thử tay:
 *   Default  - màu token gốc.
 *   Hover    - nền `primary-hover`/`bg-hover`, con trỏ pointer, đổi màu 120ms.
 *   Focus    - vòng 2px `focus-ring` offset 2px, luôn nhìn thấy bằng bàn phím.
 *   Disabled - mờ 0.5, con trỏ not-allowed, KHÔNG nhận hover.
 *
 * Hover dùng token `primary-hover` chứ không phải `brightness-110` như bản
 * trước: bộ lọc độ sáng nhân giá trị màu, nên ở chế độ Tối - nơi `primary` vốn
 * đã sáng - nó đẩy nút gần về trắng và làm chữ `on-primary` tụt tương phản.
 * Token thì được canh bởi contrast.test.ts ở cả ba chế độ, bộ lọc thì không.
 */
const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active',
  secondary: 'bg-surface border border-line-control text-fg hover:bg-hovered hover:border-primary',
  ghost: 'bg-transparent text-fg-secondary hover:bg-hovered hover:text-fg',
  // Sắc phụ của con dấu tín nhiệm. Chữ dùng --on-status vì nền là màu ngữ nghĩa.
  teal: 'bg-accent text-on-status hover:opacity-90',
  danger: 'bg-danger text-on-status hover:opacity-90',
} as const;

// Chiều cao lấy từ token mật độ: Comfortable 36px, Compact 32px (data-density).
// `sm`/`lg` là hai bậc phụ quanh nó, không phải một thang riêng.
const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-control px-sp4 text-sm',
  lg: 'h-11 px-sp6 text-base',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type ButtonProps = {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Đa hình: nơi gọi dùng cả 'button', 'a' và Link của Next. */
  as?: React.ElementType;
  className?: string;
  [key: string]: unknown;
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  as,
  className = '',
  ...props
}: ButtonProps) => {
  // Giữ `??` dự phòng dù kiểu đã ràng: các trang gọi component này hiện vẫn là
  // .js chưa được kiểm kiểu, nên giá trị ngoài union vẫn tới được đây lúc chạy.
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold cursor-pointer',
    'transition-colors duration-fast ease-standard',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    // Disabled thắng mọi biến thể: `:disabled` chặn cả hover lẫn đổ bóng.
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none',
    SIZES[size] ?? SIZES.md,
    VARIANTS[variant] ?? VARIANTS.primary,
    className,
  ].join(' ');
  const Tag = (as ?? 'button') as React.ElementType;
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
};

export default Button;
