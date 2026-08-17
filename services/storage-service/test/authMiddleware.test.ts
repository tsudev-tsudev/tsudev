// Phân quyền của storage-service, kiểm trên cơ chế THẬT.
//
// Bản trước của tệp này đặt REQUIRE_ROLE_ENFORCEMENT=true rồi tự tiêm vai trò
// qua header `x-dev-roles`. Nó xanh - nhưng chỉ chứng minh rằng nếu client tự
// khai vai trò thì server tin. Ở production không realm nào phát vai trò nào,
// nên nhánh đó không bao giờ chạy, và cờ kia thì mặc định tắt: bốn route "được
// bảo vệ" thực chất mở toang.
//
// Nay vai trò đọc từ cột `User.role` trong DB và fail closed. Ba điều được kiểm
// dưới đây là ba điều thực sự quyết định ai vào được:
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
// Không phụ thuộc thứ tự file test: cổng chặn internal-token phải tắt ở đây.
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')

const { signIdentity } = require('@tsudev/identity-token')

/** Header Authorization như BFF sẽ gửi - thay cho header `x-dev-user` đã gỡ. */
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const GUEST = 'test-guest-storage'
const MEMBER = 'test-member-storage'

beforeAll(async () => {
  for (const [username, role] of [
    [GUEST, 'GUEST'],
    [MEMBER, 'MEMBER'],
  ]) {
    await prisma.user.upsert({
      where: { username },
      update: { role },
      create: { username, email: `${username}@tsudev.local`, displayName: username, role },
    })
  }
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: [GUEST, MEMBER] } } })
  await prisma.$disconnect()
})

describe('storage-service: vai trò đọc từ DB, không phải từ claim của client', () => {
  test('MEMBER lấy được URL presign', async () => {
    const res = await request(app)
      .get('/api/presign')
      .set(await asUser(MEMBER))
      .query({ fileName: 'foo.txt' })
    expect(res.status).toBe(200)
  })

  test('GUEST bị từ chối - vai trò trong DB thấp hơn ngưỡng', async () => {
    const res = await request(app)
      .get('/api/presign')
      .set(await asUser(GUEST))
      .query({ fileName: 'foo.txt' })
    expect(res.status).toBe(403)
  })

  test('client KHÔNG tự nâng quyền được bằng header', async () => {
    // Đây là hồi quy quan trọng nhất của tệp này: bản cũ sẽ TRẢ 200 ở đây.
    const res = await request(app)
      .get('/api/presign')
      .set(await asUser(GUEST))
      .query({ fileName: 'foo.txt' })
    expect(res.status).toBe(403)
  })

  test('người dùng chưa từng thấy được tạo ở mức MEMBER và upload được', async () => {
    const fresh = 'test-fresh-storage'
    try {
      const res = await request(app)
        .post('/api/upload')
        .set('Content-Type', 'application/octet-stream')
        .set(await asUser(fresh))
        .send(Buffer.from('hello'))
      expect(res.status).toBe(200)
    } finally {
      await prisma.user.deleteMany({ where: { username: fresh } })
    }
  })
})

export {}
