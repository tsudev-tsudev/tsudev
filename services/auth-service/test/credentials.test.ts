// Bất biến của đường đăng nhập. Ba thứ được khoá lại ở đây, và cả ba đều là
// loại lỗi KHÔNG có triệu chứng nhìn thấy được nếu hỏng:
//
//  1. Không liệt kê được tài khoản — "không có user này" và "sai mật khẩu"
//     phải không phân biệt được từ bên ngoài.
//  2. Khoá tài khoản thực sự đếm và thực sự khoá.
//  3. Đăng nhập đúng thì đặt lại bộ đếm, chứ không tích luỹ tới lúc khoá oan
//     một người dùng bình thường.
process.env.NODE_ENV = 'test'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')
const { hashPassword } = require('../src/password')
const { ACCOUNT_MAX_FAILURES } = require('../src/throttle')

const USER = 'test-auth-creds'
const EMAIL = `${USER}@tsudev.local`
const PASSWORD = 'mot-mat-khau-du-dai-2026'

const login = (identifier: string, password: string, ip = '203.0.113.9') =>
  request(app)
    .post('/api/identity/verify-credentials')
    .set('x-forwarded-for', ip)
    .send({ identifier, password })

const clean = async () => {
  await prisma.user.deleteMany({ where: { username: USER } })
  await prisma.loginAttempt.deleteMany({ where: { identifier: { startsWith: '203.0.113.' } } })
}

beforeEach(async () => {
  await clean()
  await prisma.user.create({
    data: {
      username: USER,
      email: EMAIL,
      displayName: USER,
      role: 'MEMBER',
      passwordHash: await hashPassword(PASSWORD),
    },
  })
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('kiểm thông tin đăng nhập', () => {
  test('đúng mật khẩu trả về danh tính, KHÔNG kèm passwordHash', async () => {
    const res = await login(USER, PASSWORD)
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(USER)
    expect(res.body.role).toBe('MEMBER')
    expect(res.body.sessionVersion).toBe(0)
    // Cột này không được rời khỏi service, kể cả qua một lần `select` cẩu thả.
    expect(res.body.passwordHash).toBeUndefined()
  }, 20000)

  test('đăng nhập được bằng email cũng như bằng tên đăng nhập', async () => {
    expect((await login(EMAIL, PASSWORD)).status).toBe(200)
  }, 20000)

  // Đây là bất biến chống liệt kê tài khoản. Hai nhánh phải trả về CÙNG mã và
  // CÙNG thân phản hồi; khác nhau ở đâu cũng đủ để dò xem ai có tài khoản.
  test('tài khoản không tồn tại và sai mật khẩu không phân biệt được', async () => {
    const missing = await login('khong-ton-tai-o-day', PASSWORD)
    const wrong = await login(USER, 'sai-mat-khau-hoan-toan')
    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(missing.body).toEqual(wrong.body)
  }, 20000)

  test('khoá tài khoản sau đủ số lần sai liên tiếp', async () => {
    for (let i = 0; i < ACCOUNT_MAX_FAILURES; i++) {
      await login(USER, `sai-lan-thu-${i}-that-dai`)
    }
    // Tới đây mật khẩu ĐÚNG cũng không vào được nữa — và chỉ ở nhánh này service
    // mới nói ra chuyện khoá, vì người gọi đã chứng minh họ biết mật khẩu.
    const res = await login(USER, PASSWORD)
    expect(res.status).toBe(423)
    expect(res.body.error).toBe('account_locked')
  }, 60000)

  test('đăng nhập thành công đặt lại bộ đếm sai', async () => {
    for (let i = 0; i < ACCOUNT_MAX_FAILURES - 1; i++) {
      await login(USER, `sai-lan-thu-${i}-that-dai`)
    }
    expect((await login(USER, PASSWORD)).status).toBe(200)
    const after = await prisma.user.findUnique({ where: { username: USER } })
    expect(after.failedLoginCount).toBe(0)
    expect(after.lockedUntil).toBeNull()
    expect(after.lastLoginAt).not.toBeNull()
  }, 60000)
})

// Đánh dấu tệp này là MODULE. Không có import/export thì TypeScript coi nó là
// script toàn cục, và biến top-level của các tệp test khác nhau đụng tên nhau —
// `login` ở đây và `login` ở tệp kia có chữ ký khác nhau, nên CI đỏ với
// "Expected 1 arguments, but got 2" ở một tệp mà không ai vừa sửa.
export {}
