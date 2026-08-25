// Nhật ký bảo mật (SecurityEvent).
//
// Bất biến:
//   (1) Sự kiện được GHI ở các điểm nhạy cảm (đăng nhập, đổi mật khẩu...), kèm IP.
//   (2) `security/events` chỉ trả sự kiện của CHÍNH mình - không lộ của người khác.
//   (3) `useradmin/security` (OWNER) xem xuyên tài khoản; người thường ⇒ 403.
//   (4) Hành động admin lên user (đổi vai trò) ghi vào timeline của TARGET, đánh
//       dấu byAdmin.
//
// logSecurity là FIRE-AND-FORGET (ghi log không được làm hỏng thao tác), nên test
// dùng `waitFor` chờ bản ghi hiện ra thay vì đọc ngay - đọc ngay là cách test này
// chớp tắt.
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
const U1 = `test-sl-u1-${stamp}`
const U2 = `test-sl-u2-${stamp}`
const OWN = `test-sl-owner-${stamp}`
const USERS = [U1, U2, OWN]
const PW = 'mat-khau-du-dai-cho-test-2026'
const NEW_PW = 'mat-khau-moi-du-dai-2026'

const asUser = async (sub: string, sv = 0) => ({
  Authorization: `Bearer ${await signIdentity({ sub, sv }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const authPost = async (path: string, sub: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post(`/api/identity/${path}`)
    .set(await asUser(sub))
    .send(body)

const login = (identifier: string) =>
  request(app).post('/api/identity/verify-credentials').send({ identifier, password: PW })

/** Chờ điều kiện đúng, tối đa ~1s - cho bản ghi fire-and-forget kịp hiện. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitFor(fn: () => Promise<any>, ok: (v: any) => boolean): Promise<any> {
  for (let i = 0; i < 20; i++) {
    const v = await fn()
    if (ok(v)) return v
    await new Promise((r) => setTimeout(r, 50))
  }
  return fn()
}

let u1Id: string
let u2Id: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  const pwHash = await hashPassword(PW)
  const [a, b] = await Promise.all([
    prisma.user.create({
      data: { username: U1, email: `${U1}@tsudev.local`, role: 'AUTHOR', passwordHash: pwHash },
    }),
    prisma.user.create({
      data: { username: U2, email: `${U2}@tsudev.local`, role: 'MEMBER', passwordHash: pwHash },
    }),
    prisma.user.create({
      data: { username: OWN, email: `${OWN}@tsudev.local`, role: 'OWNER', passwordHash: pwHash },
    }),
  ])
  u1Id = a.id
  u2Id = b.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  await prisma.$disconnect()
})

describe('ghi sự kiện', () => {
  test('đăng nhập ⇒ SecurityEvent type=login kèm IP', async () => {
    const res = await login(U1)
    expect(res.status).toBe(200)
    const ev = await waitFor(
      () =>
        prisma.securityEvent.findFirst({
          where: { userId: u1Id, type: 'login' },
          orderBy: { createdAt: 'desc' },
        }),
      (e: unknown) => e != null
    )
    expect(ev).not.toBeNull()
    expect(ev.ip).toBeTruthy()
  })
})

describe('phạm vi đọc', () => {
  test('security/events chỉ trả sự kiện của chính mình', async () => {
    await login(U2)
    await waitFor(
      () => prisma.securityEvent.findFirst({ where: { userId: u2Id, type: 'login' } }),
      (e: unknown) => e != null
    )
    // Hình dạng `{data, meta}` chuẩn (DATA_TABLE.md 8.2), mốc mặc định 10.
    const res = await authPost('security/events', U1, { page_size: 200 })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    // Không có trường userId ở bề mặt own; kiểm gián tiếp: mọi mục là của U1 bằng
    // cách đối chiếu tổng số với DB.
    const mine = await prisma.securityEvent.count({ where: { userId: u1Id } })
    expect(res.body.meta.total).toBe(mine)
    expect(res.body.data.length).toBe(Math.min(mine, 200))
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  test('security/events: mốc mặc định là 10 và meta khớp trang đang xem', async () => {
    const res = await authPost('security/events', U1)
    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.page_size).toBe(10)
    // `total_pages` tối thiểu 1 - bảng rỗng vẫn là "trang 1 / 1".
    expect(res.body.meta.total_pages).toBeGreaterThanOrEqual(1)
    expect(res.body.data.length).toBeLessThanOrEqual(10)
  })

  test('security/events: trang vượt trang cuối trả mảng rỗng kèm meta đúng, KHÔNG 404', async () => {
    const res = await authPost('security/events', U1, { page: 9999, page_size: 10 })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.page).toBe(9999)
    expect(res.body.meta.total).toBeGreaterThan(0)
  })

  test('useradmin/security: OWNER xem xuyên tài khoản, có cột tài khoản', async () => {
    const res = await authPost('useradmin/security', OWN, { page_size: 200 })
    expect(res.status).toBe(200)
    const usernames = new Set(res.body.data.map((e: { username: string }) => e.username))
    expect(usernames.has(U1)).toBe(true)
    expect(usernames.has(U2)).toBe(true)
  })

  test('useradmin/security: lọc theo userId thì `total` đếm theo ĐÚNG bộ lọc', async () => {
    const res = await authPost('useradmin/security', OWN, { userId: u1Id, page_size: 200 })
    expect(res.status).toBe(200)
    const mine = await prisma.securityEvent.count({ where: { userId: u1Id } })
    // Đếm bằng `where` khác với truy vấn là cách dòng tóm tắt nói "12 / 4.000".
    expect(res.body.meta.total).toBe(mine)
    expect(res.body.data.every((e: { userId: string }) => e.userId === u1Id)).toBe(true)
  })

  test('useradmin/security: người thường ⇒ 403', async () => {
    const res = await authPost('useradmin/security', U1)
    expect(res.status).toBe(403)
  })
})

describe('hành động admin ghi vào timeline target', () => {
  test('OWNER đổi vai trò U2 ⇒ U2 có role_changed byAdmin', async () => {
    const res = await authPost('useradmin/role', OWN, { id: u2Id, role: 'VIP' })
    expect(res.status).toBe(200)
    const ev = await waitFor(
      () =>
        prisma.securityEvent.findFirst({
          where: { userId: u2Id, type: 'role_changed' },
          orderBy: { createdAt: 'desc' },
        }),
      (e: unknown) => e != null
    )
    expect(ev).not.toBeNull()
    expect(ev.actorId).toBeTruthy() // do admin thực hiện
    expect(ev.actorName).toBeTruthy()
  })
})

// CUỐI CÙNG: đổi mật khẩu tăng sessionVersion của U1 ⇒ mọi token sv=0 của U1 sau
// đó thành 401. Đặt ở đây để không đá các test đọc phía trên (dùng chung sv=0).
describe('đổi mật khẩu ghi sự kiện (chạy cuối vì đá phiên U1)', () => {
  test('đổi mật khẩu ⇒ type=password_change', async () => {
    const res = await authPost('password/change', U1, {
      currentPassword: PW,
      newPassword: NEW_PW,
    })
    expect(res.status).toBe(200)
    const ev = await waitFor(
      () => prisma.securityEvent.findFirst({ where: { userId: u1Id, type: 'password_change' } }),
      (e: unknown) => e != null
    )
    expect(ev).not.toBeNull()
  })
})
