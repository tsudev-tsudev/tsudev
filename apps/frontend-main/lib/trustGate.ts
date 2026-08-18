// Cổng gác bề mặt Con dấu ở tầng SSR.
//
// Con dấu chạy ở CHẾ ĐỘ MỜI (docs/refactor-trust-invite-access.md, Phần A): chỉ
// tài khoản đạt VIP - tức đã đổi một mã mời do admin cấp - mới nhìn thấy chương
// trình, danh bạ, hồ sơ tổ chức và trang xác minh.
//
// Chặn ở getServerSideProps chứ KHÔNG ẩn ở client: ẩn bằng CSS hay bằng nhánh
// render chỉ dọn giao diện, dữ liệu vẫn được nhúng sẵn trong __NEXT_DATA__ và
// bất kỳ ai xem nguồn cũng đọc được. Cổng thật thứ hai nằm ở trust-service,
// nơi `requireRole('VIP')` đọc `User.role` TỪ DB và fail closed - hàm này chỉ
// quyết định người dùng nhìn thấy gì, không phải service tin ai.
//
// ⚠️ `token.role` chỉ được ghi ở lần đăng nhập ĐẦU (xem CLAUDE.md). Người vừa
// đổi mã mời có DB nói VIP mà phiên vẫn nói MEMBER. `/trust/redeem` gọi
// `update()` của useSession ngay sau khi đổi, và trang `/trust` gọi lại một lần
// nữa cho người tới bằng liên kết cũ - nếu không, đổi mã xong vẫn bị đá ra và
// trông y hệt như mã không có tác dụng.
import { getToken } from 'next-auth/jwt';
import { hasAtLeastRole } from '@tsudev/types';

import type { GetServerSidePropsContext, Redirect } from 'next';

import { identityHeaders } from './identity';

/** Bậc tối thiểu để thấy bề mặt Con dấu. Một chỗ duy nhất, mọi trang đọc từ đây. */
export const TRUST_MIN_ROLE = 'VIP' as const;

/** Trang tiếp nhận người chưa đủ quyền: nó giải thích cách xin mã mời. */
export const TRUST_HOME = '/trust';

export type TrustAccess =
  /** Đủ quyền. `headers` mang khẳng định danh tính để SSR gọi trust-service. */
  | { ok: true; role: string; headers: Record<string, string> }
  /** Chưa đăng nhập - lối thoát là đăng nhập. */
  | { ok: false; reason: 'anonymous' }
  /** Đã đăng nhập nhưng chưa đạt VIP - lối thoát là đổi mã mời. */
  | { ok: false; reason: 'not-invited' };

export async function trustAccess(ctx: GetServerSidePropsContext): Promise<TrustAccess> {
  const token = await getToken({ req: ctx.req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return { ok: false, reason: 'anonymous' };
  if (!hasAtLeastRole(token.role, TRUST_MIN_ROLE)) return { ok: false, reason: 'not-invited' };
  return {
    ok: true,
    role: typeof token.role === 'string' ? token.role : TRUST_MIN_ROLE,
    headers: await identityHeaders(token),
  };
}

/**
 * Chuyển hướng cho một truy cập bị từ chối.
 *
 * Hai đích khác nhau cho hai lý do khác nhau, và sự khác biệt đó là thứ giữ cho
 * người dùng không bị kẹt: khách được đưa đi đăng nhập (kèm đường quay lại),
 * còn người đã đăng nhập được đưa về trang giải thích chế độ mời - đẩy họ tới
 * `/login` lần nữa chỉ tạo một vòng lặp vì họ đã đăng nhập rồi.
 */
export function trustRedirect(
  access: Extract<TrustAccess, { ok: false }>,
  ctx: GetServerSidePropsContext
): { redirect: Redirect } {
  if (access.reason === 'anonymous') {
    return {
      redirect: {
        destination: `/login?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }
  return { redirect: { destination: TRUST_HOME, permanent: false } };
}

/**
 * Khuôn dùng chung cho mọi trang `/trust/*` cần VIP.
 *
 * Trang chỉ viết phần lấy dữ liệu; phần quyết định ai vào được nằm ở đây, nên
 * thêm một trang mới không có cách nào quên mất cổng - đó chính là kiểu lỗi mà
 * bản trước của bề mặt này mắc phải (bốn trang không kiểm phiên).
 */
export async function withTrustAccess<P>(
  ctx: GetServerSidePropsContext,
  load: (access: Extract<TrustAccess, { ok: true }>) => Promise<{ props: P } | { notFound: true }>
): Promise<{ props: P } | { notFound: true } | { redirect: Redirect }> {
  const access = await trustAccess(ctx);
  if (!access.ok) return trustRedirect(access, ctx);
  return load(access);
}
