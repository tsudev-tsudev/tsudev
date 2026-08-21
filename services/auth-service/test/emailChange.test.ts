// Xác minh email đợt bổ sung: gửi lại xác minh, đổi email hai bước, và cổng ân
// hạn chặn nâng vai trò.
//
// Bất biến khoá ở đây:
//   (1) Gửi lại xác minh: no-op nếu đã xác minh; chống dội thư bằng cooldown 60s.
//   (2) Đổi email ĐÒI mật khẩu hiện tại - cookie phiên bị đánh cắp không đủ.
//   (3) "Xác minh trước, thay sau": email chỉ đổi khi tiêu token EMAIL_CHANGE;
//       yêu cầu đổi CHỈ phát token + gửi thư tới địa chỉ mới.
//   (4) Xác nhận đổi ⇒ email mới + emailVerifiedAt + TĂNG sessionVersion (đá phiên).
//   (5) Địa chỉ đã có chủ: yêu cầu đổi trả về GIỐNG NHAU (chống dò), KHÔNG phát
//       token; xác nhận vào địa chỉ bị chiếm giữa chừng ⇒ 409, email không đổi.
//   (6) Cổng ân hạn: chưa xác minh + quá hạn ⇒ invite/redeem trả 403 trước cả
//       khi xét mã.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')
const { hashPassword } = require('../src/password')
const { issueToken } = require('../src/tokens')

const stamp = Date.now()
const U_VERIFIED = `test-ec-verified-${stamp}`
const U_UNVERIFIED = `test-ec-unverified-${stamp}`
const U_EXPIRED = `test-ec-expired-${stamp}`
const U_OTHER = `test-ec-other-${stamp}`
const USERS = [U_VERIFIED, U_UNVERIFIED, U_EXPIRED, U_OTHER]

const PW = 'mat-khau-du-dai-cho-test-2026'
const WRONG_PW = 'mat-khau-sai-du-dai-2026'
const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

const asUser = async (sub: string, sv = 0) => ({
  Authorization: `Bearer ${await signIdentity({ sub, sv }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const authPost = async (path: string, sub: string, body: Record<string, unknown> = {}, sv = 0) =>
  request(app)
    .post(`/api/identity/${path}`)
    .set(await asUser(sub, sv))
    .send(body)

let verifiedId: string
let unverifiedId: string
let otherEmail: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  const pwHash = await hashPassword(PW)
  const [v, u, , o] = await Promise.all([
    prisma.user.create({
      data: {
        username: U_VERIFIED,
        email: `${U_VERIFIED}@tsudev.local`,
        role: 'AUTHOR',
        passwordHash: pwHash,
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        username: U_UNVERIFIED,
        email: `${U_UNVERIFIED}@tsudev.local`,
        role: 'AUTHOR',
        passwordHash: pwHash,
      },
    }),
    prisma.user.create({
      data: {
        username: U_EXPIRED,
        email: `${U_EXPIRED}@tsudev.local`,
        role: 'MEMBER',
        passwordHash: pwHash,
        createdAt: EIGHT_DAYS_AGO,
      },
    }),
    prisma.user.create({
      data: {
        username: U_OTHER,
        email: `${U_OTHER}@tsudev.local`,
        role: 'MEMBER',
        passwordHash: pwHash,
      },
    }),
  ])
  verifiedId = v.id
  unverifiedId = u.id
  otherEmail = o.email
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  await prisma.$disconnect()
})

describe('gửi lại email xác minh', () => {
  test('đã xác minh ⇒ ok, alreadyVerified', async () => {
    const res = await authPost('verify/resend', U_VERIFIED)
    expect(res.status).toBe(200)
    expect(res.body.alreadyVerified).toBe(true)
  })

  test('chưa xác minh ⇒ phát token, lần hai trong 60s ⇒ 429', async () => {
    const first = await authPost('verify/resend', U_UNVERIFIED)
    expect(first.status).toBe(200)
    const token = await prisma.authToken.findFirst({
      where: { userId: unverifiedId, purpose: 'EMAIL_VERIFY', usedAt: null },
    })
    expect(token).not.toBeNull()

    const second = await authPost('verify/resend', U_UNVERIFIED)
    expect(second.status).toBe(429)
    expect(second.body.error).toBe('too_soon')
  })
})

describe('đổi email: yêu cầu', () => {
  test('sai mật khẩu ⇒ 401', async () => {
    const res = await authPost('email/change', U_VERIFIED, {
      newEmail: `moi-${stamp}@tsudev.local`,
      password: WRONG_PW,
    })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_credentials')
  })

  test('email không hợp lệ ⇒ 400', async () => {
    const res = await authPost('email/change', U_VERIFIED, {
      newEmail: 'khong-phai-email',
      password: PW,
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_email')
  })

  test('trùng email hiện tại ⇒ 400', async () => {
    const res = await authPost('email/change', U_VERIFIED, {
      newEmail: `${U_VERIFIED}@tsudev.local`,
      password: PW,
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('same_email')
  })

  test('hợp lệ ⇒ phát token EMAIL_CHANGE mang địa chỉ mới, email CHƯA đổi', async () => {
    const newEmail = `doi-thanh-${stamp}@tsudev.local`
    const res = await authPost('email/change', U_VERIFIED, { newEmail, password: PW })
    expect(res.status).toBe(200)
    const token = await prisma.authToken.findFirst({
      where: { userId: verifiedId, purpose: 'EMAIL_CHANGE', usedAt: null },
    })
    expect(token?.newEmail).toBe(newEmail)
    const still = await prisma.user.findUnique({ where: { id: verifiedId } })
    expect(still.email).toBe(`${U_VERIFIED}@tsudev.local`) // chưa đổi
  })

  test('địa chỉ đã có chủ ⇒ ok (chống dò), KHÔNG phát token', async () => {
    const before = await prisma.authToken.count({
      where: { userId: unverifiedId, purpose: 'EMAIL_CHANGE' },
    })
    const res = await authPost('email/change', U_UNVERIFIED, { newEmail: otherEmail, password: PW })
    expect(res.status).toBe(200)
    const after = await prisma.authToken.count({
      where: { userId: unverifiedId, purpose: 'EMAIL_CHANGE' },
    })
    expect(after).toBe(before) // không có token nào được phát
  })
})

describe('đổi email: xác nhận', () => {
  test('token hợp lệ ⇒ đổi email + xác minh + tăng sessionVersion', async () => {
    const newEmail = `xac-nhan-${stamp}@tsudev.local`
    const { raw } = await issueToken(unverifiedId, 'EMAIL_CHANGE', newEmail)
    const before = await prisma.user.findUnique({ where: { id: unverifiedId } })

    const res = await request(app).post('/api/identity/confirm-email-change').send({ token: raw })
    expect(res.status).toBe(200)

    const after = await prisma.user.findUnique({ where: { id: unverifiedId } })
    expect(after.email).toBe(newEmail)
    expect(after.emailVerifiedAt).not.toBeNull()
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
  })

  test('token rác ⇒ 400', async () => {
    const res = await request(app)
      .post('/api/identity/confirm-email-change')
      .send({ token: 'khong-ton-tai' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_token')
  })

  test('địa chỉ bị chiếm giữa chừng ⇒ 409, email không đổi', async () => {
    const { raw } = await issueToken(verifiedId, 'EMAIL_CHANGE', otherEmail)
    const before = await prisma.user.findUnique({ where: { id: verifiedId } })
    const res = await request(app).post('/api/identity/confirm-email-change').send({ token: raw })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('email_taken')
    const after = await prisma.user.findUnique({ where: { id: verifiedId } })
    expect(after.email).toBe(before.email) // không đổi
  })
})

describe('cổng ân hạn chặn nâng vai trò', () => {
  test('chưa xác minh + quá ân hạn ⇒ invite/redeem 403 email_unverified', async () => {
    // Gác chạy TRƯỚC khi xét mã, nên mã bất kỳ cũng cho 403 (không phải 400 invalid).
    const res = await authPost('invite/redeem', U_EXPIRED, { code: 'TSU-AAAAA-AAAAA-AAAAA' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('email_unverified')
  })
})
