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
 * công cụ để khoá người khác ra khỏi tài khoản của họ — nên khoá tài khoản có
 * THỜI HẠN chứ không vĩnh viễn, và không bao giờ lộ ra ngoài rằng tài khoản đó
 * có tồn tại hay không.
 */

/** Số lần thử hỏng tối đa trên một IP trong cửa sổ. */
export const IP_MAX_FAILURES = 20
export const IP_WINDOW_MS = 15 * 60 * 1000

/** Số lần sai LIÊN TIẾP trên một tài khoản trước khi khoá tạm. */
export const ACCOUNT_MAX_FAILURES = 8
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000

/** Dọn bản ghi cũ hơn ngần này — bảng chỉ phục vụ cửa sổ trượt, không phải kiểm toán. */
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

export async function noteAccountSuccess(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
}

/**
 * IP của người gọi.
 *
 * Đọc từ `x-forwarded-for` là BẮT BUỘC ở đây: service này luôn đứng sau một
 * proxy (dev-proxy ở local, Render ở production), nên `req.ip` là địa chỉ của
 * proxy — giới hạn theo nó sẽ gộp cả thế giới vào một xô.
 *
 * Lấy phần tử ĐẦU TIÊN và chỉ khi có proxy tin cậy phía trước; client tự đặt
 * header này được, nhưng proxy của ta ghi đè phần nó thấy.
 */
export function callerIp(headers: Record<string, unknown>, fallback: string): string {
  const raw = headers['x-forwarded-for']
  const first = Array.isArray(raw) ? raw[0] : raw
  if (typeof first === 'string' && first.trim()) {
    const ip = first.split(',')[0]?.trim()
    if (ip) return ip.slice(0, 45)
  }
  return fallback.slice(0, 45)
}
