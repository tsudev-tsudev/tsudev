// Bất biến của mã mời vào Con dấu tín nhiệm.
//
// Mã mời là một đường LEO THANG ĐẶC QUYỀN: đổi mã đúng thì `User.role` được ghi
// lại. Mọi thứ khoá ở đây đều là cách đường đó hỏng mà site vẫn chạy bình thường:
//
//  1. Trần cứng ở VIP. Dữ liệu KHÔNG được quyết định bậc vai trò - nếu nó quyết
//     định được thì ai ghi được vào bảng mã mời là tự cấp được ADMIN.
//  2. Không hạ vai trò. ADMIN đổi mã vẫn là ADMIN.
//  3. Lượt dùng đếm ĐÚNG. Đổi hai lần không cộng thêm lượt, vượt maxUses bị
//     chặn - đọc-rồi-ghi sẽ cho hai người cùng tiêu lượt cuối cùng.
//  4. Mã hết hạn / đã thu hồi bị từ chối, và bị từ chối GIỐNG HỆT mã không tồn
//     tại: phân biệt chúng biến ô nhập mã thành công cụ dò.
//  5. Cấp/liệt kê/thu hồi là việc của ADMIN, và `codeHash` không bao giờ ra
//     khỏi service.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')
const { hashInviteCode, normalizeInviteCode } = require('../src/invite')

const ADMIN = 'test-invite-admin'
const MEMBER = 'test-invite-member'
const OTHER = 'test-invite-other'
const BOSS = 'test-invite-boss'
const OWNER = 'test-invite-owner'
const USERS = [ADMIN, MEMBER, OTHER, BOSS, OWNER]

const IP = '203.0.113.77'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const post = async (path: string, sub: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post(`/api/identity/invite/${path}`)
    .set(await asUser(sub))
    .set('x-forwarded-for', IP)
    .send(body)

/** Cấp mã trực tiếp qua DB - tách phần dựng dữ liệu khỏi phần đang kiểm. */
const seedInvite = async (code: string, over: Record<string, unknown> = {}) =>
  prisma.trustInvite.create({
    data: {
      codeHash: hashInviteCode(normalizeInviteCode(code)),
      label: 'Mã test',
      maxUses: 1,
      createdById: adminId,
      ...over,
    },
  })

let adminId: string

const clean = async () => {
  await prisma.trustInviteRedemption.deleteMany({ where: { user: { username: { in: USERS } } } })
  await prisma.trustInvite.deleteMany({ where: { label: { startsWith: 'Mã test' } } })
  await prisma.trustAuditLog.deleteMany({ where: { targetType: 'TrustInvite' } })
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  await prisma.loginAttempt.deleteMany({ where: { identifier: IP } })
}

beforeEach(async () => {
  await clean()
  const rows = await Promise.all(
    (
      [
        [ADMIN, 'ADMIN'],
        [MEMBER, 'MEMBER'],
        [OTHER, 'MEMBER'],
        [BOSS, 'ADMIN'],
        [OWNER, 'OWNER'],
      ] as const
    ).map(([username, role]) =>
      prisma.user.create({
        data: { username, email: `${username}@tsudev.local`, displayName: username, role },
      })
    )
  )
  adminId = rows[0].id
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const roleOf = async (username: string) =>
  (await prisma.user.findUnique({ where: { username } }))!.role

describe('đổi mã mời', () => {
  test('mã hợp lệ nâng MEMBER lên đúng VIP', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC')
    const res = await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('VIP')
    expect(await roleOf(MEMBER)).toBe('VIP')
  }, 20000)

  test('chấp nhận mã gõ không gạch, chữ thường', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC')
    expect((await post('redeem', MEMBER, { code: 'tsuaaaaabbbbbccccc' })).status).toBe(200)
  }, 20000)

  // Bất biến quan trọng nhất của tệp này. Trần vai trò nằm trong MÃ, nên không
  // đầu vào nào - thân request hay claim trong khẳng định danh tính - nâng được
  // quá VIP. Claim `role` CHỈ ĐỂ THAM KHẢO; xem gotcha REQUIRE_ROLE_ENFORCEMENT.
  test('mã mời KHÔNG BAO GIỜ nâng quá VIP, kể cả khi đầu vào cố tình khai ADMIN', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC', { label: 'Mã test leo thang', maxUses: 5 })
    const forged = await signIdentity(
      { sub: MEMBER, role: 'ADMIN' },
      process.env.INTERNAL_IDENTITY_SECRET
    )
    const res = await request(app)
      .post('/api/identity/invite/redeem')
      .set({ Authorization: `Bearer ${forged}` })
      .set('x-forwarded-for', IP)
      .send({ code: 'TSU-AAAAA-BBBBB-CCCCC', role: 'ADMIN', grantsRole: 'ADMIN' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('VIP')
    expect(await roleOf(MEMBER)).toBe('VIP')
  }, 20000)

  // Cùng một mặt: claim ADMIN trong khẳng định danh tính không mở được đường
  // CẤP mã. Vai trò đọc từ DB, nơi tài khoản này là MEMBER.
  test('claim role=ADMIN không cho phép cấp mã', async () => {
    const forged = await signIdentity(
      { sub: MEMBER, role: 'ADMIN' },
      process.env.INTERNAL_IDENTITY_SECRET
    )
    const res = await request(app)
      .post('/api/identity/invite/create')
      .set({ Authorization: `Bearer ${forged}` })
      .send({ label: 'Mã test lén qua claim' })
    expect(res.status).toBe(403)
  }, 20000)

  test('KHÔNG hạ vai trò: ADMIN đổi mã vẫn là ADMIN', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC')
    const res = await post('redeem', BOSS, { code: 'TSU-AAAAA-BBBBB-CCCCC' })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('ADMIN')
    expect(await roleOf(BOSS)).toBe('ADMIN')
  }, 20000)

  test('đổi hai lần KHÔNG cộng thêm lượt', async () => {
    const inv = await seedInvite('TSU-AAAAA-BBBBB-CCCCC', { maxUses: 2 })
    expect((await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })).status).toBe(200)
    expect((await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })).status).toBe(200)
    const after = await prisma.trustInvite.findUnique({ where: { id: inv.id } })
    expect(after.usedCount).toBe(1)
  }, 20000)

  test('vượt maxUses bị từ chối', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC', { maxUses: 1 })
    expect((await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })).status).toBe(200)
    const res = await post('redeem', OTHER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('invite_exhausted')
    expect(await roleOf(OTHER)).toBe('MEMBER')
  }, 20000)

  test('mã hết hạn bị từ chối', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC', { expiresAt: new Date(Date.now() - 1000) })
    const res = await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })
    expect(res.status).toBe(400)
    expect(await roleOf(MEMBER)).toBe('MEMBER')
  }, 20000)

  test('mã đã thu hồi bị từ chối', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC', { revokedAt: new Date() })
    expect((await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })).status).toBe(400)
    expect(await roleOf(MEMBER)).toBe('MEMBER')
  }, 20000)

  // Chống dò: ba trường hợp "mã không dùng được" phải không phân biệt được.
  test('mã không tồn tại, hết hạn và đã thu hồi trả về GIỐNG HỆT nhau', async () => {
    await seedInvite('TSU-BBBBB-BBBBB-BBBBB', { expiresAt: new Date(Date.now() - 1000) })
    await seedInvite('TSU-CCCCC-CCCCC-CCCCC', { revokedAt: new Date() })
    const missing = await post('redeem', MEMBER, { code: 'TSU-DDDDD-DDDDD-DDDDD' })
    const expired = await post('redeem', MEMBER, { code: 'TSU-BBBBB-BBBBB-BBBBB' })
    const revoked = await post('redeem', MEMBER, { code: 'TSU-CCCCC-CCCCC-CCCCC' })
    expect(missing.status).toBe(400)
    expect(expired.status).toBe(missing.status)
    expect(revoked.status).toBe(missing.status)
    expect(expired.body).toEqual(missing.body)
    expect(revoked.body).toEqual(missing.body)
  }, 20000)

  test('mã sai hình dạng bị từ chối như mã sai', async () => {
    expect((await post('redeem', MEMBER, { code: 'khong-phai-ma' })).status).toBe(400)
    expect((await post('redeem', MEMBER, { code: '' })).status).toBe(400)
  }, 20000)

  test('ghi TrustAuditLog cho mỗi lần đổi thành công', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC')
    await post('redeem', MEMBER, { code: 'TSU-AAAAA-BBBBB-CCCCC' })
    const rows = await prisma.trustAuditLog.findMany({ where: { action: 'invite.redeem' } })
    expect(rows).toHaveLength(1)
  }, 20000)

  test('chưa đăng nhập thì 401, không phải 400', async () => {
    await seedInvite('TSU-AAAAA-BBBBB-CCCCC')
    const res = await request(app)
      .post('/api/identity/invite/redeem')
      .send({ code: 'TSU-AAAAA-BBBBB-CCCCC' })
    expect(res.status).toBe(401)
  }, 20000)
})

describe('quản lý mã mời', () => {
  test('ADMIN cấp được mã, và mã thô chỉ trả về ở đúng lần đó', async () => {
    const res = await post('create', ADMIN, { label: 'Mã test đối tác', maxUses: 5 })
    expect(res.status).toBe(200)
    expect(res.body.code).toMatch(/^TSU(-[A-Z2-7]{5}){3}$/)
    expect(res.body.invite.codeHash).toBeUndefined()

    // Mã vừa cấp phải đổi được - chứng minh cái được băm và cái được in ra khớp.
    expect((await post('redeem', MEMBER, { code: res.body.code })).status).toBe(200)

    const list = await post('list', ADMIN)
    expect(list.body[0].codeHash).toBeUndefined()
    expect(list.body[0].label).toBe('Mã test đối tác')
    expect(list.body[0].grantsRole).toBe('VIP')
  }, 20000)

  // Regression: OWNER (bậc TRÊN ADMIN) phải kế thừa quyền admin. requireAdmin
  // từng so `=== 'ADMIN'` bằng đúng nên nâng tsudev lên OWNER là khoá luôn công
  // cụ mã mời của chính chủ dự án.
  test('OWNER (trên ADMIN) cũng cấp và liệt kê được mã', async () => {
    expect((await post('create', OWNER, { label: 'Mã test owner' })).status).toBe(200)
    expect((await post('list', OWNER)).status).toBe(200)
  }, 20000)

  test('MEMBER không cấp, không liệt kê, không thu hồi được', async () => {
    expect((await post('create', MEMBER, { label: 'Mã test lén' })).status).toBe(403)
    expect((await post('list', MEMBER)).status).toBe(403)
    expect((await post('revoke', MEMBER, { id: 'bat-ky' })).status).toBe(403)
  }, 20000)

  test('thu hồi làm mã hết dùng được, và thu hồi hai lần trả 404', async () => {
    const created = await post('create', ADMIN, { label: 'Mã test thu hồi' })
    const id = created.body.invite.id
    expect((await post('revoke', ADMIN, { id })).status).toBe(200)
    expect((await post('revoke', ADMIN, { id })).status).toBe(404)
    expect((await post('redeem', MEMBER, { code: created.body.code })).status).toBe(400)
  }, 20000)

  test('nhãn rỗng bị từ chối - nhãn là thứ duy nhất người vận hành nhận ra mã', async () => {
    expect((await post('create', ADMIN, { label: '   ' })).status).toBe(400)
  }, 20000)
})
