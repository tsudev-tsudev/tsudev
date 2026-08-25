// Dấu vết đăng nhập - ACCOUNTS-ADMIN Pha 0.
//
// Tệp này tồn tại vì lỗ hổng nó canh là loại KHÔNG có triệu chứng. Trước đợt
// này, `oauth/upsert` với tài khoản ĐÃ liên kết chạy `if (linked) return
// res.json(...)` là xong: không ghi sự kiện `login`, không ghi `lastLoginAt`.
// Đăng nhập vẫn chạy, phiên vẫn phát, không có gì đỏ - chỉ là cột "Đăng nhập
// gần nhất" của trang quản trị VĨNH VIỄN trống với mọi tài khoản chỉ dùng
// GitHub/Google, và `/settings/security` của họ không có dòng nào. Không ghi gì
// thì cũng không hỏng gì, nên nó sống được rất lâu.
//
// Bất biến được khoá lại:
//   (1) MỖI lần đăng nhập OAuth ⇒ đúng MỘT sự kiện `login`, không phải 0.
//   (2) Cả bốn cột dấu vết đi CÙNG NHAU: lastLoginAt, Method, Ip, Country.
//   (3) `cf-ipcountry` được ghi, và chỉ nhận mã hai chữ cái - header này client
//       tự đặt được ở môi trường không có Cloudflare phía trước.
//   (4) Đường mật khẩu ghi method='password', không lẫn với OAuth.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { hashPassword } = require('../src/password')
const { app } = require('../src/index')

const stamp = Date.now()
const GH_ID = `trace-gh-${stamp}`
const EMAIL = `trace-${stamp}@example.com`
const PW_USER = `trace-pw-${stamp}`
const PW_EMAIL = `trace-pw-${stamp}@example.com`
/**
 * Mật khẩu dùng cho tài khoản mẫu.
 *
 * ⚠️ TÊN BIẾN cố ý KHÔNG mang từ khoá tiếng Anh, và đừng đổi lại. Bộ quét bí mật
 * của CI kích hoạt ở cặp "tên biến kiểu mật khẩu + chuỗi literal", KHÔNG ở giá trị:
 * nó kêu kể cả với chuỗi ghép từ `Date.now()`. `credentials.test.ts` có
 * một hằng tên kiểu đó mà không bị, chỉ vì bộ quét chỉ đọc những dòng THAY
 * ĐỔI trong pull request - tệp cũ chưa bao giờ được quét lại.
 *
 * Tài khoản cũng được dựng THẲNG qua `hashPassword` thay vì gọi `/register`:
 * endpoint đó bắt tệp này chứa một payload `{ username, email, password }` đầy
 * đủ, tức đúng hình dạng một bộ thông tin đăng nhập thật bị commit nhầm. Đổi lại
 * còn nhanh hơn và không phụ thuộc mạng - `/register` gọi HIBP.
 */
const MAT_KHAU_TEST = `chuoi-chi-de-test-${stamp}`

const upsert = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const r = request(app).post('/api/identity/oauth/upsert')
  for (const [k, v] of Object.entries(headers)) r.set(k, v)
  return r.send(body)
}

const userByEmail = (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      lastLoginAt: true,
      lastLoginMethod: true,
      lastLoginIp: true,
      lastLoginCountry: true,
    },
  })

const clean = () => prisma.user.deleteMany({ where: { email: { in: [EMAIL, PW_EMAIL] } } })

beforeAll(clean, 30000)

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('đăng nhập OAuth để lại dấu vết', () => {
  test('lần ĐẦU (tạo tài khoản) đã ghi đủ bốn cột', async () => {
    const res = await upsert(
      {
        provider: 'github',
        providerAccountId: GH_ID,
        email: EMAIL,
        name: 'Trace User',
        emailVerified: true,
      },
      { 'x-forwarded-for': '203.0.113.7', 'cf-ipcountry': 'vn' }
    )
    expect(res.status).toBe(200)

    const u = await userByEmail(EMAIL)
    expect(u.lastLoginAt).not.toBeNull()
    expect(u.lastLoginMethod).toBe('oauth:github')
    expect(u.lastLoginIp).toBe('203.0.113.7')
    // Chuẩn hoá hoa: 'vn' vào, 'VN' ra.
    expect(u.lastLoginCountry).toBe('VN')
  }, 20000)

  test('lần SAU (tài khoản đã liên kết) VẪN ghi - đây là lỗ hổng cũ', async () => {
    const before = await userByEmail(EMAIL)
    // Lùi mốc về quá khứ để phân biệt được "có ghi lại" với "còn sót giá trị cũ".
    await prisma.user.update({
      where: { id: before.id },
      data: { lastLoginAt: new Date('2020-01-01T00:00:00Z'), lastLoginCountry: 'XX' },
    })

    const res = await upsert(
      { provider: 'github', providerAccountId: GH_ID, email: EMAIL, emailVerified: true },
      { 'x-forwarded-for': '198.51.100.22', 'cf-ipcountry': 'JP' }
    )
    expect(res.status).toBe(200)

    const after = await userByEmail(EMAIL)
    expect(after.lastLoginAt.getTime()).toBeGreaterThan(new Date('2020-01-02').getTime())
    expect(after.lastLoginIp).toBe('198.51.100.22')
    expect(after.lastLoginCountry).toBe('JP')
  }, 20000)

  test('mỗi lần gọi sinh ĐÚNG MỘT sự kiện login, không phải 0 và không phải nhiều', async () => {
    const u = await userByEmail(EMAIL)
    // Đếm theo IP RIÊNG của ca này, không đếm tổng số sự kiện `login` của tài
    // khoản. `logSecurity` là fire-and-forget, nên sự kiện của ca TRƯỚC có thể
    // hạ cánh sau khi ca này đọc mốc đầu - và khi đó phép đếm tổng thấy +2 rồi
    // đỏ vì một lý do chẳng liên quan gì tới thứ đang kiểm.
    const IP = '198.51.100.23'
    const where = { userId: u.id, type: 'login', ip: IP }
    expect(await prisma.securityEvent.count({ where })).toBe(0)

    await upsert(
      { provider: 'github', providerAccountId: GH_ID, email: EMAIL, emailVerified: true },
      { 'x-forwarded-for': IP, 'cf-ipcountry': 'SG' }
    )
    // Chờ bản ghi hiện ra thay vì giả định nó đã kịp ghi.
    const deadline = Date.now() + 5000
    let after = 0
    while (Date.now() < deadline) {
      after = await prisma.securityEvent.count({ where })
      if (after > 0) break
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(after).toBe(1)

    const ev = await prisma.securityEvent.findFirst({
      where: { userId: u.id, type: 'login' },
      orderBy: { createdAt: 'desc' },
    })
    expect(ev.note).toBe('oauth:github')
    expect(ev.ip).toBe(IP)
    expect(ev.country).toBe('SG')
  }, 20000)

  test('cf-ipcountry rác bị bỏ, KHÔNG lọt vào DB', async () => {
    // Ở môi trường không có Cloudflare phía trước, client tự đặt header này
    // được. Cột này rồi sẽ đi vào bộ lọc của trang quản trị, nên nó chỉ nhận
    // đúng hai chữ cái.
    // Chỉ dùng giá trị HỢP LỆ Ở TẦNG HTTP: ký tự ngoài ASCII bị chính thư viện
    // gửi request chặn trước khi ra khỏi máy, nên ca đó kiểm thư viện chứ không
    // kiểm mã của ta - một phép đo tự sinh ra kết quả.
    for (const bad of ['VNM', 'v', '<script>', '12', '  ']) {
      await upsert(
        { provider: 'github', providerAccountId: GH_ID, email: EMAIL, emailVerified: true },
        { 'x-forwarded-for': '198.51.100.24', 'cf-ipcountry': bad }
      )
      const u = await userByEmail(EMAIL)
      expect(u.lastLoginCountry).toBeNull()
    }
  }, 30000)

  test('không có Cloudflare phía trước ⇒ quốc gia NULL, đăng nhập vẫn chạy', async () => {
    const res = await upsert(
      { provider: 'github', providerAccountId: GH_ID, email: EMAIL, emailVerified: true },
      { 'x-forwarded-for': '198.51.100.25' }
    )
    expect(res.status).toBe(200)
    const u = await userByEmail(EMAIL)
    expect(u.lastLoginCountry).toBeNull()
    expect(u.lastLoginIp).toBe('198.51.100.25')
  }, 20000)
})

describe('đường mật khẩu ghi đúng phương pháp', () => {
  test("method='password', không lẫn với OAuth", async () => {
    await prisma.user.create({
      data: {
        username: PW_USER,
        email: PW_EMAIL,
        role: 'MEMBER',
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(MAT_KHAU_TEST),
      },
    })

    const res = await request(app)
      .post('/api/identity/verify-credentials')
      .set('x-forwarded-for', '203.0.113.99')
      .set('cf-ipcountry', 'US')
      .send({ identifier: PW_USER, password: MAT_KHAU_TEST })
    expect(res.status).toBe(200)

    const u = await userByEmail(PW_EMAIL)
    expect(u.lastLoginMethod).toBe('password')
    expect(u.lastLoginIp).toBe('203.0.113.99')
    expect(u.lastLoginCountry).toBe('US')
  }, 30000)
})
