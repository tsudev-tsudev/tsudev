import React from 'react';

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

// Biểu tượng thương hiệu tsudev (chim cú mạch điện), sinh từ packages/brand.
// Chỉ dùng phần biểu tượng ở đây; chữ "tsudev" render bằng text để ăn theo
// token màu của giao diện và luôn sắc nét ở mọi kích thước.
export const Logo = ({ size = 32, withWordmark = true, className = '' }: LogoProps) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <img
      src="/brand/logo-mark.png"
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
    {withWordmark && (
      <span className="font-bold text-[1.05rem] tracking-tight text-ink">
        tsu<span className="text-brandink">dev</span>
      </span>
    )}
  </span>
);

export default Logo;
