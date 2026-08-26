// Đường "Duyệt đăng" ở /admin/newsroom.
//
// Triệu chứng: bấm "Duyệt đăng" xong thẻ vẫn nằm nguyên trong cột "CHỜ BẠN
// DUYỆT", không có gì đổi, không có gì báo lỗi. Người dùng bấm lại vài lần.
//
// Nó KHÔNG hỏng - nó chỉ không nói thật. Đường này xếp một sự kiện
// `publish.requested`; việc đăng thật nằm ở `onPublishRequested` và chỉ chạy ở
// nhịp kế tiếp, mà nhịp là MỖI GIỜ (`7 0-17,23 * * *`). Nên `ContentDraft.status`
// đứng yên tới 60 phút, và trước bản vá thì không đâu nói ra điều đó.
//
// Ba điều được khoá ở đây: phản hồi mang đủ dữ kiện để giao diện nói được sự
// thật; bấm hai lần không xếp hai lượt; và `/state` khai ra bản nháp nào đang
// chờ nhịp để thẻ đổi được NGAY.
process.env.NODE_ENV = 'test'
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

const request = require('supertest')
const { prisma } = require('@tsudev/db')

// Thay đúng HAI thứ mà `src/index.ts` dùng để dựng hàng rào, không thay cả gói:
// tệp này kiểm hành vi của route, còn ranh giới xác thực đã có
// `authCoverage.test.ts` canh riêng. Tên phải khớp nguyên văn - mock sai tên thì
// hàng rào thật vẫn chạy và mọi test ở đây nhận 401.
jest.mock('@tsudev/auth', () => ({
  ...jest.requireActual('@tsudev/auth'),
  createAuthMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

const { app } = require('../src/index')

const stamp = Date.now()
const TITLE = `Bản nháp chờ duyệt ${stamp}`

const clean = () =>
  prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(
      `DELETE FROM "NewsroomEvent" WHERE "draftId" IN (SELECT id FROM "ContentDraft" WHERE title LIKE '%${stamp}%')`
    ),
    prisma.$executeRawUnsafe(`DELETE FROM "ContentDraft" WHERE title LIKE '%${stamp}%'`),
  ])

beforeAll(clean, 30000)
afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const makeDraft = () =>
  prisma.contentDraft.create({
    data: { target: 'BLOG', status: 'PENDING_HUMAN', title: TITLE, contentMd: '# Nội dung' },
  })

describe('duyệt đăng một bản nháp', () => {
  test('xếp hàng và TRẢ VỀ đủ dữ kiện để giao diện nói thật', async () => {
    const draft = await makeDraft()
    const res = await request(app).post(`/api/newsroom/admin/draft/${draft.id}/approve`).send({})

    expect(res.status).toBe(200)
    expect(res.body.queued).toBe(true)
    expect(res.body.alreadyQueued).toBe(false)
    expect(res.body.queuedAt).toBeTruthy()
    // Điểm mấu chốt: trạng thái bản nháp KHÔNG đổi, và phản hồi khai ra điều đó
    // thay vì để người dùng tự đoán.
    expect(res.body.status).toBe('PENDING_HUMAN')

    const after = await prisma.contentDraft.findUnique({ where: { id: draft.id } })
    expect(after.status).toBe('PENDING_HUMAN')

    const evs = await prisma.newsroomEvent.findMany({
      where: { draftId: draft.id, type: 'publish.requested' },
    })
    expect(evs).toHaveLength(1)
    expect(evs[0].actorKind).toBe('human')
  })

  test('bấm hai lần KHÔNG xếp hai lượt', async () => {
    const draft = await makeDraft()
    await request(app).post(`/api/newsroom/admin/draft/${draft.id}/approve`).send({})
    const second = await request(app).post(`/api/newsroom/admin/draft/${draft.id}/approve`).send({})

    expect(second.status).toBe(200)
    expect(second.body.alreadyQueued).toBe(true)

    const evs = await prisma.newsroomEvent.findMany({
      where: { draftId: draft.id, type: 'publish.requested' },
    })
    expect(evs).toHaveLength(1)
  })

  test('/state khai ra bản nháp đang chờ nhịp đăng', async () => {
    const draft = await makeDraft()
    await request(app).post(`/api/newsroom/admin/draft/${draft.id}/approve`).send({})

    const res = await request(app).get('/api/newsroom/state')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.queuedPublish)).toBe(true)
    expect(res.body.queuedPublish).toContain(draft.id)
  })

  test('bản nháp đã đăng thì từ chối, không xếp thêm', async () => {
    const draft = await prisma.contentDraft.create({
      data: { target: 'BLOG', status: 'PUBLISHED', title: TITLE, contentMd: '# Đã đăng' },
    })
    const res = await request(app).post(`/api/newsroom/admin/draft/${draft.id}/approve`).send({})
    expect(res.status).toBe(409)

    const evs = await prisma.newsroomEvent.findMany({
      where: { draftId: draft.id, type: 'publish.requested' },
    })
    expect(evs).toHaveLength(0)
  })
})
