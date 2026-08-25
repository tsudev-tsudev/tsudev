// Ba danh sách quản trị của Con dấu sau khi áp bộ tham số phân trang chuẩn
// (DATA_TABLE.md mục 8) - QU-STD-TABLE đợt 2.
//
// Tệp này tồn tại vì đổi ba endpoint đó sang `{data, meta}` là PHÁ VỠ client cũ
// mà KHÔNG test nào ở đây bắt được: cả ba trước kia trả mảng thuần và không có
// test nào chạm tới chúng, nên `/admin/trust` có thể trống trơn mà mọi cổng
// vẫn xanh - đúng kiểu hỏng im lặng mà repo này đã trả giá nhiều lần.
//
// `applications` đáng chú ý nhất: trước đợt này nó KHÔNG có trần nào, tức trần
// duy nhất là "hiện chưa nhiều đơn".
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const MOD = 'test-pagi-mod'
const NGOAI = 'test-pagi-ngoai'
const ACTION = 'TEST_PAGINATION'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const clean = async () => {
  await prisma.trustAuditLog.deleteMany({ where: { action: ACTION } })
  await prisma.user.deleteMany({ where: { username: { in: [MOD, NGOAI] } } })
}

beforeAll(async () => {
  await clean()
  const mod = await prisma.user.create({
    data: { username: MOD, email: `${MOD}@tsudev.local`, displayName: MOD, role: 'MODERATOR' },
  })
  await prisma.user.create({
    data: { username: NGOAI, email: `${NGOAI}@tsudev.local`, displayName: NGOAI, role: 'VIP' },
  })
  // 23 mục: đủ để có nhiều hơn hai trang ở mốc 10, nên `total_pages` và trang
  // cuối ngắn hơn mốc đều kiểm được thật chứ không chỉ trên giấy.
  for (let i = 0; i < 23; i++) {
    await prisma.trustAuditLog.create({
      data: {
        actorId: mod.id,
        actorName: MOD,
        action: ACTION,
        targetType: 'Test',
        targetId: `t-${i}`,
        targetLabel: `Mục ${i}`,
      },
    })
  }
}, 30000)

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('danh sách quản trị Con dấu trả {data, meta}', () => {
  test('audit: mốc mặc định 10, meta đủ bốn trường', async () => {
    const res = await request(app)
      .get('/api/trust/admin/audit')
      .set(await asUser(MOD))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(10)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.page_size).toBe(10)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(23)
    expect(res.body.meta.total_pages).toBe(Math.ceil(res.body.meta.total / 10))
  })

  test('audit: trang 2 khác trang 1 và không lặp bản ghi', async () => {
    const h = await asUser(MOD)
    const p1 = await request(app).get('/api/trust/admin/audit?page=1&page_size=10').set(h)
    const p2 = await request(app).get('/api/trust/admin/audit?page=2&page_size=10').set(h)
    const ids1 = p1.body.data.map((x: { id: string }) => x.id)
    const ids2 = p2.body.data.map((x: { id: string }) => x.id)
    expect(ids2.length).toBe(10)
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false)
  })

  test('audit: trang vượt trang cuối ⇒ mảng rỗng kèm meta đúng, KHÔNG 404', async () => {
    const res = await request(app)
      .get('/api/trust/admin/audit?page=9999&page_size=10')
      .set(await asUser(MOD))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.page).toBe(9999)
  })

  test('mốc lạ quy về mốc gần nhất KHÔNG lớn hơn, không báo lỗi', async () => {
    const h = await asUser(MOD)
    for (const [raw, want] of [
      [15, 10],
      [99, 50],
      [99999, 200],
    ] as const) {
      const res = await request(app).get(`/api/trust/admin/audit?page_size=${raw}`).set(h)
      expect(res.status).toBe(200)
      expect(res.body.meta.page_size).toBe(want)
    }
  })

  test('applications và certificates cũng là {data, meta}', async () => {
    const h = await asUser(MOD)
    for (const path of ['applications', 'certificates']) {
      const res = await request(app).get(`/api/trust/admin/${path}`).set(h)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.meta.page_size).toBe(10)
      expect(res.body.meta.total_pages).toBeGreaterThanOrEqual(1)
    }
  })

  test('người không phải kiểm duyệt viên vẫn bị chặn ở cả ba đường', async () => {
    const h = await asUser(NGOAI)
    for (const path of ['audit', 'applications', 'certificates']) {
      const res = await request(app).get(`/api/trust/admin/${path}`).set(h)
      expect(res.status).toBe(403)
    }
  })
})

export {}
