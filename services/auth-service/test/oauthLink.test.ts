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

test('email đã thuộc user khác ⇒ 409 email_taken', async () => {
  const res = await upsert({
    provider: 'google',
    providerAccountId: `${GOO_ID}-collision`,
    email: EXISTING_EMAIL,
    emailVerified: true,
  })
  expect(res.status).toBe(409)
  expect(res.body.error).toBe('email_taken')
})

test('tài khoản mới ⇒ tạo MEMBER, email verified, username sinh ra', async () => {
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
  expect(row.emailVerifiedAt).not.toBeNull()
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
