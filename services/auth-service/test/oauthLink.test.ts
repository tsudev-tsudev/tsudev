// Liên kết đăng nhập OAuth (E) - oauth/upsert.
//
// Bất biến:
//   (1) Khoá liên kết là (provider, providerAccountId): gọi lại cùng cặp ⇒ ĐÚNG
//       một user (idempotent), không tạo trùng.
//   (2) Tài khoản mới: role MEMBER; emailVerifiedAt đặt nếu emailVerified=true;
//       username sinh tự động hợp lệ + duy nhất.
//   (3) Email đã thuộc user khác (chưa liên kết) ⇒ 409 email_taken (không tự gộp).
//   (4) Không có email hợp lệ ⇒ 409 oauth_no_email.
//   (5) provider lạ ⇒ 400.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')

const stamp = Date.now()
const GH_ID = `gh-${stamp}`
const GOO_ID = `goo-${stamp}`
const NEW_EMAIL = `oauth-new-${stamp}@example.com`
const EXISTING_EMAIL = `oauth-existing-${stamp}@example.com`
const EXISTING_USER = `oauth-existing-user-${stamp}`

const upsert = (body: Record<string, unknown>) =>
  request(app).post('/api/identity/oauth/upsert').send(body)

const createdUsernames: string[] = []

beforeAll(async () => {
  await prisma.user.create({
    data: { username: EXISTING_USER, email: EXISTING_EMAIL, role: 'MEMBER' },
  })
})

afterAll(async () => {
  // Xoá user OAuth đã tạo (OAuthAccount cascade theo user).
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: NEW_EMAIL }, { email: EXISTING_EMAIL }, { username: { in: createdUsernames } }],
    },
  })
  await prisma.$disconnect()
})

test('provider lạ ⇒ 400', async () => {
  const res = await upsert({ provider: 'facebook', providerAccountId: 'x', email: NEW_EMAIL })
  expect(res.status).toBe(400)
})

test('không email ⇒ 409 oauth_no_email', async () => {
  const res = await upsert({ provider: 'github', providerAccountId: GH_ID })
  expect(res.status).toBe(409)
  expect(res.body.error).toBe('oauth_no_email')
})

test('email đã thuộc user khác + CHƯA xác minh ⇒ 409 email_taken', async () => {
  const res = await upsert({
    provider: 'google',
    providerAccountId: `${GOO_ID}-unverified`,
    email: EXISTING_EMAIL,
    emailVerified: false,
  })
  expect(res.status).toBe(409)
  expect(res.body.error).toBe('email_taken')
})

test('email đã thuộc user + ĐÃ xác minh ⇒ TỰ LIÊN KẾT vào user đó (không tạo mới)', async () => {
  const owner = await prisma.user.findUnique({ where: { email: EXISTING_EMAIL } })
  const res = await upsert({
    provider: 'google',
    providerAccountId: `${GOO_ID}-link`,
    email: EXISTING_EMAIL,
    emailVerified: true,
  })
  expect(res.status).toBe(200)
  expect(res.body.id).toBe(owner.id) // đúng user sẵn có, không phải user mới
  const link = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider: 'google', providerAccountId: `${GOO_ID}-link` },
    },
  })
  expect(link.userId).toBe(owner.id)
})

test('tài khoản mới ⇒ tạo MEMBER, CHƯA xác minh, username sinh ra', async () => {
  const res = await upsert({
    provider: 'github',
    providerAccountId: GH_ID,
    email: NEW_EMAIL,
    name: 'Người Dùng Mới',
    emailVerified: true,
  })
  expect(res.status).toBe(200)
  expect(res.body.role).toBe('MEMBER')
  expect(res.body.email).toBe(NEW_EMAIL)
  expect(typeof res.body.username).toBe('string')
  expect(res.body.username.length).toBeGreaterThanOrEqual(2)
  createdUsernames.push(res.body.username)

  const row = await prisma.user.findUnique({ where: { id: res.body.id } })
  // ⚠️ ĐỔI 26/08/2026, và đây là điểm chính của cả đợt: KHÔNG còn tin cờ
  // `emailVerified` của bên thứ ba. Cờ đó nói nhà cung cấp tin địa chỉ đó, nó
  // KHÔNG nói người vừa đăng nhập đọc được hộp thư đó ngay bây giờ - mà "đọc
  // được ngay bây giờ" mới là thứ mọi đường khôi phục tài khoản dựa vào.
  // Người dùng tự bấm "Xác minh tài khoản" ở /settings/profile và gõ mã.
  //
  // Không phải hàng rào chặn: `emailUsable()` cho ân hạn 7 ngày kể từ lúc tạo
  // tài khoản, nên người mới đăng nhập vẫn dùng được site ngay.
  expect(row.emailVerifiedAt).toBeNull()
  const link = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: 'github', providerAccountId: GH_ID } },
  })
  expect(link.userId).toBe(res.body.id)
})

test('gọi lại cùng (provider, id) ⇒ đúng một user (idempotent)', async () => {
  const first = await upsert({ provider: 'github', providerAccountId: GH_ID, email: NEW_EMAIL })
  const second = await upsert({ provider: 'github', providerAccountId: GH_ID, email: NEW_EMAIL })
  expect(first.body.id).toBe(second.body.id)
  const count = await prisma.oAuthAccount.count({
    where: { provider: 'github', providerAccountId: GH_ID },
  })
  expect(count).toBe(1)
})
