import React from 'react';

import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/**
 * Một vùng danh sách không có gì để vẽ. Component này tồn tại để phân biệt HAI
 * trạng thái mà repo này đã trả giá đắt vì gộp chúng lại thành một:
 *
 *   `kind="empty"`  - truy vấn xong, thật sự chưa có dữ liệu. Trang trống là ĐÚNG.
 *   `kind="failed"` - KHÔNG truy vấn được. Trang trống là LỖI.
 *
 * Ngày 28/10/2026 đo được: Neon treo compute vì vượt hạn mức, mọi trang công
 * khai của tsudev.com trả HTTP 200 kèm dòng chữ "Chưa có bài viết." - y hệt một
 * blog mới dựng. Việc đó sống hai tháng. Nếu `kind="failed"` đã tồn tại thì
 * ngày đầu tiên đã có người nhìn thấy nó.
 *
 * Vì thế hai nhánh KHÁC NHAU VỀ THỊ GIÁC, không chỉ khác chữ: nhánh lỗi mang
 * viền trạng thái và nền tint để mắt bắt được từ xa mà không cần đọc.
 *
 * Prop `explain` là BẮT BUỘC ở nhánh `empty` và không có giá trị mặc định, có
 * chủ đích: mỗi kênh trống vì một lý do khác nhau, và một câu giải thích dùng
 * chung sẽ nói sai ở ít nhất một chỗ. `/projects` trống vì dự án do NGƯỜI đăng
 * và agent bị cấm tạo dự án mới (Project mang dữ liệu pháp lý); `/docs` thưa vì
 * trần kênh là 1 bài/ngày. Hứa "nội dung sẽ tự xuất hiện" ở trang đầu là một
 * lời hứa sai vĩnh viễn.
 */
export type EmptyStateProps = {
  kind?: 'empty' | 'failed';
  icon?: IconName;
  title?: string;
  /** Một câu nói VÌ SAO vùng này trống, viết riêng cho đúng kênh đó. */
  explain?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
};

export const EmptyState = ({
  kind = 'empty',
  icon,
  title,
  explain,
  action,
  className = '',
}: EmptyStateProps) => {
  const failed = kind === 'failed';

  return (
    <Card
      // `role="status"` + `aria-live="polite"` ở nhánh lỗi: trạng thái này
      // thường xuất hiện SAU khi trang đã vẽ (client-side chuyển trang), và một
      // thay đổi không được thông báo thì người dùng trình đọc màn hình không
      // biết gì - họ chỉ thấy một danh sách im lặng không bao giờ có nội dung.
      role={failed ? 'status' : undefined}
      aria-live={failed ? 'polite' : undefined}
      className={`p-8 text-center ${
        failed ? 'border-l-2 border-warning bg-warning-tint' : ''
      } ${className}`}
    >
      {icon && (
        <div className="flex justify-center mb-3">
          <Icon name={icon} size={28} />
        </div>
      )}

      <p className="font-semibold text-fg">
        {title ?? (failed ? 'Không tải được nội dung' : 'Chưa có nội dung')}
      </p>

      <div className="mt-2 text-sm text-fg-secondary max-w-prose mx-auto">
        {failed
          ? explain ?? (
              <>
                Lượt gọi tới máy chủ nội dung đã thất bại, nên đây <strong>không</strong> phải
                &quot;chưa có gì&quot; - dữ liệu có thể vẫn còn nguyên. Thử tải lại trang sau ít
                phút.
              </>
            )
          : explain}
      </div>

      {action && (
        <div className="mt-5">
          <Button
            size="sm"
            variant={failed ? 'secondary' : 'primary'}
            {...(action.href ? { as: 'a' as const, href: action.href } : {})}
            {...(action.onClick ? { onClick: action.onClick } : {})}
          >
            {action.label}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default EmptyState;
