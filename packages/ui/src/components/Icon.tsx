import React from 'react';

import { ICONS, ROLE_CLASS } from './icons';
import type { IconName, IconRole, IconSpec } from './icons';

/**
 * Icon dùng chung. Bảng đường vẽ và quy tắc màu-theo-chức-năng nằm ở
 * `./icons.ts` - đọc khối chú thích đầu file đó trước khi thêm icon mới.
 *
 * Component này cố ý KHÔNG nhận prop màu. Màu do `role` của icon quyết định, và
 * `role` sống cùng đường vẽ trong bảng. Xem lý do ở `icons.ts`.
 */
type IconProps = {
  name: IconName;
  size?: number;
  /** Nhãn cho trình đọc màn hình. Bỏ trống = icon trang trí và bị ẩn khỏi cây a11y. */
  label?: string;
  className?: string;
};

export const Icon = ({ name, size = 16, label, className = '' }: IconProps) => {
  const spec = ICONS[name] as IconSpec;
  const c = spec.circle;
  const sc = spec.solidCircle;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      // Icon trang trí phải bị ẩn khỏi trình đọc màn hình, nếu không nó đọc
      // thành một "graphic" vô nghĩa xen giữa câu chữ.
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`${ROLE_CLASS[spec.role]} shrink-0 ${className}`}
    >
      {c && <circle cx={c[0]} cy={c[1]} r={c[2]} stroke="currentColor" strokeWidth="1.6" />}
      {sc && <circle cx={sc[0]} cy={sc[1]} r={sc[2]} fill="currentColor" />}
      {/* `d` rỗng là HỢP LỆ: icon chỉ gồm hình tròn đặc (chấm trạng thái) không
          có đường vẽ nào. Render một <path d=""> trống thì Chrome bỏ qua nhưng
          một số trình đọc màn hình đọc nó thành phần tử rỗng, nên bỏ hẳn. */}
      {spec.d && (
        <path
          d={spec.d}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

export type { IconName, IconRole };
export { ICONS };
export default Icon;
