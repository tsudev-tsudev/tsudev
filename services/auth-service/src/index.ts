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
import { hasAtLeastRole, emailUsable } from '@tsudev/types'
import { createHash } from 'crypto'

import { checkPasswordPolicy, hashPassword, verifyPassword, burnTiming } from './password'
import { issueToken, consumeToken, consumeEmailChange, constantTimeEqual } from './tokens'
import { loginOptions, loginVerify, registerOptions, registerVerify } from './passkey'
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  otpauthUri,
  verifyTotp,
} from './totp'
import {
  sendMail,
  verifyEmailHtml,
  resetPasswordHtml,
  changeEmailHtml,
  emailChangedNoticeHtml,
  securityAlertHtml,
} from './mailer'
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
    logSecurity(user.id, 'account_created', req)
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

    // Vòng đời tài khoản: hẹn-xoá quá hạn ⇒ purge + từ chối; còn hạn / vô hiệu
    // hoá ⇒ khôi phục rồi cho vào. Xử lý TRƯỚC khi coi là đăng nhập thành công.
    const lifecycle = await handleLifecycleOnLogin(user, req)
    if (lifecycle === 'purged') {
      await recordAttempt(ip, false)
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    await recordAttempt(ip, true)
    await noteAccountSuccess(user.id)
    // Kiểm thiết bị lạ TRƯỚC khi ghi sự kiện login này (nếu ghi trước thì chính
    // IP hiện tại đã "từng thấy" và không cảnh báo lần nào).
    void alertIfNewDevice(user, req)
    logSecurity(user.id, 'login', req)
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
    logSecurity(userId, 'email_verified', req)
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
    logSecurity(userId, 'password_reset', req)
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
// Xác nhận đổi email
//
// CÔNG KHAI như verify-email: người bấm liên kết đang chứng minh quyền kiểm soát
// địa chỉ MỚI, và token trong liên kết là bằng chứng đó - không cần phiên. Yêu
// cầu đổi (đòi mật khẩu) nằm ở /api/identity/email/change bên dưới, có xác thực.
// ---------------------------------------------------------------------------
app.post(
  '/api/identity/confirm-email-change',
  asyncHandler(async (req, res) => {
    const outcome = await consumeEmailChange(str(req.body?.token, 200))
    if (!outcome) return res.status(400).json({ error: 'invalid_token' })
    const { userId, newEmail } = outcome

    // Địa chỉ mới có thể đã bị người khác đăng ký trong khoảng giữa lúc yêu cầu
    // và lúc xác nhận. `email` là @unique nên update sẽ ném; bắt trước để trả lỗi
    // sạch thay vì 500.
    const taken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    })
    if (taken && taken.id !== userId) return res.status(409).json({ error: 'email_taken' })

    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, displayName: true },
    })
    if (!before) return res.status(400).json({ error: 'invalid_token' })

    // Đổi email = đổi danh tính đăng nhập ⇒ tăng sessionVersion để đá mọi phiên
    // cũ ra, cùng lý do với đặt lại mật khẩu.
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } },
    })
    logSecurity(userId, 'email_changed', req, { note: `${before.email} → ${newEmail}` })

    // Báo địa chỉ CŨ: nếu tài khoản bị chiếm thì chủ thật vẫn nhận được ở hộp thư
    // cũ và biết đường lấy lại.
    await sendMail(
      before.email,
      'Email tài khoản tsudev vừa được đổi',
      emailChangedNoticeHtml(before.displayName || before.username, newEmail)
    )
    return res.json({ ok: true })
  })
)

// ---------------------------------------------------------------------------
// Quản lý 2FA - cần đăng nhập
//
// Gắn xác thực theo NHÁNH: mọi thứ dưới /api/identity/totp đòi khẳng định danh
// tính của BFF. Các route phía trên (đăng ký, quên mật khẩu) cố ý công khai vì
// người gọi chúng chưa có danh tính nào.
// ---------------------------------------------------------------------------
const auth = createAuthMiddleware('auth')
app.use('/api/identity/totp', auth)
// Gửi lại email xác minh, và đổi email - đều đòi đã đăng nhập.
app.use('/api/identity/verify', auth)
app.use('/api/identity/email', auth)
// Nhật ký bảo mật của chính mình.
app.use('/api/identity/security', auth)
// Vòng đời tài khoản (vô hiệu hoá / hẹn xoá).
app.use('/api/identity/account', auth)

/** Số ngày ân hạn trước khi tài khoản hẹn-xoá bị purge vĩnh viễn. */
const ACCOUNT_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000

/** Chính chủ: vô hiệu hoá MỀM. Đòi mật khẩu. Đăng nhập lại sẽ khôi phục. */
app.post(
  '/api/identity/account/deactivate',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const password = str(req.body?.password, 400)
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
    })
    logSecurity(user.id, 'account_deactivated', req)
    sendAlert(user, 'Tài khoản vừa bị vô hiệu hoá', 'Đăng nhập lại bất cứ lúc nào để khôi phục.')
    return res.json({ ok: true })
  })
)

/**
 * Chính chủ: hẹn XOÁ vĩnh viễn. Đòi mật khẩu. Tài khoản bị vô hiệu hoá ngay và
 * lên lịch purge sau ân hạn; đăng nhập lại trước hạn sẽ huỷ hẹn.
 */
app.post(
  '/api/identity/account/delete',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const password = str(req.body?.password, 400)
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    // OWNER không tự xoá được đường này: tài khoản gốc chỉ cấp bằng seed/DB, và
    // để nó tự xoá là tự tay bỏ bậc trần duy nhất. Hạ/xoá OWNER phải qua DB.
    if (user.role === 'OWNER') return res.status(403).json({ error: 'owner_cannot_self_delete' })

    const scheduledAt = new Date(Date.now() + ACCOUNT_DELETION_GRACE_MS)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: scheduledAt,
        deactivatedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    })
    logSecurity(user.id, 'account_deletion_scheduled', req, {
      note: `purge sau ${scheduledAt.toISOString()}`,
    })
    sendAlert(
      user,
      'Tài khoản được hẹn xoá vĩnh viễn',
      'Đăng nhập lại trước 30 ngày để huỷ. Quá hạn, dữ liệu sẽ bị xoá và không khôi phục được.'
    )
    return res.json({ ok: true, deletionScheduledAt: scheduledAt })
  })
)

/** Phát lại email xác minh cho chính mình. No-op nếu đã xác minh. */
app.post(
  '/api/identity/verify/resend',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    if (user.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true })

    // Chống dội thư: một token EMAIL_VERIFY vừa phát trong 60 giây thì từ chối.
    // Bấm "gửi lại" liên tục không được biến thành công cụ dội mail vào người
    // khác (email do người dùng khai lúc đăng ký, chưa được chứng minh là của họ).
    const recent = await prisma.authToken.findFirst({
      where: {
        userId: user.id,
        purpose: 'EMAIL_VERIFY',
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    })
    if (recent) return res.status(429).json({ error: 'too_soon' })

    const token = await issueToken(user.id, 'EMAIL_VERIFY')
    await sendMail(
      user.email,
      'Xác minh email cho tài khoản tsudev',
      verifyEmailHtml(
        user.displayName || user.username,
        `${siteUrl()}/verify-email?token=${token.raw}`
      )
    )
    return res.json({ ok: true })
  })
)

/** Yêu cầu đổi email: đòi mật khẩu, gửi liên kết xác nhận tới địa chỉ MỚI. */
app.post(
  '/api/identity/email/change',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    // Đổi email đòi mật khẩu hiện tại: cookie phiên bị đánh cắp không đủ để chiếm
    // đường khôi phục tài khoản. Cùng khuôn với totp/disable.
    const password = str(req.body?.password, 400)
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const newEmail = str(req.body?.newEmail, 200).trim().toLowerCase()
    if (!EMAIL_RE.test(newEmail)) return res.status(400).json({ error: 'invalid_email' })
    if (newEmail === user.email.toLowerCase()) return res.status(400).json({ error: 'same_email' })

    const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })
    if (taken) {
      // KHÔNG tiết lộ rằng địa chỉ đã có người dùng. Báo cho chính địa chỉ đó
      // biết có người thử gắn nó, rồi trả về như thể đã gửi thư xác nhận - cùng
      // nhánh chống dò tài khoản với email trùng ở đăng ký.
      await sendMail(
        newEmail,
        'Có người thử dùng email của bạn',
        `<p>Một tài khoản tsudev vừa thử đổi email sang địa chỉ này, nhưng nó đã gắn với một tài khoản khác. Nếu là bạn, hãy đăng nhập bằng tài khoản sẵn có hoặc dùng chức năng quên mật khẩu.</p>`
      )
      return res.json({ ok: true })
    }

    const token = await issueToken(user.id, 'EMAIL_CHANGE', newEmail)
    logSecurity(user.id, 'email_change_request', req, { note: `→ ${newEmail}` })
    await sendMail(
      newEmail,
      'Xác nhận đổi email tài khoản tsudev',
      changeEmailHtml(
        user.displayName || user.username,
        newEmail,
        `${siteUrl()}/confirm-email-change?token=${token.raw}`
      )
    )
    return res.json({ ok: true })
  })
)

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
    logSecurity(user.id, 'totp_enabled', req)
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
    logSecurity(user.id, 'totp_disabled', req)
    sendAlert(user, 'Xác thực hai bước (2FA) vừa bị tắt')
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
    const lifecycle = await handleLifecycleOnLogin(user, req)
    if (lifecycle === 'purged') {
      await recordAttempt(ip, false)
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    await recordAttempt(ip, true)
    await noteAccountSuccess(user.id)
    void alertIfNewDevice(user, req)
    logSecurity(user.id, 'login', req, { note: 'passkey' })
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
    if (ok) logSecurity(user.id, 'passkey_added', req)
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
    if (gone.count === 1) {
      logSecurity(user.id, 'passkey_removed', req)
      sendAlert(user, 'Một passkey vừa bị gỡ khỏi tài khoản')
    }
    return res.json({ ok: gone.count === 1 })
  })
)

// ---------------------------------------------------------------------------
// Hồ sơ của chính mình - cần đăng nhập
//
// Trước đợt này KHÔNG có route nào cho người dùng sửa hồ sơ của chính họ: mọi
// `prisma.user.update` trong repo đều thuộc về đặt lại mật khẩu, bộ đếm đăng
// nhập, hoặc quản trị. `displayName` được đặt một lần lúc đăng ký rồi không có
// đường nào đổi - mà nó lại là thứ hiển thị công khai dưới mỗi bài viết.
//
// Cả hai nhánh đi qua proxy CÓ PHIÊN pages/api/account/[...path].ts, không phải
// proxy công khai của /api/identity.
// ---------------------------------------------------------------------------
app.use('/api/identity/profile', auth)
app.use('/api/identity/password', auth)

/** Giới hạn độ dài. Cắt ở service chứ không tin giao diện đã cắt hộ. */
const MAX_DISPLAY_NAME = 60
const MAX_BIO = 500

/**
 * Chuẩn hoá một trường tuỳ chọn: chuỗi rỗng ⇒ NULL, không phải chuỗi rỗng.
 *
 * Phân biệt này có thật ở tầng dưới: `authorCard` của content-service rơi về
 * `username` khi `displayName` là NULL, còn chuỗi rỗng thì nó hiển thị ra một
 * khoảng trắng dưới bài viết. Để giao diện gửi '' mà lưu nguyên là tạo một
 * trạng thái không ai gõ được lần thứ hai.
 */
const optional = (v: unknown, max: number): string | null => {
  const t = str(v, max).trim()
  return t.length ? t : null
}

/** Hồ sơ hiện tại. POST (không phải GET) để đi chung một khuôn với proxy. */
app.post(
  '/api/identity/profile/get',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    return res.json({
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      role: user.role,
      hasPassword: Boolean(user.passwordHash),
      emailVerified: Boolean(user.emailVerifiedAt),
      // createdAt để giao diện đếm ngược ân hạn xác minh (emailUsable ở
      // @tsudev/types). Không nhạy cảm - chính chủ đọc hồ sơ của mình.
      createdAt: user.createdAt.toISOString(),
    })
  })
)

/**
 * Sửa hồ sơ. CHỈ ba trường, và danh sách đó là cố ý đóng.
 *
 * `username`, `email` và `role` KHÔNG nằm ở đây: đổi email là đường chiếm tài
 * khoản nếu không xác minh địa chỉ mới trước (§1.7 đợt B), còn `role` chỉ đổi
 * được bằng mã mời - để nó lọt vào một route "sửa hồ sơ" nghĩa là ai cũng tự
 * cấp được VIP bằng một dòng JSON.
 */
app.post(
  '/api/identity/profile/update',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    const displayName = optional(req.body?.displayName, MAX_DISPLAY_NAME)
    const bio = optional(req.body?.bio, MAX_BIO)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName, bio },
      select: { displayName: true, bio: true },
    })
    return res.json({ ok: true, ...updated })
  })
)

/**
 * Đổi mật khẩu - ĐÒI MẬT KHẨU HIỆN TẠI.
 *
 * Cookie phiên bị đánh cắp KHÔNG được phép đủ để đổi mật khẩu. Không có phép
 * kiểm này thì một phiên bị chiếm là mất hẳn tài khoản, vì kẻ chiếm đổi mật
 * khẩu xong là chính chủ không vào lại được.
 *
 * `sessionVersion` tăng lên để đá MỌI phiên khác ra - cùng lý do với
 * reset-password. Phiên đang thao tác cũng bị đá theo, nên trả `sessionVersion`
 * mới về để client gọi `update()` của useSession và tự nâng phiên của mình lên;
 * không có bước đó thì người vừa đổi mật khẩu thành công bị đăng xuất ngay lập
 * tức và trông y hệt như đổi mật khẩu đã hỏng.
 *
 * Tài khoản chỉ đăng nhập bằng passkey thì KHÔNG có `passwordHash`. Nó cần
 * "quên mật khẩu" chứ không phải route này - nói rõ ra, vì thông điệp
 * `invalid_credentials` ở đó sẽ khiến người dùng thử đi thử lại một thứ không
 * bao giờ đúng.
 */
app.post(
  '/api/identity/password/change',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })

    const current = str(req.body?.currentPassword, 400)
    const next = str(req.body?.newPassword, 400)

    if (!user.passwordHash) {
      // Đốt thời gian như nhánh sai mật khẩu: hai nhánh này phải tốn thời gian
      // gần nhau, nếu không thì đo thời lượng là biết tài khoản nào có mật khẩu.
      await burnTiming(current)
      return res.status(409).json({ error: 'no_password_set' })
    }
    if (!(await verifyPassword(user.passwordHash, current))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const problem = checkPasswordPolicy(next)
    if (problem) return res.status(400).json({ error: 'weak_password', detail: problem })

    const saved = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(next),
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
      select: { sessionVersion: true },
    })
    logSecurity(user.id, 'password_change', req)
    sendAlert(user, 'Mật khẩu vừa được đổi')
    return res.json({ ok: true, sessionVersion: saved.sessionVersion })
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

/** ADMIN trở lên (gồm OWNER) mới cấp/liệt kê/thu hồi được mã. Đổi mã thì ai đăng
 *  nhập cũng được. */
const requireAdmin = async (req: Request, res: Response) => {
  const user = await lookupUser(req)
  if (!user) {
    res.status(401).json({ error: 'unauthenticated' })
    return null
  }
  // Đọc vai trò từ DB, không từ claim. Claim `role` trong khẳng định danh tính
  // CHỈ ĐỂ THAM KHẢO - xem gotcha REQUIRE_ROLE_ENFORCEMENT ở CLAUDE.md.
  // Theo THỨ BẬC, không so bằng đúng: OWNER (trên ADMIN) phải kế thừa mọi quyền
  // ADMIN. So `=== 'ADMIN'` sẽ khoá OWNER khỏi chính công cụ admin - đúng lỗi đã
  // xảy ra khi nâng tsudev lên OWNER.
  if (!hasAtLeastRole(user.role, 'ADMIN')) {
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

    // Nâng vai trò tự phục vụ đòi email đủ dùng (đã xác minh, hoặc còn ân hạn).
    // Quá ân hạn mà chưa xác minh thì chặn: mã mời là đường leo thang đặc quyền,
    // không mở cho tài khoản chưa chứng minh quyền kiểm soát hộp thư.
    if (!emailUsable(user.emailVerifiedAt, user.createdAt)) {
      return res.status(403).json({ error: 'email_unverified' })
    }

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

// ---------------------------------------------------------------------------
// Quản lý tài khoản & phân quyền - CHỈ OWNER (tài khoản tsudev)
//
// Đây là bề mặt cấp/thu hồi vai trò, nên nó là ranh giới leo thang đặc quyền.
// Ba bất biến, mỗi cái chặn một đường tự nâng quyền:
//
//  1. Người gọi phải là OWNER, đọc TỪ DB fail-closed (requireOwner) - claim
//     trong khẳng định danh tính KHÔNG được tin (xem gotcha REQUIRE_ROLE...).
//  2. OWNER KHÔNG bao giờ cấp được qua endpoint: ASSIGNABLE_ROLES cố ý bỏ OWNER
//     (và GUEST). Bậc cao nhất chỉ đến từ seed/DB - để "ai ghi được vào bảng
//     role là tự cấp OWNER" không thành sự thật.
//  3. Không thao tác được lên một tài khoản OWNER khác, và không tự hạ/tự xoá
//     chính mình - tránh khoá cứng và tránh owner bị chính công cụ này lật.
//
// Đi qua proxy CÓ PHIÊN pages/api/account/[...path].ts (không phải proxy công
// khai /api/identity). Tên action 2 đoạn vì proxy chặn path quá 2 đoạn.
// ---------------------------------------------------------------------------
app.use('/api/identity/useradmin', auth)

/** Vai trò cấp được qua công cụ. OWNER và GUEST cố ý vắng mặt. */
const ASSIGNABLE_ROLES = ['MEMBER', 'AUTHOR', 'VIP', 'MODERATOR', 'ADMIN'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]
const isAssignableRole = (v: unknown): v is AssignableRole =>
  typeof v === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(v)

/** Người gọi phải là OWNER. Đọc vai trò TỪ DB, không từ claim. Fail closed. */
const requireOwner = async (req: Request, res: Response) => {
  const user = await lookupUser(req)
  if (!user) {
    res.status(401).json({ error: 'unauthenticated' })
    return null
  }
  if (user.role !== 'OWNER') {
    res.status(403).json({ error: 'forbidden' })
    return null
  }
  return user
}

/** Nhật ký bất biến cho thao tác lên tài khoản, cùng bảng với hệ dấu. */
const auditUser = (
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
      targetType: 'User',
      targetId,
      targetLabel,
      note: note || null,
    },
  })

/** Giữ nhật ký bảo mật 90 ngày. */
const SECURITY_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Ghi một sự kiện bảo mật cho tài khoản. FIRE-AND-FORGET: ghi log hỏng KHÔNG
 * được làm hỏng thao tác đã thành công (đăng nhập, đổi mật khẩu...). `actor` khác
 * chủ ⇒ hành động do admin thực hiện lên tài khoản người khác.
 */
function logSecurity(
  userId: string,
  type: string,
  req: Request,
  opts: { actor?: { id: string; displayName: string | null; username: string }; note?: string } = {}
): void {
  const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '')
  const userAgent = str(req.get('user-agent') || '', 400)
  prisma.securityEvent
    .create({
      data: {
        userId,
        type,
        ip: ip || null,
        userAgent: userAgent || null,
        actorId: opts.actor ? opts.actor.id : null,
        actorName: opts.actor ? opts.actor.displayName || opts.actor.username : null,
        note: opts.note || null,
      },
    })
    // Prune ngay của CHÍNH tài khoản này: nhật ký cũ hơn 90 ngày bị xoá. Giữ ở
    // đường ghi (bounded theo user, dùng index [userId, createdAt]) thay vì một
    // cron riêng - Render free không có chỗ chạy cron thường trực.
    .then(() =>
      prisma.securityEvent.deleteMany({
        where: { userId, createdAt: { lt: new Date(Date.now() - SECURITY_EVENT_RETENTION_MS) } },
      })
    )
    .catch((e) => console.error('[auth] logSecurity hỏng:', e instanceof Error ? e.message : e))
}

/**
 * Gửi thư CẢNH BÁO bảo mật (fire-and-forget). Khác `sendMail` trần: gói sẵn khuôn
 * "nếu không phải bạn thì làm gì". Dùng cho các sự kiện nhạy cảm mà chủ tài khoản
 * cần biết ngay cả khi CHÍNH họ vừa làm - vì nếu KHÔNG phải họ thì đây là tín
 * hiệu duy nhất họ nhận được.
 */
function sendAlert(
  user: { email: string; displayName: string | null; username: string },
  title: string,
  context?: string
): void {
  sendMail(
    user.email,
    `Cảnh báo bảo mật: ${title}`,
    securityAlertHtml(user.displayName || user.username, title, context)
  ).catch((e) => console.error('[auth] sendAlert hỏng:', e instanceof Error ? e.message : e))
}

/**
 * Đăng nhập từ thiết bị/vị trí LẠ thì gửi cảnh báo. "Lạ" = chưa từng có
 * SecurityEvent nào của tài khoản mang đúng IP này. Fire-and-forget, và fail-safe:
 * không có IP thì bỏ qua (không đoán bừa), lỗi truy vấn không chặn đăng nhập.
 */
async function alertIfNewDevice(
  user: { id: string; email: string; displayName: string | null; username: string },
  req: Request
): Promise<void> {
  try {
    const ip = callerIp(req.headers as Record<string, unknown>, req.ip || '')
    if (!ip) return
    const seen = await prisma.securityEvent.findFirst({
      where: { userId: user.id, ip },
      select: { id: true },
    })
    if (seen) return
    const ua = str(req.get('user-agent') || '', 200)
    sendAlert(
      user,
      'Có đăng nhập mới từ thiết bị hoặc vị trí chưa từng thấy',
      `IP: ${ip}${ua ? ` · ${ua}` : ''}`
    )
  } catch (e) {
    console.error('[auth] alertIfNewDevice hỏng:', e instanceof Error ? e.message : e)
  }
}

/**
 * Xử lý vòng đời tài khoản tại thời điểm đăng nhập THÀNH CÔNG (mật khẩu/passkey
 * đã đúng). Gọi TRƯỚC khi ghi nhận đăng nhập:
 *  - Hẹn xoá đã quá hạn ⇒ purge tài khoản, trả 'purged' (người gọi từ chối đăng nhập).
 *  - Hẹn xoá còn trong hạn ⇒ huỷ hẹn + khôi phục, trả 'cancelled'.
 *  - Chỉ vô hiệu hoá ⇒ khôi phục, trả 'reactivated'.
 *  - Bình thường ⇒ 'ok'.
 */
async function handleLifecycleOnLogin(
  user: { id: string; deactivatedAt: Date | null; deletionScheduledAt: Date | null },
  req: Request
): Promise<'ok' | 'purged' | 'cancelled' | 'reactivated'> {
  if (user.deletionScheduledAt) {
    if (user.deletionScheduledAt.getTime() <= Date.now()) {
      // Quá ân hạn: xoá thật. Bài viết giữ lại (Post.authorId ON DELETE SET NULL);
      // dữ liệu chặn xoá thì nuốt lỗi - tài khoản vẫn vô hiệu hoá nên vô hại.
      try {
        await prisma.user.delete({ where: { id: user.id } })
      } catch {
        /* linked records chặn xoá - để lần sau, tài khoản vẫn không vào được */
      }
      return 'purged'
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { deletionScheduledAt: null, deactivatedAt: null },
    })
    logSecurity(user.id, 'account_reactivated', req, { note: 'huỷ hẹn xoá khi đăng nhập' })
    return 'cancelled'
  }
  if (user.deactivatedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: null } })
    logSecurity(user.id, 'account_reactivated', req)
    return 'reactivated'
  }
  return 'ok'
}

/** Hình dạng sự kiện bảo mật trả ra ngoài. IP/UA chỉ chủ tài khoản và OWNER đọc. */
const publicSecurityEvent = (e: {
  id: string
  type: string
  ip: string | null
  userAgent: string | null
  actorId: string | null
  actorName: string | null
  note: string | null
  createdAt: Date
}) => ({
  id: e.id,
  type: e.type,
  ip: e.ip,
  userAgent: e.userAgent,
  byAdmin: e.actorId != null,
  actorName: e.actorName,
  note: e.note,
  createdAt: e.createdAt,
})

const SECURITY_EVENT_SELECT = {
  id: true,
  type: true,
  ip: true,
  userAgent: true,
  actorId: true,
  actorName: true,
  note: true,
  createdAt: true,
} as const

/** Chính chủ: đăng xuất khỏi MỌI thiết bị. Tăng sessionVersion - mọi token đã
 *  phát (kể cả phiên đang gọi) mất hiệu lực. Client phải làm mới phiên sau đó. */
app.post(
  '/api/identity/security/revoke-all',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const saved = await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
    logSecurity(user.id, 'sessions_revoked', req)
    return res.json({ ok: true, sessionVersion: saved.sessionVersion })
  })
)

/** Chính chủ: nhật ký bảo mật của mình (mới nhất trước). */
app.post(
  '/api/identity/security/events',
  asyncHandler(async (req, res) => {
    const user = await lookupUser(req)
    if (!user) return res.status(401).json({ error: 'unauthenticated' })
    const rows = await prisma.securityEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: SECURITY_EVENT_SELECT,
    })
    return res.json(rows.map(publicSecurityEvent))
  })
)

/**
 * Hình dạng an toàn của User để trả ra ngoài. Khai TƯỜNG MINH từng trường -
 * KHÔNG BAO GIỜ có `passwordHash`. Thêm cột bí mật vào model sau này sẽ không
 * tự lọt ra nếu ở đây không dùng phép trải.
 */
const publicUser = (u: {
  id: string
  username: string
  email: string
  displayName: string | null
  role: string
  emailVerifiedAt: Date | null
  createdAt: Date
  lastLoginAt: Date | null
  deactivatedAt: Date | null
  deletionScheduledAt: Date | null
}) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  emailVerified: u.emailVerifiedAt != null,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
  deactivatedAt: u.deactivatedAt,
  deletionScheduledAt: u.deletionScheduledAt,
})

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  lastLoginAt: true,
  deactivatedAt: true,
  deletionScheduledAt: true,
} as const

/** OWNER: liệt kê tài khoản. */
app.post(
  '/api/identity/useradmin/list',
  asyncHandler(async (req, res) => {
    if (!(await requireOwner(req, res))) return
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: USER_SELECT,
    })
    return res.json(rows.map(publicUser))
  })
)

/** OWNER: tạo tài khoản mới. Email đặt sẵn xác minh - đây là tài khoản nội bộ
 *  do owner cấp, không đi qua luồng gửi thư xác minh. */
app.post(
  '/api/identity/useradmin/create',
  asyncHandler(async (req, res) => {
    const actor = await requireOwner(req, res)
    if (!actor) return

    const username = str(req.body?.username, 40).trim().toLowerCase()
    const email = str(req.body?.email, 200).trim().toLowerCase()
    const displayName = str(req.body?.displayName, 80).trim() || username
    const password = str(req.body?.password, 400)
    const role = str(req.body?.role, 20)

    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'invalid_username' })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' })
    if (!isAssignableRole(role)) return res.status(400).json({ error: 'invalid_role' })
    const pwProblem = checkPasswordPolicy(password)
    if (pwProblem) return res.status(400).json({ error: 'weak_password', detail: pwProblem })

    // Công cụ quản trị nội bộ: nói thẳng khi trùng. Khác form đăng ký công khai
    // (nơi trùng email bị giấu để không thành máy dò tài khoản) - ở đây chỉ OWNER
    // gọi được, không có gì để dò.
    if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      return res.status(409).json({ error: 'username_taken' })
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ error: 'email_taken' })
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        displayName,
        passwordHash: await hashPassword(password),
        role,
        emailVerifiedAt: new Date(),
      },
      select: USER_SELECT,
    })
    await auditUser(actor, 'user.create', user.id, username, `role=${role}`)
    return res.status(201).json(publicUser(user))
  })
)

/** OWNER: đổi tên hiển thị. "Chỉnh sửa" ở mức an toàn - KHÔNG đổi email/mật khẩu
 *  qua đây (đổi email là đường chiếm tài khoản, mật khẩu có luồng đặt lại riêng). */
app.post(
  '/api/identity/useradmin/update',
  asyncHandler(async (req, res) => {
    const actor = await requireOwner(req, res)
    if (!actor) return

    const id = str(req.body?.id, 60)
    const displayName = str(req.body?.displayName, 80).trim()
    if (!displayName) return res.status(400).json({ error: 'invalid_displayName' })

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!target) return res.status(404).json({ error: 'not_found' })
    if (target.role === 'OWNER' && target.id !== actor.id) {
      return res.status(403).json({ error: 'cannot_target_owner' })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { displayName },
      select: USER_SELECT,
    })
    await auditUser(actor, 'user.update', id, user.username)
    return res.json(publicUser(user))
  })
)

/** OWNER: phân quyền / thu hồi vai trò (đặt về MEMBER). KHÔNG cấp được OWNER. */
app.post(
  '/api/identity/useradmin/role',
  asyncHandler(async (req, res) => {
    const actor = await requireOwner(req, res)
    if (!actor) return

    const id = str(req.body?.id, 60)
    const role = str(req.body?.role, 20)
    if (!isAssignableRole(role)) return res.status(400).json({ error: 'invalid_role' })

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true, email: true, displayName: true },
    })
    if (!target) return res.status(404).json({ error: 'not_found' })
    if (target.id === actor.id) return res.status(400).json({ error: 'cannot_change_self' })
    if (target.role === 'OWNER') return res.status(403).json({ error: 'cannot_target_owner' })

    const user = await prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT })
    await auditUser(actor, 'user.role', id, target.username, `${target.role} -> ${role}`)
    logSecurity(id, 'role_changed', req, { actor, note: `${target.role} → ${role}` })
    sendAlert(target, 'Vai trò tài khoản vừa được thay đổi', `${target.role} → ${role}`)
    return res.json(publicUser(user))
  })
)

/** OWNER: thu hồi mọi phiên của một tài khoản (đăng xuất mọi thiết bị). Tăng
 *  sessionVersion - mọi token đã phát mất hiệu lực ngay. */
app.post(
  '/api/identity/useradmin/revoke',
  asyncHandler(async (req, res) => {
    const actor = await requireOwner(req, res)
    if (!actor) return

    const id = str(req.body?.id, 60)
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    })
    if (!target) return res.status(404).json({ error: 'not_found' })
    if (target.role === 'OWNER' && target.id !== actor.id) {
      return res.status(403).json({ error: 'cannot_target_owner' })
    }

    await prisma.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } })
    await auditUser(actor, 'user.revoke_sessions', id, target.username)
    logSecurity(id, 'sessions_revoked', req, { actor })
    return res.json({ ok: true })
  })
)

/** OWNER: xoá tài khoản. Bài viết của họ còn lại (Post.authorId ON DELETE SET
 *  NULL). Nếu tài khoản có dữ liệu liên kết chặn xoá thì trả 409 thay vì nổ -
 *  owner nên thu hồi vai trò + phiên. */
app.post(
  '/api/identity/useradmin/delete',
  asyncHandler(async (req, res) => {
    const actor = await requireOwner(req, res)
    if (!actor) return

    const id = str(req.body?.id, 60)
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    })
    if (!target) return res.status(404).json({ error: 'not_found' })
    if (target.id === actor.id) return res.status(400).json({ error: 'cannot_delete_self' })
    if (target.role === 'OWNER') return res.status(403).json({ error: 'cannot_target_owner' })

    try {
      await prisma.user.delete({ where: { id } })
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2003' || code === 'P2014') {
        return res.status(409).json({ error: 'has_linked_records' })
      }
      throw e
    }
    await auditUser(actor, 'user.delete', id, target.username)
    return res.json({ ok: true })
  })
)

/** OWNER: nhật ký bảo mật xuyên tài khoản. Lọc theo `userId` nếu có, mặc định toàn bộ. */
app.post(
  '/api/identity/useradmin/security',
  asyncHandler(async (req, res) => {
    if (!(await requireOwner(req, res))) return
    const userId = str(req.body?.userId, 60)
    const rows = await prisma.securityEvent.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        ...SECURITY_EVENT_SELECT,
        userId: true,
        user: { select: { username: true, displayName: true } },
      },
    })
    return res.json(
      rows.map((e) => ({
        ...publicSecurityEvent(e),
        userId: e.userId,
        username: e.user.username,
        userDisplayName: e.user.displayName,
      }))
    )
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
