import { createHash, randomBytes, timingSafeEqual } from 'crypto'

import { prisma } from '@tsudev/db'
import type { AuthTokenPurpose } from '@prisma/client'

/**
 * Token một lần gửi qua email (xác minh địa chỉ, đặt lại mật khẩu).
 *
 * DB chỉ giữ SHA-256 của token, không giữ token. Một bản sao DB bị rò — qua
 * backup, qua log truy vấn, qua một lỗ đọc tuỳ ý — không được phép biến thành
 * khả năng đặt lại mật khẩu của mọi tài khoản đang chờ. Cùng lý do với việc
 * không lưu mật khẩu dạng thô.
 *
 * Băm ở đây dùng SHA-256 chứ không phải Argon2id, và đó là ĐÚNG: token là 32
 * byte ngẫu nhiên từ CSPRNG, không có gì để dò. Argon2 chỉ cần khi đầu vào có
 * entropy thấp như mật khẩu người đặt.
 */

const TTL_MS: Record<AuthTokenPurpose, number> = {
  // Xác minh email rộng tay: người ta hay mở mail vào hôm sau.
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  // Đặt lại mật khẩu hẹp: cửa sổ này là cửa sổ chiếm tài khoản nếu hộp thư bị
  // đọc lén.
  PASSWORD_RESET: 60 * 60 * 1000,
}

const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex')

export type IssuedToken = { raw: string; expiresAt: Date }

/**
 * Cấp token mới và HUỶ mọi token cùng loại còn hiệu lực của người đó.
 *
 * Huỷ cái cũ là có chủ đích: bấm "quên mật khẩu" ba lần không được để lại ba
 * đường vào cùng sống, vì mỗi đường là một email nữa có thể bị đọc lén.
 */
export async function issueToken(userId: string, purpose: AuthTokenPurpose): Promise<IssuedToken> {
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TTL_MS[purpose])
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({ data: { userId, purpose, tokenHash: hashToken(raw), expiresAt } }),
  ])
  return { raw, expiresAt }
}

/**
 * Đổi token thô lấy userId, và ĐÁNH DẤU ĐÃ DÙNG trong cùng một thao tác.
 *
 * `updateMany` với điều kiện `usedAt: null` là thứ làm cho token dùng một lần
 * thật sự: hai request đến cùng lúc thì chỉ một cái đếm được 1 dòng đã đổi.
 * Đọc rồi mới ghi sẽ để cả hai đi qua.
 */
export async function consumeToken(raw: string, purpose: AuthTokenPurpose): Promise<string | null> {
  if (!raw || raw.length > 200) return null
  const tokenHash = hashToken(raw)
  const row = await prisma.authToken.findUnique({ where: { tokenHash } })
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null
  }
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  return claimed.count === 1 ? row.userId : null
}

/**
 * So sánh hai chuỗi ngắn theo thời gian hằng.
 *
 * Dùng cho mã TOTP và mã dự phòng, nơi so sánh bằng `===` rò rỉ số ký tự khớp
 * đầu tiên qua thời gian trả lời.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
