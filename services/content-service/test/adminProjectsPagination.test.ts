// `GET /api/admin/projects` sau khi áp bộ tham số phân trang chuẩn
// (DATA_TABLE.md mục 8) - QU-STD-TABLE đợt 2.
//
// Trước đợt này route lấy TOÀN BỘ dự án, không có trần nào: trần duy nhất là
// "hiện chưa nhiều dự án".
//
// Bất biến đắt nhất ở đây không phải phép cắt trang mà là PHÉP ĐẾM: `?trash=1`
// và danh sách sống là hai tập khác nhau, nên `where` của `count` phải là chính
// `where` của `findMany`. Đếm lệch không làm gì đỏ lên - nó chỉ làm dòng tóm
// tắt nói "3 / 47" trong khi bảng có 3 bản ghi.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const ADMIN = 'test-admin-projects-pagi'
const PREFIX = 'test-pagi-du-an-'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

/**
 * Xoá CỨNG bị chặn ở cấp database (trigger + `tsudev.allow_hard_delete`) - đó
 * là lớp bảo vệ thật, không phải quy ước. Dữ liệu test vẫn phải biến mất hẳn,
 * nếu không lần chạy sau đếm nhầm; nên dùng đúng cửa thoát mà chính thông báo
 * lỗi chỉ ra, trong một giao dịch.
 */
const clean = () =>
  prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Project" WHERE slug LIKE '${PREFIX}%'`),
  ])

beforeAll(async () => {
  await clean()
  await prisma.user.upsert({
    where: { username: ADMIN },
    update: { role: 'ADMIN' },
    create: {
      username: ADMIN,
      email: `${ADMIN}@tsudev.local`,
      displayName: ADMIN,
      role: 'ADMIN',
    },
  })
  // 3 dự án còn sống + 2 đã xoá mềm: đủ để phép đếm của hai tập KHÁC nhau.
  for (let i = 0; i < 3; i++) {
    await prisma.project.create({
      data: { slug: `${PREFIX}song-${i}`, name: `Sống ${i}`, summary: 'x', sortOrder: 900 + i },
    })
  }
  for (let i = 0; i < 2; i++) {
    await prisma.project.create({
      data: {
        slug: `${PREFIX}rac-${i}`,
        name: `Rác ${i}`,
        summary: 'x',
        sortOrder: 950 + i,
        deletedAt: new Date(),
      },
    })
  }
}, 30000)

afterAll(async () => {
  await clean()
  await prisma.user.deleteMany({ where: { username: ADMIN } })
  await prisma.$disconnect()
})

describe('content-service - GET /api/admin/projects phân trang', () => {
  test('trả {data, meta}, mốc mặc định 10', async () => {
    const res = await request(app)
      .get('/api/admin/projects')
      .set(await asUser(ADMIN))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.page_size).toBe(10)
    expect(res.body.meta.total_pages).toBe(Math.ceil(res.body.meta.total / 10))
  })

  test('`total` của thùng rác đếm theo ĐÚNG bộ lọc, không phải toàn bảng', async () => {
    const h = await asUser(ADMIN)
    const song = await request(app).get('/api/admin/projects?page_size=200').set(h)
    const rac = await request(app).get('/api/admin/projects?trash=1&page_size=200').set(h)

    const songThat = await prisma.project.count({ where: { deletedAt: null } })
    const racThat = await prisma.project.count({ where: { deletedAt: { not: null } } })
    expect(song.body.meta.total).toBe(songThat)
    expect(rac.body.meta.total).toBe(racThat)
    expect(rac.body.meta.total).not.toBe(song.body.meta.total)
    // Và hai tập không giao nhau.
    const slugsRac = rac.body.data.map((p: { slug: string }) => p.slug)
    const slugsSong = song.body.data.map((p: { slug: string }) => p.slug)
    expect(slugsRac.some((s: string) => slugsSong.includes(s))).toBe(false)
  })

  test('trang vượt trang cuối ⇒ mảng rỗng kèm meta đúng, KHÔNG 404', async () => {
    const res = await request(app)
      .get('/api/admin/projects?page=9999')
      .set(await asUser(ADMIN))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.page).toBe(9999)
  })

  test('MEMBER chưa đăng nhập vẫn bị chặn (401), phân trang không nới cổng nào', async () => {
    const res = await request(app).get('/api/admin/projects')
    expect(res.status).toBe(401)
  })
})

export {}
