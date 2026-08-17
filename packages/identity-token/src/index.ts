import { SignJWT, jwtVerify } from 'jose';

import type { Role } from '@tsudev/types';

/**
 * Khẳng định danh tính do BFF ký, gửi xuống service backend.
 *
 * VÌ SAO TỒN TẠI
 *
 * Trước đây BFF nói cho service biết người gọi là ai bằng một header thuần:
 * `x-dev-user: tsudev`. Service chỉ đọc header đó khi `AUTH_DEV_BYPASS=true`,
 * và biến đó KHÔNG được đặt ở production. Hệ quả là hai lỗi ngược chiều nhau,
 * cùng một gốc:
 *
 *   - Ở production `req.user` luôn rỗng ⇒ mọi đường ghi đã xác thực trả 401.
 *   - Nếu ai đó "sửa" bằng cách bật cờ đó lên, thì `x-dev-user: <bất kỳ ai>`
 *     trở thành quyền ADMIN cấp bằng một dòng header.
 *
 * Khẳng định có chữ ký thay cả hai: nó buộc danh tính vào một chữ ký và một
 * hạn dùng, và nó chạy GIỐNG NHAU ở dev lẫn production - chính sự khác biệt
 * giữa hai môi trường mới là thứ đã giấu lỗi này đi.
 *
 * VÌ SAO LÀ MỘT PACKAGE RIÊNG
 *
 * Bên ký (apps/frontend-main, chạy trên Cloudflare Workers) và bên kiểm
 * (packages/auth, chạy trong service Node) phải khớp nhau từng claim. Chép
 * đoạn này thành hai bản là tái lập đúng lỗi mà ba bản authMiddleware gần
 * trùng nhau đã gây ra. Package này CỐ Ý không phụ thuộc Prisma - @tsudev/auth
 * có, và frontend trên Workers không nạp được nó.
 */

/** Ai ký. Kiểm ở phía service để một token từ hệ khác không dùng lại được. */
export const ISSUER = 'tsudev-bff';
/** Ký cho ai. */
export const AUDIENCE = 'tsudev-services';

/**
 * Hạn dùng NGẮN, có chủ đích.
 *
 * Khẳng định được ký lại cho từng request từ phiên next-auth, nên không có lý
 * do gì để nó sống lâu. Cửa sổ hẹp giới hạn thiệt hại nếu một token lọt ra
 * ngoài qua log truy cập hay bản ghi lỗi.
 */
const TTL_SECONDS = 120;

export type IdentityClaims = {
  /** Tên đăng nhập. Service tra `User` theo giá trị này. */
  sub: string;
  /**
   * Phiên bản phiên tại thời điểm đăng nhập, đối chiếu với `User.sessionVersion`
   * trong DB. Đây là thứ làm cho "đăng xuất mọi thiết bị" và "đổi mật khẩu thì
   * đá phiên cũ" có hiệu lực THẬT.
   *
   * Kiểm ở tầng service chứ không ở BFF, và đó là điểm mấu chốt: service đằng
   * nào cũng đã truy vấn `User` để lấy vai trò, nên phép so sánh này miễn phí.
   * Kiểm ở BFF sẽ tốn một truy vấn Workers → Neon cho MỖI request.
   */
  sv?: number;
  /**
   * Vai trò lấy từ phiên. CHỈ ĐỂ THAM KHẢO, KHÔNG phải nguồn phân quyền -
   * `requireRole()` luôn đọc `User.role` từ DB và fail closed. Có claim này để
   * ghi log và gỡ lỗi được, không phải để tin.
   */
  role?: Role | string;
};

const key = (secret: string): Uint8Array => new TextEncoder().encode(secret);

/**
 * Tên biến môi trường mang khoá ký. Khai ở đây để hai bên không bao giờ đọc
 * hai tên khác nhau - thiếu khoá ở một bên là 401 im lặng.
 */
export const SECRET_ENV = 'INTERNAL_IDENTITY_SECRET';

/**
 * Khoá HMAC phải đủ dài. Một chuỗi ngắn có thể bị dò offline từ một token duy
 * nhất bắt được, và dò được khoá nghĩa là mạo danh được bất kỳ ai.
 */
export const MIN_SECRET_LEN = 32;

export function readSecret(env: Record<string, string | undefined>): string | null {
  const s = env[SECRET_ENV];
  if (!s || s.length < MIN_SECRET_LEN) return null;
  return s;
}

/** Ký một khẳng định. Chạy được cả trên Node lẫn Cloudflare Workers (jose dùng WebCrypto). */
export async function signIdentity(claims: IdentityClaims, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: claims.role, sv: claims.sv })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(key(secret));
}

/** Kiểm một khẳng định. Trả về null cho MỌI lý do thất bại - không phân biệt ra ngoài. */
export async function verifyIdentity(
  token: string,
  secret: string
): Promise<IdentityClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Không có dung sai đồng hồ. Hạn dùng đã là 120s; cộng thêm dung sai chỉ
      // nới cửa sổ mà không giải quyết vấn đề nào có thật ở đây.
      clockTolerance: 0,
    });
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) return null;
    return {
      sub,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      sv: typeof payload.sv === 'number' ? payload.sv : undefined,
    };
  } catch {
    return null;
  }
}
