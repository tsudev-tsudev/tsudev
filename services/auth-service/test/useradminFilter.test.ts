// Bộ lọc của bảng quản trị tài khoản - ACCOUNTS-ADMIN Pha 1.
//
// Ba bất biến ở đây đều hỏng IM LẶNG nếu sai, tức là vẫn trả về một danh sách
// trông hợp lý:
//
//  (1) `count` và `findMany` phải dùng CÙNG một điều kiện. Lệch nhau thì dòng
//      tóm tắt nói "3 / 128" trong khi bảng có 3 hàng và bộ phân trang dựng ra
//      13 trang rỗng. (Bản đầu của chính đợt này đã quên `where` ở `findMany`.)
//  (2) Lọc theo phương pháp đăng nhập là lọc theo NĂNG LỰC, không theo
//      `lastLoginMethod`. Lọc nhầm cột thì "tài khoản GitHub" bỏ sót đúng những
//      người có GitHub nhưng lần cuối vào bằng mật khẩu.
//  (3) `passwordHash` KHÔNG BAO GIỜ ra khỏi service, kể cả khi bộ lọc cần đọc nó.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const stamp = Date.now()
const OWNER = `flt-owner-${stamp}`
const PW_ONLY = `flt-pw-${stamp}`
const GH_ONLY = `flt-gh-${stamp}`
const BOTH = `flt-both-${stamp}`
const ALL = [OWNER, PW_ONLY, GH_ONLY, BOTH]

// Dữ liệu mẫu CỐ Ý không mang tiền tố `$argon2id$` của hash thật: bộ quét bí mật
// nhận ra tiền tố đó và báo động. Khẳng định chống rò bên dưới vẫn kiểm tiền tố
// THẬT - thứ cần canh là hash thật không lọt ra, không phải chuỗi giả này.
const HASH_GIA_LAP = 'khong-phai-hash-that-chi-de-danh-dau-co-mat-khau'

const asOwner = async () => ({
  Authorization: `Bearer ${await signIdentity(
    { sub: OWNER },
    process.env.INTERNAL_IDENTITY_SECRET
  )}`,
})

// Mốc 50 chứ không phải 200: từ 100 trở lên, `largePageRateLimit` chỉ cho 10
// yêu cầu mỗi phút mỗi tài khoản, và một tệp test lọc nhiều lần sẽ tự đâm vào
// đó rồi trông y hệt "bộ lọc hỏng". Trần đó được kiểm riêng ở ca cuối.
const list = async (body: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/identity/useradmin/list')
    .set(await asOwner())
    .send({ page_size: 50, ...body })

const usernames = (res: { body: { data: Array<{ username: string }> } }) =>
  res.body.data.map((u) => u.username)

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: ALL } } })
  await prisma.user.create({
    data: { username: OWNER, email: `${OWNER}@tsudev.local`, role: 'OWNER' },
  })
  // Chỉ mật khẩu, đã đăng nhập từ Việt Nam.
  await prisma.user.create({
    data: {
      username: PW_ONLY,
      email: `${PW_ONLY}@tsudev.local`,
      role: 'MEMBER',
      passwordHash: HASH_GIA_LAP,
      lastLoginAt: new Date('2026-08-01T00:00:00Z'),
      lastLoginMethod: 'password',
      lastLoginIp: '203.0.113.10',
      lastLoginCountry: 'VN',
    },
  })
  // Chỉ GitHub, chưa xác minh email.
  await prisma.user.create({
    data: {
      username: GH_ONLY,
      email: `${GH_ONLY}@tsudev.local`,
      role: 'AUTHOR',
      lastLoginAt: new Date('2026-08-20T00:00:00Z'),
      lastLoginMethod: 'oauth:github',
      lastLoginIp: '198.51.100.5',
      lastLoginCountry: 'JP',
      oauthAccounts: { create: { provider: 'github', providerAccountId: `gh-${stamp}` } },
    },
  })
  // CÓ GitHub nhưng lần cuối vào bằng MẬT KHẨU - đây là hàng phân biệt được
  // "lọc theo năng lực" với "lọc theo lần đăng nhập cuối".
  await prisma.user.create({
    data: {
      username: BOTH,
      email: `${BOTH}@tsudev.local`,
      role: 'MEMBER',
      passwordHash: HASH_GIA_LAP,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date('2026-08-25T00:00:00Z'),
      lastLoginMethod: 'password',
      lastLoginIp: '203.0.113.11',
      lastLoginCountry: 'VN',
      oauthAccounts: { create: { provider: 'github', providerAccountId: `gh2-${stamp}` } },
    },
  })
}, 60000)

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: ALL } } })
  await prisma.$disconnect()
})

describe('lọc bảng tài khoản', () => {
  test('không lọc: meta.total khớp SỐ HÀNG thật, không phải tổng bảng', async () => {
    const res = await list({ page_size: 10, page: 1 })
    expect(res.status).toBe(200)
    const real = await prisma.user.count()
    expect(res.body.meta.total).toBe(real)
    expect(res.body.total_unfiltered).toBe(real)
  }, 20000)

  test('lọc rồi thì count và findMany dùng CÙNG điều kiện', async () => {
    // Bất biến (1). Lấy mốc nhỏ để trang 1 không chứa hết kết quả - lệch `where`
    // giữa hai truy vấn chỉ lộ ra khi phân trang thật sự cắt.
    const res = await list({ q: `flt-`, page_size: 10, page: 1 })
    const expected = await prisma.user.count({
      where: {
        OR: [
          { username: { contains: 'flt-', mode: 'insensitive' } },
          { email: { contains: 'flt-', mode: 'insensitive' } },
          { displayName: { contains: 'flt-', mode: 'insensitive' } },
        ],
      },
    })
    expect(res.body.meta.total).toBe(expected)
    expect(res.body.data.length).toBeLessThanOrEqual(10)
    // `total_unfiltered` phải LỚN HƠN, nếu không dòng "lọc từ N" vô nghĩa.
    expect(res.body.total_unfiltered).toBeGreaterThanOrEqual(res.body.meta.total)
  }, 20000)

  test('lọc theo nền tảng lấy CẢ người lần cuối vào bằng mật khẩu', async () => {
    // Bất biến (2) - hàng BOTH có GitHub nhưng lastLoginMethod='password'.
    const res = await list({ q: `flt-`, loginMethods: ['github'] })
    const got = usernames(res)
    expect(got).toContain(GH_ONLY)
    expect(got).toContain(BOTH)
    expect(got).not.toContain(PW_ONLY)
  }, 20000)

  test('lọc theo mật khẩu và theo GitHub là hai tập khác nhau', async () => {
    const pw = usernames(await list({ q: `flt-`, loginMethods: ['password'] }))
    expect(pw).toContain(PW_ONLY)
    expect(pw).toContain(BOTH)
    expect(pw).not.toContain(GH_ONLY)
  }, 20000)

  test('lọc theo quốc gia và theo tiền tố IP', async () => {
    expect(usernames(await list({ q: `flt-`, country: ['vn'] })).sort()).toEqual(
      [BOTH, PW_ONLY].sort()
    )
    // Tiền tố: gõ cả dải mạng con cũng phải khớp.
    expect(usernames(await list({ q: `flt-`, ip: '203.0.113.' })).sort()).toEqual(
      [BOTH, PW_ONLY].sort()
    )
    expect(usernames(await list({ q: `flt-`, ip: '198.51.100.5' }))).toEqual([GH_ONLY])
  }, 20000)

  test('lọc theo vai trò và theo khoảng thời gian đăng nhập', async () => {
    expect(usernames(await list({ q: `flt-`, role: ['AUTHOR'] }))).toEqual([GH_ONLY])
    const recent = usernames(await list({ q: `flt-`, lastLoginFrom: '2026-08-15T00:00:00Z' }))
    expect(recent).toContain(GH_ONLY)
    expect(recent).toContain(BOTH)
    expect(recent).not.toContain(PW_ONLY)
  }, 20000)

  test('lọc theo trạng thái chưa xác minh email', async () => {
    const got = usernames(await list({ q: `flt-`, status: ['unverified'] }))
    expect(got).toContain(GH_ONLY)
    expect(got).not.toContain(BOTH)
  }, 20000)

  test('giá trị lọc lạ bị BỎ QUA, không làm hỏng cả yêu cầu', async () => {
    // Một tham số hiển thị sai không đáng làm hỏng cả trang - cùng nguyên tắc
    // với `normalizePageSize`.
    const res = await list({ q: `flt-`, role: ['KHONG_TON_TAI'], status: ['bay-bong'] })
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  }, 20000)

  test('facet đếm TRÊN bộ lọc hiện tại, không phải trên toàn bảng', async () => {
    const res = await list({ q: `flt-` })
    const roleFacet = Object.fromEntries(
      res.body.facets.role.map((r: { value: string; count: number }) => [r.value, r.count])
    )
    expect(roleFacet.MEMBER).toBe(2)
    expect(roleFacet.AUTHOR).toBe(1)
    const countryFacet = Object.fromEntries(
      res.body.facets.country.map((r: { value: string; count: number }) => [r.value, r.count])
    )
    expect(countryFacet.VN).toBe(2)
    expect(countryFacet.JP).toBe(1)
  }, 20000)

  test('mốc lớn vẫn chịu giới hạn tần suất, kể cả với OWNER', async () => {
    // Nâng trần lên 200 đi kèm cái giá của nó (DATA_TABLE.md 8.4), và cái giá đó
    // KHÔNG được miễn cho quản trị viên - đây chính là tài khoản có thể kéo cả
    // bảng người dùng về trong một vòng lặp.
    const big = async () =>
      request(app)
        .post('/api/identity/useradmin/list')
        .set(await asOwner())
        .send({ page_size: 200 })
    let blocked = false
    for (let i = 0; i < 14 && !blocked; i++) {
      const r = await big()
      if (r.status === 429) blocked = true
    }
    expect(blocked).toBe(true)
  }, 30000)

  test('KHÔNG rò passwordHash dù bộ lọc phải đọc nó', async () => {
    // Bất biến (3). `passwordHash` nằm trong USER_SELECT để suy ra năng lực
    // đăng nhập - đúng loại thay đổi làm cột bí mật lọt ra ngoài.
    const res = await list({ q: `flt-` })
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('passwordHash')
    expect(raw).not.toContain(HASH_GIA_LAP)
    // Tiền tố của hash Argon2id THẬT - khẳng định này mới là cái đáng giá.
    expect(raw).not.toContain('$argon2id$')
    // Nhưng năng lực thì phải có, nếu không giao diện không dựng được cột.
    const both = res.body.data.find((u: { username: string }) => u.username === BOTH)
    expect(both.loginMethods.sort()).toEqual(['github', 'password'])
  }, 20000)
})
