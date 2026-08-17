import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

import { prisma } from '@tsudev/db'

/**
 * Passkey (WebAuthn).
 *
 * Đây là đường đăng nhập MẠNH NHẤT ở đây, và lý do không phải "sinh trắc học
 * nghe hiện đại": chữ ký được buộc vào TÊN MIỀN bởi chính trình duyệt. Một
 * trang giả mạo ở tsudev-login.example không lấy được chữ ký dùng cho
 * tsudev.com, kể cả khi người dùng bị lừa hoàn toàn. Mật khẩu và TOTP đều
 * không có tính chất đó - cả hai đều gõ lại được vào một trang giả.
 *
 * Mật khẩu VẪN GIỮ làm đường dự phòng. Passkey gắn với thiết bị, và mất thiết
 * bị mà không còn đường nào khác là mất tài khoản.
 */

/** Tên miền mà passkey được buộc vào. Suy từ URL công khai, không cắm cứng. */
function rp(): { id: string; name: string; origin: string } {
  const raw = process.env.NEXT_PUBLIC_MAIN_URL || ''
  if (!raw) throw new Error('[auth] NEXT_PUBLIC_MAIN_URL bắt buộc để dùng passkey')
  const url = new URL(raw)
  return { id: url.hostname, name: 'tsudev', origin: url.origin }
}

/** Challenge sống ngắn: nó chỉ cần tồn tại đủ cho một lần bấm. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

async function storeChallenge(
  challenge: string,
  purpose: 'register' | 'login',
  userId?: string
): Promise<string> {
  const row = await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      purpose,
      userId: userId ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  })
  // Dọn theo cơ hội: bảng này chỉ lớn khi đang bị dội request, và đúng lúc đó
  // thì mỗi request đã đi qua đây rồi.
  prisma.webAuthnChallenge
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined)
  return row.id
}

/**
 * Lấy challenge ra và XOÁ trong cùng một thao tác.
 *
 * `deleteMany` trả về số dòng đã xoá, nên hai request đến cùng lúc chỉ một cái
 * đếm được 1. Đọc rồi mới xoá sẽ để cả hai đi qua với cùng một challenge -
 * đúng thứ challenge sinh ra để ngăn.
 */
async function takeChallenge(
  id: string,
  purpose: 'register' | 'login'
): Promise<{ challenge: string; userId: string | null } | null> {
  const row = await prisma.webAuthnChallenge.findUnique({ where: { id } })
  if (!row || row.purpose !== purpose || row.expiresAt.getTime() < Date.now()) return null
  const claimed = await prisma.webAuthnChallenge.deleteMany({ where: { id } })
  if (claimed.count !== 1) return null
  return { challenge: row.challenge, userId: row.userId }
}

export async function registerOptions(user: {
  id: string
  username: string
  displayName: string | null
}) {
  const { id, name } = rp()
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } })
  const options = await generateRegistrationOptions({
    rpID: id,
    rpName: name,
    userName: user.username,
    userDisplayName: user.displayName || user.username,
    // Loại trừ khoá đã đăng ký: không có nó thì cùng một thiết bị tạo được
    // nhiều passkey trùng nhau và danh sách thiết bị của người dùng thành rác.
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      // Khoá khám phá được: cho phép đăng nhập KHÔNG cần gõ tên đăng nhập.
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
  const challengeId = await storeChallenge(options.challenge, 'register', user.id)
  return { options, challengeId }
}

export async function registerVerify(
  userId: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  label?: string
): Promise<boolean> {
  const stored = await takeChallenge(challengeId, 'register')
  if (!stored || stored.userId !== userId) return false
  const { id, origin } = rp()

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: id,
  }).catch(() => null)

  if (!result?.verified || !result.registrationInfo) return false
  const { credential } = result.registrationInfo

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      label: label?.slice(0, 60) || null,
    },
  })
  return true
}

export async function loginOptions() {
  const { id } = rp()
  const options = await generateAuthenticationOptions({
    rpID: id,
    userVerification: 'preferred',
  })
  const challengeId = await storeChallenge(options.challenge, 'login')
  return { options, challengeId }
}

/** Trả về userId nếu chữ ký hợp lệ, null cho MỌI lý do thất bại. */
export async function loginVerify(
  challengeId: string,
  response: AuthenticationResponseJSON
): Promise<string | null> {
  const stored = await takeChallenge(challengeId, 'login')
  if (!stored) return null

  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
  })
  if (!cred) return null

  const { id, origin } = rp()
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: id,
    credential: {
      id: cred.credentialId,
      publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
      counter: cred.counter,
      transports: cred.transports as never,
    },
  }).catch(() => null)

  if (!result?.verified) return null

  // Bộ đếm chống PHÁT LẠI: giá trị mới phải lớn hơn giá trị đã lưu. Một số khoá
  // (nhất là passkey đồng bộ qua đám mây) luôn báo 0 - với chúng thì phép so
  // sánh này không nói lên gì, nên chỉ từ chối khi bộ đếm THỰC SỰ đi lùi.
  const next = result.authenticationInfo.newCounter
  if (cred.counter > 0 && next <= cred.counter) return null

  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: { counter: next, lastUsedAt: new Date() },
  })
  return cred.userId
}
