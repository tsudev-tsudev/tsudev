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
    {/* Chữ hiệu dùng bậc h4 (18px) của thang §4, không phải một giá trị tuỳ ý.
        Trước đây nó là 1.05rem ≈ 16.8px - không nằm trên thang nào và không đổi
        theo token. Đừng viết lại giá trị cũ ở đây kể cả trong chú thích: Tailwind
        quét NGUYÊN VĂN file, nên một class nằm trong comment vẫn được sinh ra
        CSS thật. */}
    {withWordmark && (
      <span className="font-bold text-h4 tracking-heading text-fg">
        tsu<span className="text-link">dev</span>
      </span>
    )}
  </span>
);

export default Logo;
