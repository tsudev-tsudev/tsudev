import React from 'react';

// Bộ avatar mặc định (sinh từ packages/brand - xem packages/brand/README.md).
// Mỗi tài khoản được gán ổn định một biến thể theo tên đăng nhập: cùng một
// người luôn ra cùng một avatar, nhưng phân bố đều như chọn ngẫu nhiên.
const VARIANT_COUNT = 6;

// Từ ngưỡng này trở xuống dùng bản rút gọn (2 kinh + 3 vĩ, nét dày hơn): ở
// 32–40px bản đầy đủ 3 kinh + 5 vĩ bị rối nét. Bản rút gọn cũng nhẹ hơn ~60%.
const SMALL_MAX = 48;

function defaultAvatarFor(name: string, size: number): string {
  const s = name || '?';
  // FNV-1a rút gọn - trộn đều hơn phép cộng mã ký tự, tránh dồn cục khi các
  // tên đăng nhập chỉ khác nhau vài ký tự.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const n = String((h % VARIANT_COUNT) + 1).padStart(2, '0');
  return `/avatars${size <= SMALL_MAX ? '/sm' : ''}/default-${n}.webp`;
}

type AvatarProps = {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
};

export const Avatar = ({ name = '?', src, size = 40, className = '' }: AvatarProps) => {
  const url = src || defaultAvatarFor(name, size);
  // Viền mảnh giữ cho đường tròn avatar luôn thấy được: ảnh avatar nền tối nên
  // nếu không có viền sẽ tan vào card tối.
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-panel2 ring-1 ring-[color:var(--border-strong)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    </span>
  );
};

export default Avatar;
