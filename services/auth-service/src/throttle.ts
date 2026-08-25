import { prisma } from '@tsudev/db'

/**
 * Giới hạn tần suất và khoá tài khoản.
 *
 * HAI TRỤC, có chủ đích:
 *
 *  - theo IP (`LoginAttempt`): chặn một máy dò hàng nghìn tài khoản.
 *  - theo tài khoản (`User.failedLoginCount` / `lockedUntil`): chặn nhiều máy
 *    cùng dò MỘT tài khoản.
 *
 * Chỉ có một trong hai thì kẻ tấn công đổi trục là đi qua được. Chặn theo IP
 * riêng lẻ còn bị botnet vượt, còn khoá theo tài khoản riêng lẻ thì biến thành
 * công cụ để khoá người khác ra khỏi tài khoản của họ - nên khoá tài khoản có
 * THỜI HẠN chứ không vĩnh viễn, và không bao giờ lộ ra ngoài rằng tài khoản đó
 * có tồn tại hay không.
 */

/** Số lần thử hỏng tối đa trên một IP trong cửa sổ. */
export const IP_MAX_FAILURES = 20
export const IP_WINDOW_MS = 15 * 60 * 1000

/** Số lần sai LIÊN TIẾP trên một tài khoản trước khi khoá tạm. */
export const ACCOUNT_MAX_FAILURES = 8
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000

/** Dọn bản ghi cũ hơn ngần này - bảng chỉ phục vụ cửa sổ trượt, không phải kiểm toán. */
const RETENTION_MS = 24 * 60 * 60 * 1000

export async function recordAttempt(identifier: string, succeeded: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { identifier, succeeded } })
}

/** true = IP này đã vượt ngưỡng và phải bị từ chối ngay, chưa cần chạm mật khẩu. */
export async function ipIsThrottled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - IP_WINDOW_MS)
  const failures = await prisma.loginAttempt.count({
    where: { identifier: ip, succeeded: false, createdAt: { gte: since } },
  })
  return failures >= IP_MAX_FAILURES
}

/**
 * Dọn rác. Gọi theo cơ hội chứ không phải cron: bảng này chỉ lớn khi đang bị
 * tấn công, và đúng lúc đó thì mỗi lần thử đăng nhập đã đi qua đây rồi.
 */
export async function pruneAttempts(): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
  })
}

export function accountIsLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now()
}

/**
 * Ghi nhận một lần sai cho tài khoản, khoá tạm nếu đã đủ ngưỡng.
 *
 * Cập nhật bằng MỘT câu lệnh có điều kiện thay vì đọc-rồi-ghi: hai lần thử
 * song song đọc cùng một giá trị rồi cùng ghi `n+1` sẽ đếm thành một lần.
 */
export async function noteAccountFailure(userId: string): Promise<void> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  })
  if (updated.failedLoginCount >= ACCOUNT_MAX_FAILURES) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS), failedLoginCount: 0 },
    })
  }
}

/**
 * Dấu vết của lần đăng nhập vừa thành công.
 *
 * `method` là chuỗi chứ không enum ('password' | 'passkey' | 'oauth:github' |
 * 'oauth:google'): thêm nhà cung cấp danh tính là dữ liệu, không phải migration
 * - cùng lý do `OAuthAccount.provider` là chuỗi.
 */
export type LoginTrace = {
  method: string
  ip: string | null
  country: string | null
}

export async function noteAccountSuccess(userId: string, trace: LoginTrace): Promise<void> {
  // Bốn cột ghi trong MỘT câu lệnh, không tách ra: `lastLoginAt` mà rời khỏi ba
  // cột kia là trang quản trị nói một đằng, nhật ký bảo mật nói một nẻo.
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginMethod: trace.method,
      lastLoginIp: trace.ip,
      lastLoginCountry: trace.country,
    },
  })
}

/**
 * IP của người gọi.
 *
 * Đọc từ `x-forwarded-for` là BẮT BUỘC ở đây: service này luôn đứng sau một
 * proxy (dev-proxy ở local, Render ở production), nên `req.ip` là địa chỉ của
 * proxy - giới hạn theo nó sẽ gộp cả thế giới vào một xô.
 *
 * Lấy phần tử ĐẦU TIÊN và chỉ khi có proxy tin cậy phía trước; client tự đặt
 * header này được, nhưng proxy của ta ghi đè phần nó thấy.
 */
/**
 * Mã quốc gia của người gọi, lấy từ header `CF-IPCountry` mà Cloudflare đặt ở
 * tầng biên và BFF chuyển tiếp xuống.
 *
 * Cố ý KHÔNG suy ra từ IP: việc đó cần một cơ sở dữ liệu GeoIP, và nếu ở đây có
 * hai đường sinh ra quốc gia thì dữ liệu cũ sẽ im lặng khác dữ liệu mới. Không
 * có header (test, gọi nội bộ, dev không qua Cloudflare) ⇒ NULL, và NULL phải
 * đọc là "không biết", không phải "không xác định được".
 *
 * Cloudflare trả 'XX' khi chính nó không xác định được - giữ nguyên giá trị đó
 * thay vì đổi thành NULL: "Cloudflare bó tay" và "không đi qua Cloudflare" là
 * hai chuyện khác nhau, và phân biệt được thì mới chẩn đoán được.
 */
export function callerCountry(headers: Record<string, unknown>): string | null {
  const raw = headers['cf-ipcountry']
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return null
  const code = v.trim().toUpperCase()
  // Đúng hai chữ cái. Header do client tự đặt được ở môi trường không có
  // Cloudflare phía trước, nên không nhận bất cứ thứ gì dài hơn vào DB.
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export function callerIp(headers: Record<string, unknown>, fallback: string): string {
  const raw = headers['x-forwarded-for']
  const first = Array.isArray(raw) ? raw[0] : raw
  if (typeof first === 'string' && first.trim()) {
    const ip = first.split(',')[0]?.trim()
    if (ip) return ip.slice(0, 45)
  }
  return fallback.slice(0, 45)
}
