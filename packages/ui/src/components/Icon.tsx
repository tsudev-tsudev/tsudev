import React from 'react';

/**
 * Bộ icon dùng chung.
 *
 * MÀU ĐI THEO CHỨC NĂNG, KHÔNG THEO Ý THÍCH TỪNG TRANG. Mỗi tên icon dưới đây
 * được gắn cứng với một nhóm hành động, và nhóm đó quyết định màu:
 *
 *   nav     xanh dương  điều hướng, liên kết, mở
 *   create  xanh lá     tạo, thêm, tải lên
 *   edit    hổ phách    sửa, cấu hình
 *   danger  đỏ          xoá, thu hồi, huỷ
 *   info    tím         siêu dữ liệu, thời gian, số liệu
 *   trust   ngọc        con dấu, xác minh, chữ ký
 *
 * Vì sao gắn cứng chứ không cho truyền màu: khi mỗi trang tự chọn, cùng một
 * hành động "xoá" sẽ đỏ ở trang này và xám ở trang kia, và người dùng mất khả
 * năng đọc màu như một tín hiệu. Cần một sắc khác nghĩa là cần một CHỨC NĂNG
 * khác — thêm vào bảng, đừng ghi đè tại chỗ gọi.
 *
 * Sáu màu được canh tương phản ≥4.5:1 với cả ba tầng bề mặt ở CẢ HAI chế độ
 * (packages/ui/test/contrast.test.ts). Icon ở đây mang thông tin, nên nó chịu
 * ngưỡng của chữ chứ không phải của đồ hoạ trang trí.
 */

type Role = 'nav' | 'create' | 'edit' | 'danger' | 'info' | 'trust';

const ROLE_CLASS: Record<Role, string> = {
  nav: 'text-icon-nav',
  create: 'text-icon-create',
  edit: 'text-icon-edit',
  danger: 'text-icon-danger',
  info: 'text-icon-info',
  trust: 'text-icon-trust',
};

/** Đường vẽ + chức năng của từng icon. `stroke` dùng currentColor nên màu do lớp cha quyết định. */
const ICONS = {
  // --- nav ---
  home: { role: 'nav', d: 'M3.5 10.5 12 3.5l8.5 7M5.5 9.2V20h13V9.2M9.8 20v-5.5h4.4V20' },
  external: {
    role: 'nav',
    d: 'M14 4h6v6M20 4l-8.5 8.5M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
  },
  search: { role: 'nav', circle: [11, 11, 7], d: 'M20 20l-3.2-3.2' },
  chevron: { role: 'nav', d: 'M9 5l7 7-7 7' },
  doc: { role: 'nav', d: 'M6 3h7l5 5v13H6zM13 3v5h5M9 12.5h6M9 16.5h6' },
  // --- create ---
  plus: { role: 'create', d: 'M12 5v14M5 12h14' },
  upload: {
    role: 'create',
    d: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  },
  check: { role: 'create', d: 'M4.5 12.5l5 5 10-10' },
  // --- edit ---
  edit: { role: 'edit', d: 'M4 20h4L19 9l-4-4L4 16v4zM14.5 5.5l4 4' },
  settings: {
    role: 'edit',
    circle: [12, 12, 3.2],
    d: 'M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9',
  },
  // --- danger ---
  trash: {
    role: 'danger',
    d: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5V20a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6.5M10 11v5M14 11v5',
  },
  warning: { role: 'danger', d: 'M12 3.5 21 20H3zM12 9.5v4.5M12 16.8v.2' },
  // --- info ---
  clock: { role: 'info', circle: [12, 12, 8.5], d: 'M12 7.2V12l3.2 2' },
  tag: { role: 'info', d: 'M3.5 11.4V4.5a1 1 0 0 1 1-1h6.9l9.1 9.1-7.9 7.9zM8 8v.2' },
  info: { role: 'info', circle: [12, 12, 8.5], d: 'M12 11v5.5M12 7.8v.2' },
  // --- trust ---
  seal: {
    role: 'trust',
    d: 'M12 3l7.5 3.2v5.1c0 4.4-3 8.2-7.5 9.7-4.5-1.5-7.5-5.3-7.5-9.7V6.2zM8.8 12.2l2.4 2.4 4.2-4.6',
  },
  key: { role: 'trust', circle: [8.5, 12, 3.8], d: 'M12.3 12H21M17.5 12v3M20 12v2.2' },
} as const satisfies Record<string, { role: Role; d: string; circle?: readonly number[] }>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  /** Nhãn cho trình đọc màn hình. Bỏ trống = icon trang trí và bị ẩn khỏi cây a11y. */
  label?: string;
  className?: string;
};

export const Icon = ({ name, size = 16, label, className = '' }: IconProps) => {
  const spec = ICONS[name] as { role: Role; d: string; circle?: readonly number[] };
  const c = spec.circle;
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
      <path
        d={spec.d}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Icon;
