import { useSession } from 'next-auth/react';
import { hasAtLeastRole } from '@tsudev/types';

/**
 * Người đang xem có thấy được các mục điều hướng của Con dấu không?
 *
 * Con dấu chạy ở chế độ mời (docs/refactor-trust-invite-access.md, Phần A) nên
 * mọi trang của nó trừ `/trust` đều chuyển hướng người chưa đạt VIP. Hiện link
 * dẫn tới chỗ chắc chắn bị đá ra là một lời hứa hão.
 *
 * ⚠️ ĐÂY KHÔNG PHẢI BẢO MẬT. Nó chỉ dọn giao diện. Cổng thật nằm ở
 * `requireRole('VIP')` của trust-service (đọc `User.role` từ DB, fail closed) và
 * ở `getServerSideProps` từng trang. Đừng bao giờ dựa vào việc giấu link.
 *
 * ⚠️ Vai trò lấy từ PHIÊN, mà `token.role` chỉ được ghi ở lần đăng nhập đầu.
 * Người vừa đổi mã mời thấy điều hướng cũ cho tới khi phiên được làm mới -
 * `/trust/redeem` và `/trust` gọi `update()` của useSession để làm đúng việc đó.
 */
export const useCanSeeTrust = (): boolean => {
  const { data: session } = useSession();
  return hasAtLeastRole((session?.user as { role?: string } | undefined)?.role, 'VIP');
};
