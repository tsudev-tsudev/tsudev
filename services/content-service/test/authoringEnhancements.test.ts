// Nâng cấp công cụ đăng/sửa bài (Pha 1-6): publishedAt + lên lịch, Nguồn tham
// khảo có cấu trúc, ảnh bìa/SEO, và chỉ mục tìm kiếm tiếng Việt.
//
// Bất biến khoá lại ở đây:
//   (1) MỌI đường ghi Post tính sẵn cột chuẩn hoá ⇒ tìm được ngay (kể cả gõ
//       không dấu). Bỏ sót là bài "biến mất" khỏi tìm kiếm mà vẫn hiển thị.
//   (2) Lên lịch: publishedAt tương lai ⇒ ẩn khỏi MỌI đường đọc công khai
//       (danh sách + chi tiết + tìm kiếm), hiện lại khi tới giờ.
//   (3) Nguồn tham khảo chỉ nhận URL http/https (chặn javascript:/data:).
//   (4) Endpoint tìm kiếm KHÔNG có bề mặt lộ bản nháp (published:false) qua URL.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const search = require('@tsudev/search')
const { app } = require('../src/index')

const stamp = Date.now()
const AUTHOR = `test-enh-author-${stamp}`
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

let authorId: string

beforeAll(async () => {
  const u = await prisma.user.upsert({
    where: { username: AUTHOR },
    update: { role: 'AUTHOR', emailVerifiedAt: new Date() },
    create: {
      username: AUTHOR,
      email: `${AUTHOR}@tsudev.local`,
      displayName: AUTHOR,
      role: 'AUTHOR',
      emailVerifiedAt: new Date(),
    },
  })
  authorId = u.id
})

afterAll(async () => {
  // Post có trigger chặn xoá CỨNG (Toà soạn xoá mềm). Dọn mềm cho gọn.
  await prisma.post.updateMany({ where: { authorId }, data: { deletedAt: new Date() } })
  await prisma.user.deleteMany({ where: { username: AUTHOR } }).catch(() => {})
})

// ---------------------------------------------------------------------------
describe('@tsudev/search - chuẩn hoá tiếng Việt', () => {
  test('bỏ dấu + xử lý đ/Đ', () => {
    expect(search.viNormalizeText('Đường phố Hà Nội')).toBe('duong pho ha noi')
    expect(search.viNormalizeText('tương tác')).toBe('tuong tac')
  })
  test('NFC và NFD cho cùng kết quả', () => {
    expect(search.viNormalizeText('việt'.normalize('NFD'))).toBe(
      search.viNormalizeText('việt'.normalize('NFC'))
    )
  })
  test('chuỗi rỗng / chỉ dấu câu', () => {
    expect(search.viNormalizeText('   ')).toBe('')
    expect(search.viWordCount('')).toBe(0)
    expect(search.viWordCount('học sinh giỏi')).toBe(3)
  })
  test('buildPostSearch gộp tiêu đề + thân', () => {
    const r = search.buildPostSearch({
      title: 'Định dạng',
      excerpt: 'Tóm tắt',
      contentMd: 'Nội **dung**',
    })
    expect(r.searchTitleNorm).toBe('dinh dang')
    expect(r.searchBodyNorm).toContain('tom tat')
    expect(r.searchBodyNorm).toContain('noi dung')
  })
  test('findMatchRanges ánh xạ NGƯỢC khi gõ không dấu', () => {
    const ranges = search.findMatchRanges('Kiến trúc microservices', 'kien truc')
    expect(ranges.map(([a, b]: [number, number]) => 'Kiến trúc microservices'.slice(a, b))).toEqual(
      ['Kiến trúc']
    )
  })
})

// ---------------------------------------------------------------------------
describe('content-service - đăng bài với trường nâng cao', () => {
  const slugPast = `bai-qua-khu-${stamp}`
  const slugFuture = `bai-len-lich-${stamp}`

  test('tạo bài kèm publishedAt/references/cover/meta ⇒ 201, trả đủ trường', async () => {
    const auth = await asUser(AUTHOR)
    const res = await request(app)
      .post('/api/author/posts')
      .set(auth)
      .send({
        slug: slugPast,
        title: `Bài tương tác ${stamp}`,
        contentMd: 'Nội dung nói về tương tác và kiến trúc.',
        tags: ['tuong-tac', 'kien-truc'],
        publishedAt: new Date(Date.now() - 60_000).toISOString(),
        coverImageUrl: 'https://cdn.example.com/anh.png',
        metaDescription: 'Mô tả SEO',
        references: [
          { label: 'Tài liệu', url: 'https://docs.example.com' },
          { url: 'https://no-label.example.com' },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.coverImageUrl).toBe('https://cdn.example.com/anh.png')
    expect(res.body.references).toHaveLength(2)
    // Nhãn rỗng ⇒ suy từ host.
    expect(res.body.references[1].label).toBe('no-label.example.com')
  })

  test('references với URL không hợp lệ ⇒ 400', async () => {
    const auth = await asUser(AUTHOR)
    const res = await request(app)
      .post('/api/author/posts')
      .set(auth)
      .send({
        slug: `bai-xau-${stamp}`,
        title: 'Bài URL xấu',
        contentMd: 'nội dung đủ dài để không bị chặn',
        references: [{ label: 'x', url: 'javascript:alert(1)' }],
      })
    expect(res.status).toBe(400)
  })

  test('tìm kiếm không dấu tìm thấy bài vừa tạo (chỉ mục tính lúc ghi)', async () => {
    const res = await request(app).get('/api/posts/search').query({ q: 'tuong tac' })
    const slugs = res.body.data.map((p: { slug: string }) => p.slug)
    expect(slugs).toContain(slugPast)
  })

  test('bài lên lịch (publishedAt tương lai) ẨN khỏi công khai', async () => {
    const auth = await asUser(AUTHOR)
    const create = await request(app)
      .post('/api/author/posts')
      .set(auth)
      .send({
        slug: slugFuture,
        title: `Bài hẹn giờ ${stamp}`,
        contentMd: 'nội dung hẹn giờ đủ dài',
        publishedAt: new Date(Date.now() + 3600_000).toISOString(),
      })
    expect(create.status).toBe(201)

    // Danh sách công khai KHÔNG chứa nó.
    const list = await request(app).get('/api/posts?limit=50')
    expect(list.body.map((p: { slug: string }) => p.slug)).not.toContain(slugFuture)
    // Chi tiết công khai ⇒ 404.
    const detail = await request(app).get(`/api/posts/${slugFuture}`)
    expect(detail.status).toBe(404)
  })

  test('PATCH publishedAt về quá khứ ⇒ bài hiện ra + trả references', async () => {
    const auth = await asUser(AUTHOR)
    const patch = await request(app)
      .patch(`/api/author/posts/${slugFuture}`)
      .set(auth)
      .send({ publishedAt: new Date(Date.now() - 1000).toISOString() })
    expect(patch.status).toBe(200)
    const detail = await request(app).get(`/api/posts/${slugFuture}`)
    expect(detail.status).toBe(200)
    expect(Array.isArray(detail.body.references)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
describe('content-service - endpoint tìm/lọc', () => {
  test('q dưới 2 ký tự và không tag ⇒ rỗng', async () => {
    const res = await request(app).get('/api/posts/search').query({ q: 'a' })
    expect(res.body.data).toHaveLength(0)
    expect(res.body.meta.total).toBe(0)
  })
  test('page_size bị chặn trần 200 (mốc chuẩn cao nhất)', async () => {
    const res = await request(app)
      .get('/api/posts/search')
      .query({ tag: 'tuong-tac', page_size: 99999 })
    expect(res.body.meta.page_size).toBe(200)
  })
  test('page_size lạ quy về mốc gần nhất KHÔNG lớn hơn, không báo lỗi', async () => {
    for (const [raw, want] of [
      [15, 10],
      [99, 50],
      [150, 100],
    ] as const) {
      const res = await request(app)
        .get('/api/posts/search')
        .query({ tag: 'tuong-tac', page_size: raw })
      expect(res.status).toBe(200)
      expect(res.body.meta.page_size).toBe(want)
    }
  })
  test('meta có total_pages, tối thiểu 1 kể cả khi rỗng', async () => {
    // 0 làm giao diện phân trang hiện "trang 1 / 0".
    const empty = await request(app).get('/api/posts/search').query({ q: 'a' })
    expect(empty.body.meta.total_pages).toBe(1)
    const hit = await request(app).get('/api/posts/search').query({ tag: 'tuong-tac' })
    expect(hit.body.meta.total_pages).toBeGreaterThanOrEqual(1)
  })
  test('lọc theo tag trả facet', async () => {
    const res = await request(app).get('/api/posts/search').query({ tag: 'tuong-tac' })
    expect(res.body.facets.tag.length).toBeGreaterThan(0)
  })
  test('bản nháp (published:false) KHÔNG lọt ra tìm kiếm', async () => {
    const auth = await asUser(AUTHOR)
    const draftSlug = `bai-nhap-${stamp}`
    await request(app)
      .post('/api/author/posts')
      .set(auth)
      .send({
        slug: draftSlug,
        title: `Nháp tương tác ${stamp}`,
        contentMd: 'nội dung nháp về tương tác',
        tags: ['tuong-tac'],
        published: false,
      })
    const res = await request(app)
      .get('/api/posts/search')
      .query({ q: `nhap tuong tac ${stamp}` })
    expect(res.body.data.map((p: { slug: string }) => p.slug)).not.toContain(draftSlug)
  })
})

// Biến file này thành MODULE: các khai báo top-level (request/app/prisma/stamp)
// thành phạm vi module, không rơi vào global. Thiếu dòng này thì `tsc -b` gộp
// chúng với cùng tên ở softDelete.test.ts thành "Cannot redeclare" - CI đỏ dù
// jest (mỗi file một module) ở local vẫn xanh. Xem author.test.ts + rateLimit.test.ts.
export {}
