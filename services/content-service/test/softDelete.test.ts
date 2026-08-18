// Xoá mềm của Toà soạn Agent AI - hai bất biến, canh riêng.
//
// (1) Bài đã xoá mềm KHÔNG được lọt ra đường đọc công khai. Thêm cột
//     `deletedAt` mà quên bộ lọc là bài "đã xoá" vẫn hiển thị bình thường, và
//     không có gì báo lỗi - chỉ chủ dự án nhìn thấy mới biết.
//
// (2) Xoá CỨNG phải bị chặn ở cấp database. Hai tầng trên (không có route
//     DELETE, và requireAdmin) đều nằm ở tầng mã; test này chứng minh tầng thứ
//     ba thật sự tồn tại chứ không phải chỉ có trong tài liệu.
process.env.INTERNAL_API_TOKEN = 'test-token'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
const request = require('supertest')
const { app } = require('../src/index')
const { prisma } = require('@tsudev/db')

const withToken = (path: string) => request(app).get(path).set('x-internal-token', 'test-token')

const stamp = Date.now()
const LIVE = `soft-delete-live-${stamp}`
const GONE = `soft-delete-gone-${stamp}`
const DOC_GONE = `soft-delete-doc-${stamp}`

beforeAll(async () => {
  await prisma.post.create({
    data: { slug: LIVE, title: 'Bài còn sống', contentMd: 'x', published: true },
  })
  await prisma.post.create({
    data: {
      slug: GONE,
      title: 'Bài đã xoá mềm',
      contentMd: 'x',
      published: true,
      deletedAt: new Date(),
    },
  })
  await prisma.doc.create({
    data: { slug: DOC_GONE, title: 'Tài liệu đã xoá mềm', contentMd: 'x', deletedAt: new Date() },
  })
})

afterAll(async () => {
  // Dọn bằng đường thoát có chủ đích - chính là đường duy nhất xoá cứng được.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Post" WHERE slug IN ($1, $2)`, LIVE, GONE),
    prisma.$executeRawUnsafe(`DELETE FROM "Doc" WHERE slug = $1`, DOC_GONE),
  ])
  await prisma.$disconnect()
  delete process.env.INTERNAL_API_TOKEN
})

describe('xoá mềm không lọt ra đường đọc công khai', () => {
  test('GET /api/posts bỏ qua bài có deletedAt', async () => {
    const res = await withToken('/api/posts?limit=50')
    expect(res.status).toBe(200)
    const slugs = res.body.map((p: { slug: string }) => p.slug)
    expect(slugs).toContain(LIVE)
    expect(slugs).not.toContain(GONE)
  })

  test('GET /api/posts/:slug của bài đã xoá mềm ⇒ 404', async () => {
    expect((await withToken(`/api/posts/${GONE}`)).status).toBe(404)
    expect((await withToken(`/api/posts/${LIVE}`)).status).toBe(200)
  })

  test('GET /api/docs bỏ qua tài liệu có deletedAt', async () => {
    const res = await withToken('/api/docs')
    expect(res.status).toBe(200)
    expect(res.body.map((d: { slug: string }) => d.slug)).not.toContain(DOC_GONE)
  })

  test('GET /api/docs/:slug của tài liệu đã xoá mềm ⇒ 404', async () => {
    expect((await withToken(`/api/docs/${DOC_GONE}`)).status).toBe(404)
  })
})

describe('trigger chặn xoá cứng ở cấp database', () => {
  test('prisma.post.delete() bị từ chối', async () => {
    const victim = await prisma.post.findUnique({ where: { slug: LIVE } })
    await expect(prisma.post.delete({ where: { id: victim.id } })).rejects.toThrow(/Xoá cứng/)
    // Bản ghi vẫn còn nguyên - trigger chặn TRƯỚC khi xoá, không phải chặn nửa vời.
    expect(await prisma.post.findUnique({ where: { slug: LIVE } })).not.toBeNull()
  })

  test('ContentDraft và NewsroomEvent cũng được gác', async () => {
    const draft = await prisma.contentDraft.create({
      data: { target: 'BLOG', title: `probe-${stamp}` },
    })
    await expect(prisma.contentDraft.delete({ where: { id: draft.id } })).rejects.toThrow(
      /Xoá cứng/
    )

    const ev = await prisma.newsroomEvent.create({
      data: { type: 'test.probe', payload: {} },
    })
    await expect(prisma.newsroomEvent.delete({ where: { id: ev.id } })).rejects.toThrow(/Xoá cứng/)

    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
      prisma.$executeRawUnsafe(`DELETE FROM "ContentDraft" WHERE id = $1`, draft.id),
      prisma.$executeRawUnsafe(`DELETE FROM "NewsroomEvent" WHERE id = $1`, ev.id),
    ])
  })
})

describe('xoá mềm cho dự án (đợt 5)', () => {
  const SLUG = `soft-delete-project-${stamp}`

  beforeAll(async () => {
    await prisma.project.create({
      data: { slug: SLUG, name: 'Dự án nghiệm thu', summary: 'x', published: true },
    })
  })

  afterAll(async () => {
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
      prisma.$executeRawUnsafe(`DELETE FROM "Project" WHERE slug = $1`, SLUG),
    ])
  })

  test('dự án đã xoá mềm biến khỏi đường đọc công khai', async () => {
    expect((await withToken(`/api/projects/${SLUG}`)).status).toBe(200)

    await prisma.project.update({ where: { slug: SLUG }, data: { deletedAt: new Date() } })

    expect((await withToken(`/api/projects/${SLUG}`)).status).toBe(404)
    const list = await withToken('/api/projects?limit=100')
    expect(list.body.map((p: { slug: string }) => p.slug)).not.toContain(SLUG)

    await prisma.project.update({ where: { slug: SLUG }, data: { deletedAt: null } })
  })

  test('bản ghi vẫn còn trong DB sau khi xoá mềm - khôi phục được', async () => {
    await prisma.project.update({ where: { slug: SLUG }, data: { deletedAt: new Date() } })
    const still = await prisma.project.findUnique({ where: { slug: SLUG } })
    expect(still).not.toBeNull()
    expect(still.deletedAt).not.toBeNull()
    await prisma.project.update({ where: { slug: SLUG }, data: { deletedAt: null } })
  })

  test('trigger chặn xoá cứng Project', async () => {
    const p = await prisma.project.findUnique({ where: { slug: SLUG } })
    await expect(prisma.project.delete({ where: { id: p.id } })).rejects.toThrow(/Xoá cứng/)
  })
})
