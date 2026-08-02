import React from 'react';

const VARIANTS = {
  primary: 'text-[var(--primary-contrast)] bg-brand hover:brightness-110',
  secondary: 'bg-panel border border-hairstrong text-ink hover:border-brand',
  ghost: 'bg-transparent text-inksoft hover:bg-panel2 hover:text-ink',
  teal: 'text-[#04231f] bg-teal hover:brightness-110',
  danger: 'text-[var(--on-vivid)] bg-[var(--error)] hover:brightness-110',
};
const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  as = 'button',
  className = '',
  ...props
}) => {
  const cls = `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    SIZES[size] || SIZES.md
  } ${VARIANTS[variant] || VARIANTS.primary} ${className}`;
  const Tag = as;
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
};

export default Button;
