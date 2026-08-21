// Tự đăng xuất mọi thiết bị (B) + ghi sự kiện.
//
// Bất biến: revoke-all TĂNG sessionVersion (mọi token đã phát mất hiệu lực) và
// ghi SecurityEvent 'sessions_revoked'. Chưa đăng nhập ⇒ 401.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const stamp = Date.now()
const U = `test-revoke-${stamp}`

const asUser = async (sub: string, sv = 0) => ({
  Authorization: `Bearer ${await signIdentity({ sub, sv }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

let uId: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: U } })
  const u = await prisma.user.create({
    data: { username: U, email: `${U}@tsudev.local`, role: 'MEMBER' },
  })
  uId = u.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: U } })
  await prisma.$disconnect()
})

test('chưa đăng nhập ⇒ 401', async () => {
  const res = await request(app).post('/api/identity/security/revoke-all').send({})
  expect(res.status).toBe(401)
})

test('revoke-all ⇒ tăng sessionVersion + ghi sự kiện', async () => {
  const before = await prisma.user.findUnique({ where: { id: uId } })
  const res = await request(app)
    .post('/api/identity/security/revoke-all')
    .set(await asUser(U, before.sessionVersion))
    .send({})
  expect(res.status).toBe(200)
  expect(res.body.sessionVersion).toBe(before.sessionVersion + 1)

  const after = await prisma.user.findUnique({ where: { id: uId } })
  expect(after.sessionVersion).toBe(before.sessionVersion + 1)

  // Sự kiện ghi fire-and-forget - chờ ngắn.
  let ev = null
  for (let i = 0; i < 20 && !ev; i++) {
    ev = await prisma.securityEvent.findFirst({
      where: { userId: uId, type: 'sessions_revoked' },
    })
    if (!ev) await new Promise((r) => setTimeout(r, 50))
  }
  expect(ev).not.toBeNull()
})
