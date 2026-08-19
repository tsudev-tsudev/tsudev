import { getToken } from 'next-auth/jwt';

import type { JWT } from 'next-auth/jwt';
import type { GetServerSidePropsContext, NextApiRequest } from 'next';

/**
 * Tên cookie phiên - MỘT nguồn sự thật cho cả hai phía.
 *
 * ⚠️ Đây là chỗ đã làm hỏng TOÀN BỘ đường ghi đã xác thực trên production, âm
 * thầm, trong nhiều ngày.
 *
 * `pages/api/auth/[...nextauth].ts` phải khai `cookies.sessionToken.name` tường
 * minh để đặt được thuộc tính `domain` (cookie phải dùng chung giữa `tsudev.com`
 * và `www.tsudev.com`). Nhưng khai tên tường minh nghĩa là **bỏ quy ước đặt tên
 * của next-auth**: trên HTTPS nó tự thêm tiền tố `__Secure-`.
 *
 * `getToken()` thì đi theo quy ước đó. Không truyền `cookieName`, nó suy ra tên
 * từ `NEXTAUTH_URL`:
 *
 * | Môi trường | Cookie thật được đặt      | Tên `getToken` đi tìm                | Kết quả |
 * | ---------- | ------------------------- | ------------------------------------ | ------- |
 * | dev (http) | `next-auth.session-token` | `next-auth.session-token`            | khớp    |
 * | prod (https)| `next-auth.session-token`| `__Secure-next-auth.session-token`   | **null**|
 *
 * `getToken` trả `null` được các nơi gọi hiểu là "chưa đăng nhập", nên triệu
 * chứng là **401 sau khi đã đăng nhập thành công**, và trang `/trust/*` đá cả
 * VIP về `/login`. Không có lỗi nào được ném, không log nào đỏ.
 *
 * Và nó KHÔNG BAO GIỜ lộ ra ở dev hay E2E: cả hai chạy trên `http://`, nơi hai
 * cột trong bảng trên trùng nhau. Đây là loại lỗi chỉ tồn tại ở production.
 *
 * Vì thế đừng bao giờ gọi thẳng `getToken()` ở nơi khác - dùng
 * `readSessionToken()` bên dưới. `test/sessionCookie.test.ts` quét cả cây và đỏ
 * nếu có chỗ gọi thẳng.
 */
export const SESSION_COOKIE_NAME = process.env.NEXTAUTH_COOKIE_NAME || 'next-auth.session-token';

/** Kiểu request tối thiểu mà `getToken` nhận - API route lẫn `getServerSideProps`. */
type TokenRequest = NextApiRequest | GetServerSidePropsContext['req'];

/**
 * Đọc phiên next-auth từ request.
 *
 * Truyền `cookieName` TƯỜNG MINH để không phụ thuộc vào việc `getToken` suy ra
 * tên - đó chính là chỗ đã lệch. Trả `null` khi không có phiên hợp lệ.
 */
export async function readSessionToken(req: TokenRequest): Promise<JWT | null> {
  return getToken({
    req: req as NextApiRequest,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
  });
}
