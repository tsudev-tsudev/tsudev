// Suy ra danh tính người gọi từ phiên next-auth, dùng chung cho mọi BFF/proxy.
//
// Bốn nơi (lib/bff.ts và ba route pages/api/*/[...path].ts) trước đây mỗi nơi
// tự chép lại cùng một đoạn này. Đó là mã quyết định "server tin bạn là ai" -
// đúng loại mã mà CLAUDE.md đã phải cảnh báo riêng cho ba bản authMiddleware
// gần trùng nhau. Một bản duy nhất thì không có bản nào lệch đi trong im lặng.
import type { JWT } from 'next-auth/jwt';

import { MIN_SECRET_LEN, SECRET_ENV, readSecret, signIdentity } from '@tsudev/identity-token';

/**
 * Tên đăng nhập gửi xuống service qua header `x-dev-user`.
 *
 * Lọc ký tự là CÓ CHỦ ĐÍCH chứ không phải làm đẹp: giá trị này đi vào header
 * HTTP, nên ký tự xuống dòng ở đây là một lỗ chèn header.
 */
export function usernameFromToken(token: JWT): string {
  return (
    (token.name || token.email || token.sub || 'member')
      .toString()
      .split('@')[0]
      ?.replace(/[^a-zA-Z0-9._-]/g, '') || 'member'
  );
}

/** Vai trò gửi xuống service. `token.role` là claim tuỳ biến nên kiểu là unknown. */
export function roleFromToken(token: JWT): string {
  return typeof token.role === 'string' && token.role ? token.role : 'member';
}

/**
 * Header xác thực cho một request đi xuống service backend.
 *
 * Thay cho `x-dev-user`, thứ chỉ là một dòng chữ và chỉ được service đọc khi
 * `AUTH_DEV_BYPASS=true` - biến không đặt ở production. Hệ quả là mọi đường ghi
 * đã xác thực trả 401 ở production, còn bật cờ lên thì một header cấp được
 * quyền ADMIN. Xem @tsudev/identity-token.
 *
 * Ký lại cho TỪNG request, hạn dùng 120 giây. Không cache: chi phí HMAC không
 * đáng kể so với chặng mạng ngay sau nó, còn một token được tái dùng là một
 * token sống lâu hơn cần thiết.
 *
 * Ném lỗi khi thiếu khoá thay vì trả header rỗng. Trả rỗng nghĩa là service từ
 * chối bằng 401, và "đăng nhập rồi mà vẫn 401" là đúng triệu chứng đã tốn cả
 * một phiên để chẩn đoán - lần này nó phải nói ra lý do.
 */
export async function identityHeaders(token: JWT): Promise<Record<string, string>> {
  const secret = readSecret(process.env);
  if (!secret) {
    throw new Error(
      `${SECRET_ENV} thiếu hoặc ngắn hơn ${MIN_SECRET_LEN} ký tự - không ký được khẳng định danh tính`
    );
  }
  const assertion = await signIdentity(
    {
      sub: usernameFromToken(token),
      role: roleFromToken(token),
      sv: typeof token.sessionVersion === 'number' ? token.sessionVersion : undefined,
    },
    secret
  );
  return { Authorization: `Bearer ${assertion}` };
}

/**
 * Đoạn đường dẫn của route catch-all.
 *
 * Next khai `req.query.path` là `string | string[] | undefined` và cả ba đều
 * xảy ra thật. Bản cũ viết `req.query.path || []` rồi `.join('/')` - với một
 * chuỗi đơn thì `.join` không tồn tại và route ném lỗi 500.
 */
export function catchAllSegments(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw;
  return raw ? [raw] : [];
}

/**
 * Đọc một route param dạng CHUỖI trong getServerSideProps.
 *
 * `params` có thể vắng mặt, và mỗi giá trị là `string | string[]`. Bản cũ viết
 * `String(params.slug || '')`, nên khi `params` vắng mặt là TypeError ngay trong
 * SSR - trang 500 chứ không phải 404.
 */
export function routeParam(
  params: Partial<Record<string, string | string[]>> | undefined,
  key: string
): string {
  const v = params?.[key];
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

/** Phần query string nguyên vẹn của request, kể cả khi req.url vắng mặt. */
export function queryStringOf(url: string | undefined): string {
  const u = url ?? '';
  return u.includes('?') ? u.slice(u.indexOf('?')) : '';
}
