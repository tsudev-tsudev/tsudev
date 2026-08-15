// Suy ra danh tính người gọi từ phiên next-auth, dùng chung cho mọi BFF/proxy.
//
// Bốn nơi (lib/bff.ts và ba route pages/api/*/[...path].ts) trước đây mỗi nơi
// tự chép lại cùng một đoạn này. Đó là mã quyết định "server tin bạn là ai" —
// đúng loại mã mà CLAUDE.md đã phải cảnh báo riêng cho ba bản authMiddleware
// gần trùng nhau. Một bản duy nhất thì không có bản nào lệch đi trong im lặng.
import type { JWT } from 'next-auth/jwt';

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
 * Đoạn đường dẫn của route catch-all.
 *
 * Next khai `req.query.path` là `string | string[] | undefined` và cả ba đều
 * xảy ra thật. Bản cũ viết `req.query.path || []` rồi `.join('/')` — với một
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
 * SSR — trang 500 chứ không phải 404.
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
