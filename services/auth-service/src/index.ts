require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env - nạp thêm .env ở
// gốc repo. Giống ba service kia.
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}
try {
  require('../../../packages/observability/initSentry').initServer({ service: 'auth-service' })
} catch (e) {
  /* observability là tuỳ chọn */
}
import express from 'express'
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express'

import { prisma } from '@tsudev/db'
import { createAuthMiddleware, lookupUser } from '@tsudev/auth'
import { createHash } from 'crypto'

import { checkPasswordPolicy, hashPassword, verifyPassword, burnTiming } from './password'
import { issueToken, consumeToken, constantTimeEqual } from './tokens'
import { loginOptions, loginVerify, registerOptions, registerVerify } from './passkey'
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  otpauthUri,
  verifyTotp,
} from './totp'
import { sendMail, verifyEmailHtml, resetPasswordHtml } from './mailer'
import { INVITE_GRANTS_ROLE, generateInviteCode, hashInviteCode, redeemInvite } from './invite'
import {
  accountIsLocked,
  callerIp,
  ipIsThrottled,
  noteAccountFailure,
  noteAccountSuccess,
  pruneAttempts,
  recordAttempt,
} from './throttle'

export const app = express()
app.use(express.json({ limit: '64kb' }))
app.disable('x-powered-by')

// Header bảo mật, giống ba service kia (xem commit 74c496a).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }))

// ---------------------------------------------------------------------------
// Cổng nội bộ
//
// KHÁC trust-service: ở đây KHÔNG có endpoint công khai nào. Mọi route đều do
// BFF của Next gọi, không bao giờ do trình duyệt gọi thẳng. Nếu một ngày nào đó
// cần một route công khai thì nó phải được cân nhắc riêng, không phải mặc định.
// ---------------------------------------------------------------------------
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || ''
app.use('/api', (req, res, next) => {
  if (!INTERNAL_TOKEN) return next()
  if (req.get('x-internal-token') === INTERNAL_TOKEN) return next()
  return res.status(401).json({ error: 'Thiếu hoặc sai x-internal-token' })
})

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next)
  }

const str = (v: unknown, max = 400): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** Tên đăng nhập: chữ, số, gạch dưới, gạch ngang, chấm. Không phân biệt hoa thường. */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/
/** Kiểm email ở mức "có đúng một @ và hai bên không rỗng" - phần còn lại do việc gửi thư tự chứng minh. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/

// ---------------------------------------------------------------------------
// Đăng ký
// ---------------------------------------------------------------------------
app.post(
  '/api/identity/register',
  asyncHandler(async (req, res) => {
    const username = str(req.body?.username, 40).trim().toLowerCase()
    const email = str(req.body?.email, 200).trim().toLowerCase()
    const password = str(req.body?.password, 400)
    const displayName = str(req.body?.displayName, 80).trim() || username

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'invalid_username' })
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid_email' })
    }
    const pwProblem = checkPasswordPolicy(password)
    if (pwProblem) return res.status(400).json({ error: 'weak_password', detail: pwProblem })

    // Tên đăng nhập bị chiếm thì PHẢI nói thẳng - người dùng cần chọn tên khác,
    // và tên đăng nhập vốn công khai trên site nên không có gì để giấu.
    const takenName = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    if (takenName) return res.status(409).json({ error: 'username_taken' })

    // Email trùng thì NGƯỢC LẠI: trả về như thể đã tạo xong. Nói "email này đã
    // đăng ký" biến form đăng ký thành công cụ dò xem ai có tài khoản ở đây.
    // Người sở hữu thật vẫn biết chuyện gì xảy ra - họ nhận được thư báo.
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      const link = `${siteUrl()}/login`
      await sendMail(
        email,
        'Có người thử đăng ký bằng email của bạn',
        `<p>Địa chỉ này đã có tài khoản tsudev. Nếu bạn vừa thử đăng ký, hãy <a href="${link}">đăng nhập</a> hoặc dùng chức năng quên mật khẩu.</p>`
      )
      return res.status(201).json({ ok: true })
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        displayName,
        passwordHash: await hashPassword(password),
        role: 'MEMBER',
      },
      select: { id: true, displayName: true },
    })

    const token = await issueToken(user.id, 'EMAIL_VERIFY')
    await sendMail(
      email,
      'Xác minh email cho tài khoản tsudev',
      verifyEmailHtml(user.displayName || username, `${siteUrl()}/verify-email?token=${token.raw}`)
    )
    return res.status(201).json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Kiểm thông tin đăng nhập - do NextAuth authorize() gọi
//
// Đây là service DUY NHẤT đọc User.passwordHash. `apps/frontend-main` chạy trên
// Cloudflare Workers: nó không có kết nối Postgres và không nạp được native
// module, nên việc kiểm mật khẩu KHÔNG THỂ nằm ở đó. Ràng buộc hạ tầng ấy tình
// cờ trùng với ranh giới bảo mật đúng đắn.
// ---------------------------------------------------------------------------
app.post(
  '/api/identity/verify-credentials',
  asyncHandler(async (req, res) => {
    const identifier = str(req.body?.identifier, 200).trim().toLowerCase()
    const password = str(req.body?.password, 400)
    const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '0.0.0.0')

    if (!identifier || !password) return res.status(400).json({ error: 'invalid_credentials' })

    if (await ipIsThrottled(ip)) {
      return res.status(429).json({ error: 'rate_limited' })
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    })

    // Không có tài khoản: vẫn đốt thời gian bằng một lần verify thật. Trả lời
    // trong 1ms ở nhánh này và ~50ms ở nhánh kia là một kênh liệt kê tài khoản.
    if (!user || !user.passwordHash) {
      await burnTiming(password)
      await recordAttempt(ip, false)
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const ok = await verifyPassword(user.passwordHash, password)

    if (!ok) {
      await recordAttempt(ip, false)
      await noteAccountFailure(user.id)
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    // Mật khẩu ĐÚNG nhưng tài khoản đang bị khoá tạm. Chỉ tới nhánh này mới nói
    // ra chuyện khoá - người đang đứng đây đã chứng minh họ biết mật khẩu, nên
    // câu trả lời không tiết lộ gì cho người ngoài.
    if (accountIsLocked(user)) {
      await recordAttempt(ip, false)
      return res
        .status(423)
        .json({ error: 'account_locked', until: user.lockedUntil?.toISOString() })
    }

    // --- Bước hai: TOTP -----------------------------------------------------
    //
    // Chỉ tính khi người dùng ĐÃ XÁC NHẬN (confirmedAt khác null). Một bí mật đã
    // tạo nhưng chưa xác nhận nghĩa là họ mới quét mã QR rồi bỏ dở - coi đó là
    // đã bật 2FA sẽ khoá chính họ ra khỏi tài khoản.
    const totp = await prisma.totpCredential.findUnique({ where: { userId: user.id } })
    if (totp?.confirmedAt) {
      const supplied = str(req.body?.totp, 32).trim()
      if (!supplied) {
        // Mật khẩu đã đúng, nên nói ra rằng cần bước hai là an toàn: người gọi
        // đã tự chứng minh. KHÔNG ghi nhận là đăng nhập thành công ở đây.
        return res.status(401).json({ error: 'totp_required' })
      }
      const secret = totp.secretEnc ? decryptSecret(totp.secretEnc) : null
      const okTotp = secret ? verifyTotp(secret, supplied) : false
      const okBackup = okTotp ? false : await consumeBackupCode(user.id, supplied)
      if (!okTotp && !okBackup) {
        await recordAttempt(ip, false)
        await noteAccountFailure(user.id)
        return res.status(401).json({ error: 'totp_invalid' })
      }
    }

    await recordAttempt(ip, true)
    await noteAccountSuccess(user.id)
    pruneAttempts().catch(() => {
      /* dọn rác hỏng không được làm hỏng đăng nhập */
    })

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      sessionVersion: user.sessionVersion,
      emailVerified: !!user.emailVerifiedAt,
    })
  })
)

// ---------------------------------------------------------------------------
// Xác minh email
// ---------------------------------------------------------------------------
app.post(
  '/api/identity/verify-email',
  asyncHandler(async (req, res) => {
    const userId = await consumeToken(str(req.body?.token, 200), 'EMAIL_VERIFY')
    if (!userId) return res.status(400).json({ error: 'invalid_token' })
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
    return res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Quên / đặt lại mật khẩu
// ---------------------------------------------------------------------------
app.post(
  '/api/identity/request-password-reset',
  asyncHandler(async (req, res) => {
    const email = str(req.body?.email, 200).trim().toLowerCase()
    const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '0.0.0.0')

    // Phản hồi GIỐNG NHAU dù email có tồn tại hay không, kể cả khi bị chặn tần
    // suất. Đây là điểm dò tài khoản kinh điển.
    const generic = { ok: true }
    if (await ipIsThrottled(ip)) return res.json(generic)
    await recordAttempt(ip, false)

    if (!EMAIL_RE.test(email)) return res.json(generic)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.json(generic)

    const token = await issueToken(user.id, 'PASSWORD_RESET')
    await sendMail(
      email,
      'Đặt lại mật khẩu tsudev',
      resetPasswordHtml(
        user.displayName || user.username,
        `${siteUrl()}/reset-password?token=${token.raw}`
      )
    )
    return res.json(generic)
  })
)

app.post(
  '/api/identity/reset-password',
  asyncHandler(async (req, res) => {
    const password = str(req.body?.password, 400)
    const pwProblem = checkPasswordPolicy(password)
    if (pwProblem) return res.status(400).json({ error: 'weak_password', detail: pwProblem })

    const userId = await consumeToken(str(req.body?.token, 200), 'PASSWORD_RESET')
    if (!userId) return res.status(400).json({ error: 'invalid_token' })

    // sessionVersion tăng lên: đặt lại mật khẩu PHẢI đá mọi phiên đang mở ra.
    // Nếu tài khoản bị chiếm thì kẻ chiếm đang giữ một phiên hợp lệ, và đổi mật
    // khẩu mà không thu hồi phiên thì không lấy lại được gì.
    //
    // Mở khoá luôn: người vừa chứng minh quyền kiểm soát hộp thư không nên bị
    // giữ ngoài cửa bởi bộ đếm mà chính kẻ tấn công đã làm tăng.
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(password),
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
        // Đặt lại mật khẩu qua email CHỨNG MINH quyền kiểm soát địa chỉ đó, nên
        // nó cũng xác minh luôn email nếu trước đó chưa xác minh.
        emailVerifiedAt: new Date(),
      },
    })
    return res.json({ ok: true })
  })
)

/**
 * Đổi một mã dự phòng lấy quyền đi tiếp, và ĐÁNH DẤU ĐÃ DÙNG.
 *
 * `updateMany` có điều kiện `usedAt: null` là thứ làm cho "một lần" là thật:
 * hai request đến cùng lúc thì chỉ một cái đếm được 1 dòng đã đổi.
 *
 * Mã lưu dưới dạng SHA-256 - không phải Argon2id, và đó là đúng: mã do CSPRNG
 * sinh, entropy cao, không có gì để dò.
 */
async function consumeBackupCode(userId: string, supplied: string): Promise<boolean> {
  const normalized = supplied.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z2-7]{10}$/.test(normalized)) return false
  const codeHash = createHash('sha256').update(normalized).digest('hex')
  const rows = await prisma.backupCode.findMany({ where: { userId, usedAt: null } })
  const match = rows.find((r) => constantTimeEqual(r.codeHash, codeHash))
  if (!match) return false
  const claimed = await prisma.backupCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  return claimed.count === 1
}

// ---------------------------------------------------------------------------
// Quản lý 2FA - cần đăng nhập
//
// Gắn xác thực theo NHÁNH: mọi thứ dưới /api/identity/totp đòi khẳng định danh
// tính của BFF. Các route phía trên (đăng ký, quên mật khẩu) cố ý công khai vì
// người gọi chúng chưa có danh tính nào.
// ---------------------------------------------------------------------------
const auth = createAuthMiddleware('auth')
app.use('/api/identity/totp', auth)

/** Sinh bí mật mới và trả về URI để quét. CHƯA bật 2FA - phải xác nhận đã. */
app.post(
  '/api/identity/totp/setup',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    const existing = await prisma.totpCredential.findUnique({ where: { userId: user.id } })
    if (existing?.confirmedAt) return res.status(409).json({ error: 'totp_already_enabled' })

    const secret = generateSecret()
    await prisma.totpCredential.upsert({
      where: { userId: user.id },
      update: { secretEnc: encryptSecret(secret), confirmedAt: null },
      create: { userId: user.id, secretEnc: encryptSecret(secret) },
    })
    // Bí mật thô CHỈ rời khỏi máy chủ ở đây, đúng một lần, cho chính chủ đang
    // đăng nhập. Sau khi xác nhận thì không đường nào đọc lại được nữa.
    return res.json({ secret, uri: otpauthUri(secret, user.email) })
  })
)

/** Xác nhận bằng mã đầu tiên, và CHỈ khi đó mới bật 2FA + phát mã dự phòng. */
app.post(
  '/api/identity/totp/confirm',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    const row = await prisma.totpCredential.findUnique({ where: { userId: user.id } })
    if (!row) return res.status(400).json({ error: 'totp_not_started' })
    if (row.confirmedAt) return res.status(409).json({ error: 'totp_already_enabled' })

    const secret = decryptSecret(row.secretEnc)
    if (!secret || !verifyTotp(secret, str(req.body?.code, 32))) {
      return res.status(400).json({ error: 'totp_invalid' })
    }

    // Mã dự phòng phát CÙNG LÚC với việc bật, không phải "để sau": mất điện
    // thoại mà chưa có mã dự phòng là mất tài khoản.
    const codes = generateBackupCodes()
    await prisma.$transaction([
      prisma.totpCredential.update({
        where: { userId: user.id },
        data: { confirmedAt: new Date() },
      }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      prisma.backupCode.createMany({
        data: codes.map((c) => ({
          userId: user.id,
          codeHash: createHash('sha256').update(c).digest('hex'),
        })),
      }),
    ])
    // Mã thô hiện đúng một lần.
    return res.json({ ok: true, backupCodes: codes })
  })
)

/** Tắt 2FA. Đòi mật khẩu hiện tại - cookie phiên bị đánh cắp không đủ để tháo. */
app.post(
  '/api/identity/totp/disable',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    const password = str(req.body?.password, 400)
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    await prisma.$transaction([
      prisma.totpCredential.deleteMany({ where: { userId: user.id } }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    ])
    return res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Passkey (WebAuthn)
//
// Hai luồng, hai mức bảo vệ khác nhau:
//   - ĐĂNG KÝ khoá mới đòi đã đăng nhập (gắn auth theo nhánh, bên dưới).
//   - ĐĂNG NHẬP bằng khoá thì công khai - người gọi chưa có danh tính nào.
// ---------------------------------------------------------------------------

/** Công khai: xin thử thách để đăng nhập bằng passkey. */
app.post(
  '/api/identity/passkey/login-options',
  asyncHandler(async (req, res) => res.json(await loginOptions()))
)

/** Công khai: nộp chữ ký. Trả về danh tính giống hệt verify-credentials. */
app.post(
  '/api/identity/passkey/login-verify',
  asyncHandler(async (req, res) => {
    const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '0.0.0.0')
    if (await ipIsThrottled(ip)) return res.status(429).json({ error: 'rate_limited' })

    const challengeId = str(req.body?.challengeId, 60)
    const userId = challengeId ? await loginVerify(challengeId, req.body?.response) : null
    if (!userId) {
      await recordAttempt(ip, false)
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(401).json({ error: 'invalid_credentials' })

    // Tài khoản đang bị khoá thì passkey CŨNG không vào được. Bỏ qua ở đây sẽ
    // biến passkey thành đường vòng quanh chính cơ chế khoá.
    if (accountIsLocked(user)) {
      return res
        .status(423)
        .json({ error: 'account_locked', until: user.lockedUntil?.toISOString() })
    }

    // KHÔNG hỏi TOTP sau passkey: passkey đã là hai yếu tố trong một (thứ bạn
    // có + xác minh người dùng trên thiết bị), và nó chống giả mạo tên miền
    // mạnh hơn TOTP. Bắt thêm một bước nữa chỉ đổi bảo mật lấy phiền phức.
    await recordAttempt(ip, true)
    await noteAccountSuccess(user.id)
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      sessionVersion: user.sessionVersion,
      emailVerified: !!user.emailVerifiedAt,
    })
  })
)

// Đăng KÝ khoá mới thì phải đang đăng nhập.
app.use('/api/identity/passkey/register-options', auth)
app.use('/api/identity/passkey/register-verify', auth)
app.use('/api/identity/passkey/list', auth)
app.use('/api/identity/passkey/delete', auth)

app.post(
  '/api/identity/passkey/register-options',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    return res.json(await registerOptions(user))
  })
)

app.post(
  '/api/identity/passkey/register-verify',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const ok = await registerVerify(
      user.id,
      str(req.body?.challengeId, 60),
      req.body?.response,
      str(req.body?.label, 60)
    )
    return ok ? res.json({ ok: true }) : res.status(400).json({ error: 'passkey_invalid' })
  })
)

app.post(
  '/api/identity/passkey/list',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const keys = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      // KHÔNG trả publicKey ra ngoài: nó không bí mật, nhưng cũng không có lý do
      // gì để nó rời khỏi máy chủ.
      select: { id: true, label: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.json(keys)
  })
)

app.post(
  '/api/identity/passkey/delete',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    // deleteMany có ràng buộc userId: một id của người khác sẽ xoá 0 dòng thay
    // vì xoá khoá của họ. `delete` theo id trần là lỗ tham chiếu trực tiếp.
    const gone = await prisma.webAuthnCredential.deleteMany({
      where: { id: str(req.body?.id, 60), userId: user.id },
    })
    return res.json({ ok: gone.count === 1 })
  })
)

// ---------------------------------------------------------------------------
// Trạng thái phiên - cần đăng nhập
// ---------------------------------------------------------------------------
app.use('/api/identity/session-state', auth)

/**
 * Vai trò và sessionVersion HIỆN TẠI, đọc từ DB.
 *
 * Tồn tại vì `token.role` của next-auth chỉ được ghi ở lần đăng nhập ĐẦU TIÊN.
 * Sau khi đổi mã mời, DB nói VIP còn phiên vẫn nói MEMBER, nên điều hướng tiếp
 * tục giấu mục Con dấu - trông y hệt như việc đổi mã không có tác dụng, và
 * không có lỗi nào để lần theo.
 *
 * Chỉ trả về ba trường. Đây là đường mà callback `jwt` gọi, và bất cứ thứ gì
 * trả về ở đây đều đi thẳng vào JWT của người dùng.
 */
app.post(
  '/api/identity/session-state',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    return res.json({
      username: user.username,
      role: user.role,
      sessionVersion: user.sessionVersion,
    })
  })
)

// ---------------------------------------------------------------------------
// Mã mời vào Con dấu tín nhiệm - cần đăng nhập
//
// Đổi mã GHI VÀO `User.role`, tức là nó thuộc ranh giới danh tính, không phải
// của trust-service. trust-service chỉ việc gọi requireRole('VIP') và không cần
// biết mã mời tồn tại.
//
// Cả bốn route gắn auth theo NHÁNH. Chúng đi qua proxy CÓ PHIÊN
// pages/api/account/[...path].ts, không phải proxy công khai của /api/identity.
// ---------------------------------------------------------------------------
app.use('/api/identity/invite', auth)

/** Chỉ ADMIN mới cấp/liệt kê/thu hồi được mã. Đổi mã thì ai đăng nhập cũng được. */
const requireAdmin = async (req: Request, res: Response) => {
  const user = await lookupUser(req)
  if (!user) {
    res.status(401).json({ error: 'unauthenticated' })
    return null
  }
  // Đọc vai trò từ DB, không từ claim. Claim `role` trong khẳng định danh tính
  // CHỈ ĐỂ THAM KHẢO - xem gotcha REQUIRE_ROLE_ENFORCEMENT ở CLAUDE.md.
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'forbidden' })
    return null
  }
  return user
}

/** Nhật ký bất biến, cùng bảng với mọi hành động khác của hệ dấu. */
const auditInvite = (
  actor: { id: string; displayName: string | null; username: string },
  action: string,
  targetId: string,
  targetLabel: string,
  note?: string
) =>
  prisma.trustAuditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.displayName || actor.username,
      action,
      targetType: 'TrustInvite',
      targetId,
      targetLabel,
      note: note || null,
    },
  })

/**
 * Đổi mã lấy quyền vào vùng Con dấu.
 *
 * PHẢI đăng nhập trước (auth theo nhánh ở trên). Cho đổi mã ẩn danh nghĩa là mã
 * trở thành một URL chia sẻ được, và không có ai để gắn quyền vào.
 */
app.post(
  '/api/identity/invite/redeem',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    // Giới hạn theo IP dùng CHUNG bộ đếm với đường đăng nhập: mã mời là một bí
    // mật đoán được như mật khẩu, nên nó phải đóng góp vào cùng một ngân sách
    // thử. Bộ đếm riêng cho phép kẻ dò tiêu hết hạn mức của trục này rồi quay
    // sang trục kia.
    const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '0.0.0.0')
    if (await ipIsThrottled(ip)) return res.status(429).json({ error: 'rate_limited' })

    const outcome = await redeemInvite(user, str(req.body?.code, 60))
    if (!outcome.ok) {
      await recordAttempt(ip, false)
      // 'exhausted' nói ra được vì tới đó thì mã đã được chứng minh là có thật
      // và người gọi đã đăng nhập - không còn gì để dò.
      return res.status(outcome.reason === 'exhausted' ? 409 : 400).json({
        error: outcome.reason === 'exhausted' ? 'invite_exhausted' : 'invite_invalid',
      })
    }

    await recordAttempt(ip, true)
    if (!outcome.alreadyVip) {
      await auditInvite(user, 'invite.redeem', outcome.invite.id, outcome.invite.label)
    }
    // Vai trò mới nằm trong phiên next-auth, nên nó chỉ đổi ở lần làm mới token
    // kế tiếp. Trả `role` về đây để giao diện nói đúng ngay lập tức.
    return res.json({ ok: true, role: outcome.role })
  })
)

/** ADMIN: sinh mã mới. Mã thô trả về ĐÚNG MỘT LẦN - DB chỉ giữ SHA-256. */
app.post(
  '/api/identity/invite/create',
  asyncHandler(async (req, res) => {
    const actor = await requireAdmin(req, res)
    if (!actor) return

    const label = str(req.body?.label, 120).trim()
    if (!label) return res.status(400).json({ error: 'invalid_label' })

    const maxUses = Math.min(Math.max(Math.trunc(Number(req.body?.maxUses) || 1), 1), 500)
    const days = Math.trunc(Number(req.body?.expiresInDays) || 0)
    const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

    const { body, display } = generateInviteCode()
    const invite = await prisma.trustInvite.create({
      data: {
        codeHash: hashInviteCode(body),
        label,
        maxUses,
        expiresAt,
        createdById: actor.id,
      },
    })
    await auditInvite(actor, 'invite.create', invite.id, label, `maxUses=${maxUses}`)

    return res.json({
      ok: true,
      code: display,
      invite: publicInvite({ ...invite, _count: { redemptions: 0 } }),
    })
  })
)

/** ADMIN: liệt kê. KHÔNG bao giờ trả `codeHash` - nó là bí mật đã băm, không phải id. */
app.post(
  '/api/identity/invite/list',
  asyncHandler(async (req, res) => {
    const actor = await requireAdmin(req, res)
    if (!actor) return

    const rows = await prisma.trustInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { redemptions: true } } },
    })
    return res.json(rows.map(publicInvite))
  })
)

/** ADMIN: thu hồi. Đặt mốc thời gian chứ không xoá - lịch sử đổi mã phải còn. */
app.post(
  '/api/identity/invite/revoke',
  asyncHandler(async (req, res) => {
    const actor = await requireAdmin(req, res)
    if (!actor) return

    const id = str(req.body?.id, 60)
    // updateMany có điều kiện `revokedAt: null`: thu hồi hai lần không dời mốc
    // thời gian đã ghi.
    const gone = await prisma.trustInvite.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (gone.count !== 1) return res.status(404).json({ error: 'not_found' })

    const invite = await prisma.trustInvite.findUnique({ where: { id } })
    await auditInvite(actor, 'invite.revoke', id, invite?.label || id)
    return res.json({ ok: true })
  })
)

/**
 * Hình dạng an toàn để trả ra ngoài.
 *
 * Khai TƯỜNG MINH từng trường thay vì trải `...invite`: thêm một cột bí mật vào
 * model sau này sẽ tự động lọt ra ngoài nếu ở đây dùng phép trải.
 */
function publicInvite(row: {
  id: string
  label: string
  maxUses: number
  usedCount: number
  expiresAt: Date | null
  createdAt: Date
  revokedAt: Date | null
  _count?: { redemptions: number }
}) {
  return {
    id: row.id,
    label: row.label,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    redemptions: row._count?.redemptions ?? 0,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
    grantsRole: INVITE_GRANTS_ROLE,
  }
}

/**
 * URL công khai của site, dùng để dựng liên kết trong thư.
 *
 * KHÔNG có giá trị dự phòng cắm cứng. Một fallback sai ở đây nghĩa là thư đặt
 * lại mật khẩu mang liên kết trỏ vào hư không, mà lỗi đó chỉ lộ ra ở hộp thư
 * của người dùng - không log nào bắt được. Biến này do `npm run topology:gen`
 * sinh vào .env, và init() từ chối khởi động ở production nếu thiếu.
 */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_MAIN_URL || '').replace(/\/+$/, '')
}

// Lỗi không lường trước: ở production trả chuỗi chung, chi tiết chỉ vào log.
// err.message của Node hay mang theo đường dẫn tệp, tên bảng hoặc chuỗi kết nối.
const onError: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[auth] lỗi không bắt được:', err instanceof Error ? err.stack : err)
  if (res.headersSent) return next(err)
  const detail = process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err)
  res.status(500).json({ error: 'internal_error', detail })
}
app.use(onError)

/**
 * Chuẩn bị lúc khởi động: dọn token đã hết hạn và nhật ký thử đăng nhập cũ.
 *
 * backend-bundle gọi hàm này cho từng service ở chế độ gộp. Không có nó thì
 * hai bảng chỉ-ghi này lớn mãi - AuthToken hết hạn không còn dùng được nữa
 * nhưng vẫn là hash của thứ từng là bí mật, nên giữ lại là nợ chứ không phải
 * tài sản.
 */
export async function init(): Promise<void> {
  // Thiếu ở production = mọi liên kết trong thư đều hỏng, và hỏng ở một nơi
  // không quan sát được. Chết ồn ào lúc khởi động thay vì âm thầm lúc chạy -
  // cùng khuôn với TRUST_SIGNING_KEY của trust-service.
  if (process.env.NODE_ENV === 'production' && !siteUrl()) {
    throw new Error(
      '[auth] NEXT_PUBLIC_MAIN_URL bắt buộc ở production - liên kết trong thư dựng từ nó'
    )
  }
  try {
    const [tokens] = await Promise.all([
      prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      pruneAttempts(),
    ])
    if (tokens.count) console.log(`[auth] dọn ${tokens.count} token đã hết hạn`)
  } catch (e) {
    // Dọn rác hỏng không được chặn service khởi động.
    console.error('[auth] dọn lúc khởi động hỏng:', e instanceof Error ? e.message : e)
  }
}

export async function startServer(): Promise<void> {
  await init()
  const port = Number(process.env.PORT || process.env.AUTH_SERVICE_PORT || 4004)
  const host = process.env.BIND_HOST || '0.0.0.0'
  await new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.log(`[auth] auth-service nghe ${host}:${port}`)
      resolve()
    })
  })
}

// EMBEDDED=1 do backend-bundle đặt: ở chế độ gộp chỉ tiến trình cha mở cổng.
if (process.env.NODE_ENV !== 'test' && !process.env.EMBEDDED) {
  startServer().catch((err) => {
    console.error('[auth] không khởi động được', err && (err.stack || err))
  })
}
