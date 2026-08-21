// Đường ghi bài của tác giả: `/api/author/*`.
//
// Bất biến khoá lại ở đây, khác hẳn `/api/admin/*` (ADMIN, không giới hạn tác giả):
//   (1) Cổng vai trò AUTHOR đọc từ DB, fail closed - MEMBER 403, khách 401.
//   (2) SCOPE cứng theo tác giả: một AUTHOR không đọc/sửa/xoá được bài của AUTHOR
//       khác - và triệu chứng phải là 404 (không tiết lộ bài người khác tồn tại).
//   (3) `authorId` do PHIÊN quyết định, không do phần thân request: gửi authorId
//       giả trong body không cướp được quyền tác giả.
//   (4) Nháp (published:false) và bài đã xoá mềm KHÔNG lọt ra đường đọc công khai.
//
// Danh tính đến từ khẳng định có chữ ký của BFF; claim `role` chỉ THAM KHẢO, vai
// trò thật đọc từ User.role trong DB. Đặt khoá TRƯỚC khi require app.
//
// Slug mang hậu tố `stamp`: một lượt chạy hỏng nửa chừng để lại bài mồ côi
// (xoá User ⇒ authorId về null theo onDelete: SetNull) - slug cố định sẽ khiến
// lần chạy sau 409. Hậu tố theo thời gian khiến mỗi lượt độc lập, rerun an toàn.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const stamp = Date.now()
const A1 = `test-author1-${stamp}`
const A2 = `test-author2-${stamp}`
const MEM = `test-author-mem-${stamp}`

// Slug do slugify() suy ra từ các tiêu đề bên dưới - kiểm luôn cả việc bỏ dấu.
const SLUG_A1 = `bai-viet-dau-tien-${stamp}`
const TITLE_A1 = `Bài viết đầu tiên ${stamp}`
const SLUG_A2 = `bai-cua-tac-gia-hai-${stamp}`
const TITLE_A2 = `Bài của tác giả hai ${stamp}`

/** Header Authorization như BFF gửi. `role` ở đây là claim tham khảo, không phải nguồn quyền. */
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

let a1Id: string
let a2Id: string

const mkUser = (username: string, role: string) =>
  prisma.user.upsert({
    where: { username },
    update: { role },
    create: { username, email: `${username}@tsudev.local`, displayName: username, role },
  })

beforeAll(async () => {
  const [u1, u2] = await Promise.all([
    mkUser(A1, 'AUTHOR'),
    mkUser(A2, 'AUTHOR'),
    mkUser(MEM, 'MEMBER'),
  ])
  a1Id = u1.id
  a2Id = u2.id
})

afterAll(async () => {
  // Đường thoát duy nhất xoá cứng được (trigger tsudev_block_hard_delete). Xoá
  // Post TRƯỚC User để không bỏ lại bài mồ côi.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Post" WHERE "authorId" IN ($1, $2)`, a1Id, a2Id),
  ])
  await prisma.user.deleteMany({ where: { username: { in: [A1, A2, MEM] } } })
  await prisma.$disconnect()
})

describe('cổng vai trò', () => {
  test('khách chưa đăng nhập ⇒ 401', async () => {
    expect((await request(app).get('/api/author/posts')).status).toBe(401)
  })

  test('MEMBER ⇒ 403', async () => {
    const res = await request(app)
      .get('/api/author/posts')
      .set(await asUser(MEM))
    expect(res.status).toBe(403)
  })
})

describe('tạo bài', () => {
  test('AUTHOR tạo bài, slug tự suy từ tiêu đề tiếng Việt (bỏ dấu)', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A1))
      .send({ title: TITLE_A1, contentMd: 'Nội dung.' })
    expect(res.status).toBe(201)
    expect(res.body.slug).toBe(SLUG_A1)
    expect(res.body.published).toBe(true)
  })

  test('authorId không cướp được qua body - tác giả do phiên quyết định', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A1))
      .send({
        slug: `gan-tac-gia-gia-${stamp}`,
        title: 'Bài gắn tác giả giả',
        contentMd: 'x',
        authorId: a2Id,
      })
    expect(res.status).toBe(201)
    const row = await prisma.post.findUnique({ where: { slug: res.body.slug } })
    expect(row.authorId).toBe(a1Id) // KHÔNG phải a2Id
    expect(row.authoredByAgentId).toBeNull()
  })

  test('slug trùng ⇒ 409', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A2))
      .send({ slug: SLUG_A1, title: 'Đụng slug', contentMd: 'x' })
    expect(res.status).toBe(409)
  })

  test('thiếu title ⇒ 400', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A1))
      .send({ contentMd: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('scope theo tác giả', () => {
  test('AUTHOR chỉ thấy bài của chính mình trong danh sách', async () => {
    await request(app)
      .post('/api/author/posts')
      .set(await asUser(A2))
      .send({ slug: SLUG_A2, title: TITLE_A2, contentMd: 'x' })

    const res = await request(app)
      .get('/api/author/posts')
      .set(await asUser(A1))
    expect(res.status).toBe(200)
    const slugs = res.body.map((p: { slug: string }) => p.slug)
    expect(slugs).toContain(SLUG_A1)
    expect(slugs).not.toContain(SLUG_A2)
  })

  test('AUTHOR khác không GET/PATCH/DELETE được bài của mình ⇒ 404', async () => {
    const get = await request(app)
      .get(`/api/author/posts/${SLUG_A2}`)
      .set(await asUser(A1))
    expect(get.status).toBe(404)

    const patch = await request(app)
      .patch(`/api/author/posts/${SLUG_A2}`)
      .set(await asUser(A1))
      .send({ title: 'Cướp bài' })
    expect(patch.status).toBe(404)

    const del = await request(app)
      .delete(`/api/author/posts/${SLUG_A2}`)
      .set(await asUser(A1))
    expect(del.status).toBe(404)

    // Bài của A2 vẫn nguyên vẹn.
    const row = await prisma.post.findUnique({ where: { slug: SLUG_A2 } })
    expect(row.title).toBe(TITLE_A2)
    expect(row.deletedAt).toBeNull()
  })
})

describe('sửa và xoá bài của mình', () => {
  test('PATCH cập nhật được bài của mình', async () => {
    const res = await request(app)
      .patch(`/api/author/posts/${SLUG_A1}`)
      .set(await asUser(A1))
      .send({ title: 'Tiêu đề đã đổi', tags: ['rust', 'wasm'] })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Tiêu đề đã đổi')
    expect(res.body.tags).toEqual(['rust', 'wasm'])
  })

  test('DELETE là xoá mềm: bài rời danh sách của mình nhưng còn trong DB', async () => {
    const del = await request(app)
      .delete(`/api/author/posts/${SLUG_A1}`)
      .set(await asUser(A1))
    expect(del.status).toBe(200)

    const list = await request(app)
      .get('/api/author/posts')
      .set(await asUser(A1))
    expect(list.body.map((p: { slug: string }) => p.slug)).not.toContain(SLUG_A1)

    const row = await prisma.post.findUnique({ where: { slug: SLUG_A1 } })
    expect(row).not.toBeNull()
    expect(row.deletedAt).not.toBeNull()
  })
})

describe('nháp và bài đã xoá không lọt ra đường đọc công khai', () => {
  test('published:false không hiện ở /api/posts nhưng chủ nhân vẫn thấy', async () => {
    const slug = `ban-nhap-rieng-${stamp}`
    const create = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A1))
      .send({ slug, title: 'Bản nháp riêng', contentMd: 'x', published: false })
    expect(create.status).toBe(201)

    const pub = await request(app).get('/api/posts?limit=50')
    expect(pub.body.map((p: { slug: string }) => p.slug)).not.toContain(slug)

    const mine = await request(app)
      .get('/api/author/posts')
      .set(await asUser(A1))
    expect(mine.body.map((p: { slug: string }) => p.slug)).toContain(slug)
  })
})

// Đánh dấu tệp này là MODULE. Thiếu import/export thì TypeScript coi nó là script
// toàn cục và các biến top-level (`request`, `app`, `prisma`) đụng tên với tệp
// test khác cùng kiểu (vd softDelete.test.ts) - ts-jest ở CI báo "suite failed to
// run". Không đổi gì lúc chạy.
export {}
