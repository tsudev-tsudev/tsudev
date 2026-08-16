import React from 'react';

// Mọi màu chữ trên nền đặc đều đi qua token, không cắm cứng mã hex: `teal`
// trước đây dùng #04231f — một màu chữ TỐI, đúng cho nền teal sáng của chế độ
// tối, nhưng ở chế độ sáng thì nền teal là #0a6a5b (đậm) nên chữ tối trên nền
// tối gần như không đọc được. Token --on-vivid đảo theo chế độ, mã hex thì không.
const VARIANTS = {
  primary: 'text-brandcontrast bg-brand hover:brightness-110',
  secondary: 'bg-panel border border-hairstrong text-ink hover:border-brand',
  ghost: 'bg-transparent text-inksoft hover:bg-panel2 hover:text-ink',
  teal: 'text-onvivid bg-teal hover:brightness-110',
  danger: 'text-onvivid bg-error hover:brightness-110',
} as const;
const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
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
  const cls = `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    SIZES[size] ?? SIZES.md
  } ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`;
  const Tag = (as ?? 'button') as React.ElementType;
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
};

export default Button;
