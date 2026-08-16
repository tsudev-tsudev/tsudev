// Bất biến của bước hai. Thứ được khoá lại ở đây là những chỗ 2FA hay bị cài
// sai theo cách vẫn "chạy được":
//
//  1. Bí mật đã tạo nhưng CHƯA xác nhận không được coi là đã bật — nếu không,
//     người quét mã QR rồi bỏ dở sẽ tự khoá mình ra khỏi tài khoản.
//  2. Mật khẩu đúng + thiếu mã ⇒ KHÔNG được coi là đăng nhập thành công.
//  3. Mã dự phòng dùng được ĐÚNG MỘT LẦN.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.TOTP_ENCRYPTION_KEY = 'khoa-ma-hoa-totp-du-dai-cho-test-0123456789'
delete process.env.INTERNAL_API_TOKEN

const { createHash } = require('crypto')
const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')
const { hashPassword } = require('../src/password')
const { encryptSecret, generateSecret, generateBackupCodes } = require('../src/totp')

const USER = 'test-2fa-user'
const PASSWORD = 'mot-mat-khau-du-dai-2026'
const SECRET = generateSecret()

let userId: string

const login = (body: Record<string, unknown>) =>
  request(app)
    .post('/api/identity/verify-credentials')
    .set('x-forwarded-for', '203.0.113.44')
    .send({ identifier: USER, password: PASSWORD, ...body })

/** Mã TOTP đúng cho thời điểm hiện tại, tính từ chính bí mật đã lưu. */
const currentCode = () => {
  const { verifyTotp } = require('../src/totp')
  for (let i = 0; i < 1_000_000; i++) {
    const c = String(i).padStart(6, '0')
    if (verifyTotp(SECRET, c)) return c
  }
  throw new Error('không dò được mã')
}

const clean = async () => {
  await prisma.user.deleteMany({ where: { username: USER } })
  await prisma.loginAttempt.deleteMany({ where: { identifier: '203.0.113.44' } })
}

beforeEach(async () => {
  await clean()
  const u = await prisma.user.create({
    data: {
      username: USER,
      email: `${USER}@tsudev.local`,
      displayName: USER,
      role: 'MEMBER',
      passwordHash: await hashPassword(PASSWORD),
    },
  })
  userId = u.id
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('bước hai TOTP', () => {
  test('bí mật CHƯA xác nhận không chặn đăng nhập', async () => {
    await prisma.totpCredential.create({
      data: { userId, secretEnc: encryptSecret(SECRET), confirmedAt: null },
    })
    const res = await login({})
    expect(res.status).toBe(200)
  }, 30000)

  test('đã xác nhận thì thiếu mã ⇒ 401 totp_required, KHÔNG phải đăng nhập thành công', async () => {
    await prisma.totpCredential.create({
      data: { userId, secretEnc: encryptSecret(SECRET), confirmedAt: new Date() },
    })
    const res = await login({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('totp_required')
    // Không được ghi nhận là đăng nhập thành công: lastLoginAt phải còn trống.
    const after = await prisma.user.findUnique({ where: { id: userId } })
    expect(after.lastLoginAt).toBeNull()
  }, 30000)

  test('mã đúng ⇒ vào được', async () => {
    await prisma.totpCredential.create({
      data: { userId, secretEnc: encryptSecret(SECRET), confirmedAt: new Date() },
    })
    const res = await login({ totp: currentCode() })
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(USER)
  }, 30000)

  test('mã sai ⇒ 401 và tính vào bộ đếm khoá tài khoản', async () => {
    await prisma.totpCredential.create({
      data: { userId, secretEnc: encryptSecret(SECRET), confirmedAt: new Date() },
    })
    const res = await login({ totp: '000000' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('totp_invalid')
    const after = await prisma.user.findUnique({ where: { id: userId } })
    expect(after.failedLoginCount).toBe(1)
  }, 30000)
})

describe('mã dự phòng', () => {
  test('dùng được một lần, lần thứ hai bị từ chối', async () => {
    const codes = generateBackupCodes(3)
    await prisma.totpCredential.create({
      data: { userId, secretEnc: encryptSecret(SECRET), confirmedAt: new Date() },
    })
    await prisma.backupCode.createMany({
      data: codes.map((c: string) => ({
        userId,
        codeHash: createHash('sha256').update(c).digest('hex'),
      })),
    })

    const first = await login({ totp: codes[0] })
    expect(first.status).toBe(200)

    const second = await login({ totp: codes[0] })
    expect(second.status).toBe(401)
    expect(second.body.error).toBe('totp_invalid')

    // Mã còn lại vẫn dùng được — dùng một mã không được làm hỏng các mã kia.
    const third = await login({ totp: codes[1] })
    expect(third.status).toBe(200)
  }, 60000)
})
