// Vòng đời tài khoản tự phục vụ (D): vô hiệu hoá + hẹn xoá + khôi phục qua đăng nhập.
//
// Bất biến:
//   (1) deactivate/delete ĐÒI mật khẩu; sai ⇒ 401.
//   (2) deactivate: set deactivatedAt + tăng sessionVersion. Đăng nhập lại ⇒ khôi
//       phục (deactivatedAt về null).
//   (3) delete: set deletionScheduledAt ~30 ngày + vô hiệu hoá. Đăng nhập trong
//       hạn ⇒ huỷ hẹn (cả hai mốc null). Quá hạn ⇒ purge + login 401.
//   (4) OWNER không tự xoá được (403).
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')
const { hashPassword } = require('../src/password')

const stamp = Date.now()
const U = `test-life-${stamp}`
const U_DEL = `test-life-del-${stamp}`
const U_EXP = `test-life-exp-${stamp}`
const OWN = `test-life-owner-${stamp}`
const USERS = [U, U_DEL, U_EXP, OWN]
const PW = 'mat-khau-du-dai-cho-test-2026'
const WRONG_PW = 'mat-khau-sai-du-dai-2026'

const asUser = async (sub: string, sv = 0) => ({
  Authorization: `Bearer ${await signIdentity({ sub, sv }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})
const authPost = async (path: string, sub: string, body: Record<string, unknown> = {}, sv = 0) =>
  request(app)
    .post(`/api/identity/${path}`)
    .set(await asUser(sub, sv))
    .send(body)
const login = (identifier: string) =>
  request(app).post('/api/identity/verify-credentials').send({ identifier, password: PW })

const mk = (username: string, role = 'MEMBER', extra: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: { username, email: `${username}@tsudev.local`, role, ...extra },
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  const pwHash = await hashPassword(PW)
  await Promise.all([
    mk(U, 'MEMBER', { passwordHash: pwHash }),
    mk(U_DEL, 'MEMBER', { passwordHash: pwHash }),
    mk(U_EXP, 'MEMBER', {
      passwordHash: pwHash,
      deactivatedAt: new Date(),
      // Hẹn xoá đã QUÁ hạn (quá khứ) ⇒ đăng nhập sẽ purge.
      deletionScheduledAt: new Date(Date.now() - 1000),
    }),
    mk(OWN, 'OWNER', { passwordHash: pwHash }),
  ])
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  await prisma.$disconnect()
})

describe('vô hiệu hoá', () => {
  test('sai mật khẩu ⇒ 401', async () => {
    const res = await authPost('account/deactivate', U, { password: WRONG_PW })
    expect(res.status).toBe(401)
  })

  test('đúng mật khẩu ⇒ set deactivatedAt + tăng sessionVersion; đăng nhập lại khôi phục', async () => {
    const before = await prisma.user.findUnique({ where: { username: U } })
    const res = await authPost('account/deactivate', U, { password: PW }, before.sessionVersion)
    expect(res.status).toBe(200)
    const after = await prisma.user.findUnique({ where: { username: U } })
    expect(after.deactivatedAt).not.toBeNull()
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)

    // Đăng nhập lại ⇒ khôi phục.
    const li = await login(U)
    expect(li.status).toBe(200)
    const react = await prisma.user.findUnique({ where: { username: U } })
    expect(react.deactivatedAt).toBeNull()
  })
})

describe('hẹn xoá', () => {
  test('trong hạn: set deletionScheduledAt; đăng nhập huỷ hẹn', async () => {
    const res = await authPost('account/delete', U_DEL, { password: PW })
    expect(res.status).toBe(200)
    const sched = await prisma.user.findUnique({ where: { username: U_DEL } })
    expect(sched.deletionScheduledAt).not.toBeNull()
    expect(sched.deactivatedAt).not.toBeNull()

    const li = await login(U_DEL)
    expect(li.status).toBe(200)
    const cancelled = await prisma.user.findUnique({ where: { username: U_DEL } })
    expect(cancelled.deletionScheduledAt).toBeNull()
    expect(cancelled.deactivatedAt).toBeNull()
  })

  test('quá hạn: đăng nhập ⇒ purge tài khoản + 401', async () => {
    const li = await login(U_EXP)
    expect(li.status).toBe(401)
    const gone = await prisma.user.findUnique({ where: { username: U_EXP } })
    expect(gone).toBeNull()
  })

  test('OWNER không tự xoá được ⇒ 403', async () => {
    const res = await authPost('account/delete', OWN, { password: PW })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('owner_cannot_self_delete')
  })
})
