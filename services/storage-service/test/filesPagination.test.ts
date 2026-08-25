// `GET /api/files` sau khi áp bộ tham số phân trang chuẩn (DATA_TABLE.md mục 8)
// - QU-STD-TABLE đợt 2.
//
// Endpoint này chưa có trang nào dùng, nên nếu không có tệp này thì việc nó đổi
// từ mảng thuần sang `{data, meta}` hoàn toàn không được đo ở đâu cả.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const PREFIX = 'test-pagi/'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const clean = () => prisma.fileObject.deleteMany({ where: { key: { startsWith: PREFIX } } })

beforeAll(async () => {
  await clean()
  for (let i = 0; i < 12; i++) {
    await prisma.fileObject.create({
      data: {
        key: `${PREFIX}f-${i}`,
        fileName: `f-${i}.txt`,
        size: 10,
        contentType: 'text/plain',
      },
    })
  }
}, 30000)

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('storage-service - GET /api/files phân trang', () => {
  test('trả {data, meta}, mốc mặc định 10', async () => {
    const res = await request(app)
      .get('/api/files')
      .set(await asUser('tester'))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(10)
    expect(res.body.meta.page_size).toBe(10)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(12)
    expect(res.body.meta.total_pages).toBe(Math.ceil(res.body.meta.total / 10))
  })

  test('trang 2 không lặp bản ghi của trang 1', async () => {
    const h = await asUser('tester')
    const p1 = await request(app).get('/api/files?page=1&page_size=10').set(h)
    const p2 = await request(app).get('/api/files?page=2&page_size=10').set(h)
    const k1 = p1.body.data.map((x: { key: string }) => x.key)
    const k2 = p2.body.data.map((x: { key: string }) => x.key)
    expect(k1.some((k: string) => k2.includes(k))).toBe(false)
  })

  test('trần cứng 200: page_size khổng lồ bị quy về 200, không báo lỗi', async () => {
    const res = await request(app)
      .get('/api/files?page_size=99999')
      .set(await asUser('tester'))
    expect(res.status).toBe(200)
    expect(res.body.meta.page_size).toBe(200)
  })
})

export {}
