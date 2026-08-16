// Ranh giới đọc/ghi của content-service.
//
// Bản trước kiểm rằng GET /api/posts đòi vai trò `content:read`. Đó chính là
// thứ khiến REQUIRE_ROLE_ENFORCEMENT không bao giờ bật được: bật lên là blog
// biến mất khỏi site. Cổng đó đã được gỡ — bài viết là nội dung công khai.
//
// Bất biến cần khoá lại nay là: ĐỌC mở, GHI đóng.
process.env.AUTH_DEV_BYPASS = 'true'
// Không phụ thuộc thứ tự file test: cổng chặn internal-token phải tắt ở đây.
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')

const MEMBER = 'test-member-content'

beforeAll(async () => {
  await prisma.user.upsert({
    where: { username: MEMBER },
    update: { role: 'MEMBER' },
    create: {
      username: MEMBER,
      email: `${MEMBER}@tsudev.local`,
      displayName: MEMBER,
      role: 'MEMBER',
    },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: MEMBER } })
  await prisma.$disconnect()
})

describe('content-service: đọc công khai, ghi cần quản trị', () => {
  test('GET /api/posts mở cho người chưa đăng nhập', async () => {
    const res = await request(app).get('/api/posts')
    expect(res.status).toBe(200)
  })

  test('GET /api/posts không đòi vai trò nào kể cả khi đã đăng nhập', async () => {
    const res = await request(app).get('/api/posts').set('x-dev-user', MEMBER)
    expect(res.status).toBe(200)
  })

  test('MEMBER không tạo được dự án — đường ghi đòi ADMIN', async () => {
    const res = await request(app)
      .post('/api/admin/projects')
      .set('x-dev-user', MEMBER)
      .send({ slug: 'khong-duoc-phep', name: 'X', summary: 'Y' })
    expect(res.status).toBe(403)
  })

  test('client KHÔNG tự nâng quyền được bằng header', async () => {
    const res = await request(app)
      .post('/api/admin/projects')
      .set('x-dev-user', MEMBER)
      .set('x-dev-roles', 'admin,ADMIN,content:write')
      .send({ slug: 'van-khong-duoc-phep', name: 'X', summary: 'Y' })
    expect(res.status).toBe(403)
  })
})

export {}
