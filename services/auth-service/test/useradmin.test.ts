// Bất biến của trang quản lý tài khoản & phân quyền (endpoint /api/identity/useradmin/*).
//
// Đây là bề mặt CẤP/THU HỒI vai trò, nên nó là một đường LEO THANG ĐẶC QUYỀN.
// Mọi thứ khoá ở đây đều là cách đường đó hỏng mà site vẫn chạy bình thường:
//
//  1. Chỉ OWNER dùng được, đọc vai trò TỪ DB. Claim role=OWNER trong khẳng định
//     danh tính KHÔNG mở được cửa (gotcha REQUIRE_ROLE_ENFORCEMENT).
//  2. OWNER KHÔNG BAO GIỜ cấp được qua endpoint - dữ liệu không quyết định được
//     bậc cao nhất, nếu không thì ai ghi được vào bảng role là tự cấp OWNER.
//  3. Không thao tác được lên tài khoản OWNER, và không tự hạ/tự xoá chính mình.
//  4. passwordHash không bao giờ ra khỏi service.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const OWNER = 'test-ua-owner'
const ADMIN = 'test-ua-admin'
const MEMBER = 'test-ua-member'
const PW = 'Matkhau-du-dai-cho-test-2026'

const asUser = async (sub: string, extra: Record<string, unknown> = {}) => ({
  Authorization: `Bearer ${await signIdentity(
    { sub, ...extra },
    process.env.INTERNAL_IDENTITY_SECRET
  )}`,
})

const post = async (action: string, sub: string | null, body: Record<string, unknown> = {}) => {
  const req = request(app).post(`/api/identity/useradmin/${action}`)
  if (sub) req.set(await asUser(sub))
  return req.send(body)
}

const roleOf = async (username: string) =>
  (await prisma.user.findUnique({ where: { username } }))?.role

const clean = async () => {
  await prisma.trustAuditLog.deleteMany({ where: { targetType: 'User' } })
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test-ua-' } } })
}

beforeEach(async () => {
  await clean()
  await Promise.all(
    (
      [
        [OWNER, 'OWNER'],
        [ADMIN, 'ADMIN'],
        [MEMBER, 'MEMBER'],
      ] as const
    ).map(([username, role]) =>
      prisma.user.create({
        data: { username, email: `${username}@tsudev.local`, displayName: username, role },
      })
    )
  )
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('cổng OWNER', () => {
  test('người chưa đăng nhập bị 401', async () => {
    expect((await post('list', null)).status).toBe(401)
  }, 20000)

  test('ADMIN (không phải OWNER) bị 403 ở MỌI thao tác', async () => {
    expect((await post('list', ADMIN)).status).toBe(403)
    expect((await post('create', ADMIN, { username: 'test-ua-x' })).status).toBe(403)
    expect((await post('role', ADMIN, { id: 'x', role: 'ADMIN' })).status).toBe(403)
    expect((await post('revoke', ADMIN, { id: 'x' })).status).toBe(403)
    expect((await post('delete', ADMIN, { id: 'x' })).status).toBe(403)
  }, 20000)

  // Cùng một mặt với mã mời: claim role=OWNER trong khẳng định danh tính không
  // qua được, vì vai trò đọc từ DB nơi tài khoản này là MEMBER.
  test('claim role=OWNER giả mạo không mở được cửa', async () => {
    const forged = await signIdentity(
      { sub: MEMBER, role: 'OWNER' },
      process.env.INTERNAL_IDENTITY_SECRET
    )
    const res = await request(app)
      .post('/api/identity/useradmin/list')
      .set({ Authorization: `Bearer ${forged}` })
      .send({})
    expect(res.status).toBe(403)
  }, 20000)
})

describe('liệt kê & tạo', () => {
  test('OWNER liệt kê được, và KHÔNG bao giờ lộ passwordHash', async () => {
    const res = await post('list', OWNER)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const row of res.body) expect(row.passwordHash).toBeUndefined()
  }, 20000)

  test('OWNER tạo tài khoản AUTHOR, email đặt sẵn xác minh, không lộ passwordHash', async () => {
    const res = await post('create', OWNER, {
      username: 'test-ua-new',
      email: 'test-ua-new@tsudev.com',
      displayName: 'Tác giả mới',
      password: PW,
      role: 'AUTHOR',
    })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('AUTHOR')
    expect(res.body.emailVerified).toBe(true)
    expect(res.body.passwordHash).toBeUndefined()
    expect(await roleOf('test-ua-new')).toBe('AUTHOR')
  }, 20000)

  // Bất biến quan trọng nhất của tệp: OWNER không cấp được qua dữ liệu.
  test('KHÔNG tạo được tài khoản OWNER dù thân request khai role=OWNER', async () => {
    const res = await post('create', OWNER, {
      username: 'test-ua-evil',
      email: 'test-ua-evil@tsudev.com',
      password: PW,
      role: 'OWNER',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_role')
    expect(await prisma.user.findUnique({ where: { username: 'test-ua-evil' } })).toBeNull()
  }, 20000)

  test('tên/email trùng bị 409', async () => {
    const dup = { email: 'x@tsudev.com', password: PW, role: 'MEMBER' }
    expect((await post('create', OWNER, { ...dup, username: OWNER })).body.error).toBe(
      'username_taken'
    )
    expect(
      (
        await post('create', OWNER, {
          ...dup,
          username: 'test-ua-ok',
          email: `${OWNER}@tsudev.local`,
        })
      ).body.error
    ).toBe('email_taken')
  }, 20000)
})

describe('phân quyền, thu hồi, xoá', () => {
  test('OWNER đổi vai trò MEMBER lên ADMIN', async () => {
    const id = (await prisma.user.findUnique({ where: { username: MEMBER } }))!.id
    const res = await post('role', OWNER, { id, role: 'ADMIN' })
    expect(res.status).toBe(200)
    expect(await roleOf(MEMBER)).toBe('ADMIN')
  }, 20000)

  test('KHÔNG cấp được OWNER qua đổi vai trò', async () => {
    const id = (await prisma.user.findUnique({ where: { username: MEMBER } }))!.id
    expect((await post('role', OWNER, { id, role: 'OWNER' })).body.error).toBe('invalid_role')
    expect(await roleOf(MEMBER)).toBe('MEMBER')
  }, 20000)

  test('OWNER không tự đổi vai trò mình, không đụng OWNER khác', async () => {
    const ownerId = (await prisma.user.findUnique({ where: { username: OWNER } }))!.id
    const self = await post('role', OWNER, { id: ownerId, role: 'ADMIN' })
    expect(self.status).toBe(400)
    expect(self.body.error).toBe('cannot_change_self')
    expect(await roleOf(OWNER)).toBe('OWNER')
  }, 20000)

  test('thu hồi phiên tăng sessionVersion', async () => {
    const before = (await prisma.user.findUnique({ where: { username: MEMBER } }))!
    const res = await post('revoke', OWNER, { id: before.id })
    expect(res.status).toBe(200)
    const after = (await prisma.user.findUnique({ where: { username: MEMBER } }))!
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
  }, 20000)

  test('xoá được MEMBER, nhưng KHÔNG xoá được chính mình hay OWNER khác', async () => {
    const ownerId = (await prisma.user.findUnique({ where: { username: OWNER } }))!.id
    const memberId = (await prisma.user.findUnique({ where: { username: MEMBER } }))!.id
    const owner2 = await prisma.user.create({
      data: {
        username: 'test-ua-owner2',
        email: 'test-ua-owner2@tsudev.local',
        displayName: 'Owner 2',
        role: 'OWNER',
      },
    })

    // Tự xoá: chặn ở tầng self (bắn trước tầng owner).
    expect((await post('delete', OWNER, { id: ownerId })).body.error).toBe('cannot_delete_self')
    // Xoá OWNER khác: chặn ở tầng owner.
    expect((await post('delete', OWNER, { id: owner2.id })).body.error).toBe('cannot_target_owner')
    expect(await roleOf('test-ua-owner2')).toBe('OWNER')

    const res = await post('delete', OWNER, { id: memberId })
    expect(res.status).toBe(200)
    expect(await prisma.user.findUnique({ where: { username: MEMBER } })).toBeNull()
  }, 20000)
})
