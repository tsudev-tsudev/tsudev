// Bất biến của trang hồ sơ - §1.7 đợt A.
//
// Hai đường ghi mới, và mỗi cái có một cách hỏng riêng mà site vẫn chạy bình
// thường:
//
//  1. `profile/update` chỉ được chạm ĐÚNG hai cột. Một route "sửa hồ sơ" nhận
//     nguyên `req.body` là đường tự cấp ADMIN bằng một dòng JSON - và không có
//     gì báo lỗi, vì thao tác vẫn trả 200.
//  2. `password/change` phải ĐÒI mật khẩu hiện tại. Không có phép kiểm đó thì
//     một cookie phiên bị đánh cắp là mất hẳn tài khoản: kẻ chiếm đổi mật khẩu
//     xong là chính chủ không vào lại được.
//  3. Đổi mật khẩu phải TĂNG `sessionVersion`. Thiếu bước này thì phiên của kẻ
//     chiếm vẫn sống sau khi chính chủ đã đổi mật khẩu - tức là đổi mật khẩu
//     không lấy lại được gì.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')
const { hashPassword, verifyPassword } = require('../src/password')

const USER = 'test-profile-user'
const PASSKEY_ONLY = 'test-profile-passkey'
const USERS = [USER, PASSKEY_ONLY]

const OLD_PW = 'mat-khau-cu-du-dai-2026'
const NEW_PW = 'mat-khau-moi-du-dai-2026'

/** Khẳng định danh tính như BFF sẽ ký, kèm sessionVersion để không bị coi là phiên cũ. */
const asUser = async (sub: string, sv = 0) => ({
  Authorization: `Bearer ${await signIdentity({ sub, sv }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const post = async (path: string, sub: string, body: Record<string, unknown> = {}, sv = 0) =>
  request(app)
    .post(`/api/identity/${path}`)
    .set(await asUser(sub, sv))
    .send(body)

const clean = () => prisma.user.deleteMany({ where: { username: { in: USERS } } })

beforeEach(async () => {
  await clean()
  await prisma.user.create({
    data: {
      username: USER,
      email: `${USER}@tsudev.local`,
      displayName: 'Tên cũ',
      role: 'MEMBER',
      passwordHash: await hashPassword(OLD_PW),
    },
  })
  await prisma.user.create({
    data: {
      username: PASSKEY_ONLY,
      email: `${PASSKEY_ONLY}@tsudev.local`,
      role: 'MEMBER',
    },
  })
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const read = (username: string) => prisma.user.findUnique({ where: { username } })

describe('hồ sơ - đọc và sửa', () => {
  test('profile/get trả hồ sơ và KHÔNG trả passwordHash', async () => {
    const res = await post('profile/get', USER)
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(USER)
    expect(res.body.displayName).toBe('Tên cũ')
    expect(res.body.hasPassword).toBe(true)
    // Cột này không bao giờ được ra khỏi tầng service, kể cả dưới tên khác.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
    expect(JSON.stringify(res.body)).not.toContain('$argon2')
  })

  test('sửa được tên hiển thị và tiểu sử', async () => {
    const res = await post('profile/update', USER, { displayName: 'Tên mới', bio: 'Xin chào' })
    expect(res.status).toBe(200)
    const row = await read(USER)
    expect(row.displayName).toBe('Tên mới')
    expect(row.bio).toBe('Xin chào')
  })

  test('chuỗi rỗng lưu thành NULL, không phải chuỗi rỗng', async () => {
    // authorCard của content-service rơi về `username` khi displayName là NULL.
    // Lưu '' thì nó hiển thị một khoảng trắng dưới bài viết - một trạng thái
    // người dùng không gõ lại được lần thứ hai để sửa.
    await post('profile/update', USER, { displayName: '   ', bio: '' })
    const row = await read(USER)
    expect(row.displayName).toBeNull()
    expect(row.bio).toBeNull()
  })

  test('KHÔNG nâng được vai trò qua route sửa hồ sơ', async () => {
    const res = await post('profile/update', USER, { displayName: 'X', role: 'ADMIN' })
    expect(res.status).toBe(200)
    expect((await read(USER)).role).toBe('MEMBER')
  })

  test('KHÔNG đổi được username hay email qua route sửa hồ sơ', async () => {
    await post('profile/update', USER, {
      displayName: 'X',
      username: 'ke-chiem',
      email: 'ke-chiem@example.com',
    })
    const row = await read(USER)
    expect(row.username).toBe(USER)
    expect(row.email).toBe(`${USER}@tsudev.local`)
  })

  test('chưa đăng nhập ⇒ 401, không phải 404', async () => {
    const res = await request(app).post('/api/identity/profile/update').send({ displayName: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('đổi mật khẩu', () => {
  test('đúng mật khẩu hiện tại ⇒ đổi được và sessionVersion TĂNG', async () => {
    const before = await read(USER)
    const res = await post('password/change', USER, {
      currentPassword: OLD_PW,
      newPassword: NEW_PW,
    })
    expect(res.status).toBe(200)

    const after = await read(USER)
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
    // Số mới phải được trả về, nếu không client không gọi update() được và
    // chính người vừa đổi mật khẩu bị đăng xuất ngay.
    expect(res.body.sessionVersion).toBe(after.sessionVersion)
    expect(await verifyPassword(after.passwordHash, NEW_PW)).toBe(true)
  })

  test('SAI mật khẩu hiện tại ⇒ 401 và mật khẩu KHÔNG đổi', async () => {
    const res = await post('password/change', USER, {
      currentPassword: 'sai-hoan-toan-nhung-du-dai',
      newPassword: NEW_PW,
    })
    expect(res.status).toBe(401)
    const row = await read(USER)
    expect(await verifyPassword(row.passwordHash, OLD_PW)).toBe(true)
    expect(row.sessionVersion).toBe(0)
  })

  test('mật khẩu mới yếu bị từ chối, và mật khẩu cũ vẫn nguyên', async () => {
    const res = await post('password/change', USER, {
      currentPassword: OLD_PW,
      newPassword: 'ngan',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('weak_password')
    expect(await verifyPassword((await read(USER)).passwordHash, OLD_PW)).toBe(true)
  })

  test('tài khoản chưa từng đặt mật khẩu ⇒ 409 nói rõ, không phải 401 mơ hồ', async () => {
    // Trả 401 ở đây khiến người dùng thử đi thử lại một thứ không bao giờ đúng -
    // đúng kiểu bế tắc đã tốn cả một phiên để chẩn đoán (HANDOFF §0.5).
    const res = await post('password/change', PASSKEY_ONLY, {
      currentPassword: 'bat-ky-thu-gi-du-dai',
      newPassword: NEW_PW,
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('no_password_set')
  })

  test('phiên mang sessionVersion CŨ bị từ chối sau khi đã đổi mật khẩu', async () => {
    await post('password/change', USER, { currentPassword: OLD_PW, newPassword: NEW_PW })
    // Đây chính là điều làm cho việc đổi mật khẩu LẤY LẠI được tài khoản: phiên
    // của kẻ chiếm vẫn là một cookie next-auth hợp lệ, nhưng sv của nó đã cũ.
    const res = await post('profile/update', USER, { displayName: 'Kẻ chiếm' }, 0)
    expect(res.status).toBe(401)
    expect((await read(USER)).displayName).toBe('Tên cũ')
  })
})
