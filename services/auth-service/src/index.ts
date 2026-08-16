require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env — nạp thêm .env ở
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

import { checkPasswordPolicy, hashPassword, verifyPassword, burnTiming } from './password'
import { issueToken, consumeToken } from './tokens'
import { sendMail, verifyEmailHtml, resetPasswordHtml } from './mailer'
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
/** Kiểm email ở mức "có đúng một @ và hai bên không rỗng" — phần còn lại do việc gửi thư tự chứng minh. */
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

    // Tên đăng nhập bị chiếm thì PHẢI nói thẳng — người dùng cần chọn tên khác,
    // và tên đăng nhập vốn công khai trên site nên không có gì để giấu.
    const takenName = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    if (takenName) return res.status(409).json({ error: 'username_taken' })

    // Email trùng thì NGƯỢC LẠI: trả về như thể đã tạo xong. Nói "email này đã
    // đăng ký" biến form đăng ký thành công cụ dò xem ai có tài khoản ở đây.
    // Người sở hữu thật vẫn biết chuyện gì xảy ra — họ nhận được thư báo.
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
// Kiểm thông tin đăng nhập — do NextAuth authorize() gọi
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
    // ra chuyện khoá — người đang đứng đây đã chứng minh họ biết mật khẩu, nên
    // câu trả lời không tiết lộ gì cho người ngoài.
    if (accountIsLocked(user)) {
      await recordAttempt(ip, false)
      return res
        .status(423)
        .json({ error: 'account_locked', until: user.lockedUntil?.toISOString() })
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
 * URL công khai của site, dùng để dựng liên kết trong thư.
 *
 * KHÔNG có giá trị dự phòng cắm cứng. Một fallback sai ở đây nghĩa là thư đặt
 * lại mật khẩu mang liên kết trỏ vào hư không, mà lỗi đó chỉ lộ ra ở hộp thư
 * của người dùng — không log nào bắt được. Biến này do `npm run topology:gen`
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
 * hai bảng chỉ-ghi này lớn mãi — AuthToken hết hạn không còn dùng được nữa
 * nhưng vẫn là hash của thứ từng là bí mật, nên giữ lại là nợ chứ không phải
 * tài sản.
 */
export async function init(): Promise<void> {
  // Thiếu ở production = mọi liên kết trong thư đều hỏng, và hỏng ở một nơi
  // không quan sát được. Chết ồn ào lúc khởi động thay vì âm thầm lúc chạy —
  // cùng khuôn với TRUST_SIGNING_KEY của trust-service.
  if (process.env.NODE_ENV === 'production' && !siteUrl()) {
    throw new Error(
      '[auth] NEXT_PUBLIC_MAIN_URL bắt buộc ở production — liên kết trong thư dựng từ nó'
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
