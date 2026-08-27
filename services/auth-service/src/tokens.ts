import { createHash, randomBytes, timingSafeEqual } from 'crypto'

import { prisma } from '@tsudev/db'
import type { AuthTokenPurpose } from '@prisma/client'

/**
 * Token một lần gửi qua email (xác minh địa chỉ, đặt lại mật khẩu).
 *
 * DB chỉ giữ SHA-256 của token, không giữ token. Một bản sao DB bị rò - qua
 * backup, qua log truy vấn, qua một lỗ đọc tuỳ ý - không được phép biến thành
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
  // Mã 6 số thì NGƯỢC LẠI - hẹp hết mức chịu được. Cửa sổ sống của mã cũng
  // chính là cửa sổ dò: mỗi phút nó còn hiệu lực là thêm một phút kẻ tấn công
  // được gõ thử. 10 phút đủ để người dùng mở hộp thư và gõ lại, không đủ để
  // biến 10^6 khả năng thành việc dò được.
  EMAIL_VERIFY_CODE: 10 * 60 * 1000,
  // Đặt lại mật khẩu hẹp: cửa sổ này là cửa sổ chiếm tài khoản nếu hộp thư bị
  // đọc lén.
  PASSWORD_RESET: 60 * 60 * 1000,
  // Đổi email cũng hẹp: đổi địa chỉ là đổi danh tính đăng nhập, sát với đặt lại
  // mật khẩu về mức nhạy cảm.
  EMAIL_CHANGE: 60 * 60 * 1000,
}

const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex')

export type IssuedToken = { raw: string; expiresAt: Date }

/// Số lần gõ SAI tối đa cho một mã, trước khi mã đó chết hẳn.
///
/// 5 lần trên 10^6 khả năng, cộng với vòng đời 10 phút và trần gửi mỗi ngày, đưa
/// xác suất đoán trúng xuống mức không đáng kể. Con số này là MỘT trong ba lớp
/// chặn, và là lớp duy nhất chặn được kiểu tấn công không cần gửi thêm mã nào.
export const MAX_CODE_ATTEMPTS = 5

/// Sinh mã 6 chữ số bằng CSPRNG, KHÔNG phải `Math.random()`.
///
/// `Math.random()` không phải nguồn ngẫu nhiên mật mã: trạng thái của nó suy ra
/// được từ vài giá trị đã phát, nên một mã đoán được là mọi mã đoán được. Lấy
/// theo bội số của 10^6 để không lệch phân phối - phép `% 1000000` trên một số
/// nguyên bất kỳ làm các giá trị đầu dải xuất hiện nhiều hơn.
export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits
  const limit = Math.floor(0xffffffff / max) * max
  let n: number
  do {
    n = randomBytes(4).readUInt32BE(0)
  } while (n >= limit)
  return String(n % max).padStart(digits, '0')
}

/**
 * Cấp một mã số dùng một lần cho `EMAIL_VERIFY_CODE`.
 *
 * Trả về mã THÔ để gửi mail; DB chỉ giữ băm của nó, giống hệt token liên kết.
 * Cấp mã mới huỷ mã cũ - bấm "gửi lại" ba lần không được để ba mã cùng sống,
 * vì mỗi mã còn sống là thêm một mục tiêu để dò.
 */
export async function issueVerifyCode(userId: string): Promise<IssuedToken> {
  const raw = generateNumericCode()
  const expiresAt = new Date(Date.now() + TTL_MS.EMAIL_VERIFY_CODE)
  await prisma.$transaction([
    prisma.authToken.deleteMany({
      where: { userId, purpose: 'EMAIL_VERIFY_CODE', usedAt: null },
    }),
    prisma.authToken.create({
      data: { userId, purpose: 'EMAIL_VERIFY_CODE', tokenHash: hashToken(raw), expiresAt },
    }),
  ])
  return { raw, expiresAt }
}

export type CodeCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: 'no_code' | 'expired' | 'too_many_attempts' | 'wrong'; left?: number }

/**
 * Đối chiếu mã người dùng gõ với mã đang chờ của chính họ.
 *
 * ⚠️ Khác `consumeToken`: ở đó token là 32 byte ngẫu nhiên nên tra thẳng theo
 * băm là đủ. Ở đây mã chỉ có 10^6 khả năng, nên phải tra theo NGƯỜI trước rồi
 * mới so mã - tra theo băm sẽ biến endpoint thành một cỗ máy dò mã của toàn hệ
 * thống: gõ một mã bất kỳ và nó khớp với BẤT KỲ tài khoản nào đang chờ.
 *
 * Mỗi lần sai cộng một vào `attempts`, và cộng TRƯỚC khi trả lời - nửa chừng bị
 * ngắt thì phải nghiêng về phía khoá chặt hơn, không phải phía cho thử thêm.
 */
export async function checkVerifyCode(userId: string, code: string): Promise<CodeCheck> {
  const row = await prisma.authToken.findFirst({
    where: { userId, purpose: 'EMAIL_VERIFY_CODE', usedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return { ok: false, reason: 'no_code' }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' }
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' }

  if (!constantTimeEqual(hashToken(code), row.tokenHash)) {
    const updated = await prisma.authToken.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })
    return { ok: false, reason: 'wrong', left: Math.max(0, MAX_CODE_ATTEMPTS - updated.attempts) }
  }

  // `updateMany` kèm `usedAt: null` là thứ làm cho mã dùng MỘT lần thật sự: hai
  // request đến cùng lúc thì chỉ một cái đếm được 1 dòng đã đổi.
  const { count } = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (count !== 1) return { ok: false, reason: 'no_code' }
  return { ok: true, userId }
}

/**
 * Cấp token mới và HUỶ mọi token cùng loại còn hiệu lực của người đó.
 *
 * Huỷ cái cũ là có chủ đích: bấm "quên mật khẩu" ba lần không được để lại ba
 * đường vào cùng sống, vì mỗi đường là một email nữa có thể bị đọc lén.
 */
export async function issueToken(
  userId: string,
  purpose: AuthTokenPurpose,
  newEmail: string | null = null
): Promise<IssuedToken> {
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TTL_MS[purpose])
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({
      data: { userId, purpose, tokenHash: hashToken(raw), expiresAt, newEmail },
    }),
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
 * Như `consumeToken` nhưng cho EMAIL_CHANGE: trả về CẢ userId lẫn địa chỉ mới đã
 * chờ ở token. Tách hàm riêng vì chỉ purpose này mới có `newEmail`, và trộn vào
 * hàm chung sẽ buộc mọi lời gọi khác nhận thêm một trường luôn null.
 *
 * `newEmail` rỗng (dữ liệu hỏng) coi như token không hợp lệ - không đổi email về
 * một địa chỉ trống.
 */
export async function consumeEmailChange(
  raw: string
): Promise<{ userId: string; newEmail: string } | null> {
  if (!raw || raw.length > 200) return null
  const tokenHash = hashToken(raw)
  const row = await prisma.authToken.findUnique({ where: { tokenHash } })
  if (
    !row ||
    row.purpose !== 'EMAIL_CHANGE' ||
    row.usedAt ||
    row.expiresAt.getTime() < Date.now() ||
    !row.newEmail
  ) {
    return null
  }
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  return claimed.count === 1 ? { userId: row.userId, newEmail: row.newEmail } : null
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
