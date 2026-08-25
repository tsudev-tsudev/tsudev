// DOCS-SEARCH - tài liệu phải TÌM THẤY ĐƯỢC, không chỉ đọc được.
//
// Triệu chứng mà bộ test này canh không hề ồn ào: tài liệu do Toà soạn Agent AI
// viết hiện ra ở `/docs` bình thường, nhưng gõ đúng tiêu đề của nó vào ô tìm
// kiếm thì không ra gì. Không mã lỗi, không log, không CI đỏ - chỉ là một tính
// năng lặng lẽ thiếu một nửa. Vì vậy phép đo ở đây bám vào PHẢN HỒI THẬT của
// endpoint, không phải vào việc hàm chỉ mục có được gọi hay không.
process.env.INTERNAL_API_TOKEN = 'test-token'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
const request = require('supertest')
const { app } = require('../src/index')
const { prisma } = require('@tsudev/db')
import { buildDocSearch, buildSnippet } from '@tsudev/search'

const withToken = (path: string) => request(app).get(path).set('x-internal-token', 'test-token')

const stamp = Date.now()
const MARK = `kkqz${stamp}` // chuỗi không thể trùng dữ liệu thật
const DOC_A = `doc-search-a-${stamp}`
const DOC_B = `doc-search-b-${stamp}`
const POST_A = `doc-search-post-${stamp}`
const CATEGORY = `chuyen-muc-${stamp}`

const mkDoc = (slug: string, title: string, contentMd: string, extra = {}) => ({
  slug,
  title,
  contentMd,
  category: CATEGORY,
  ...buildDocSearch({ title, contentMd }),
  ...extra,
})

beforeAll(async () => {
  await prisma.doc.create({
    // Tiêu đề CÓ DẤU, truy vấn sẽ gõ KHÔNG DẤU - đó là cả điểm của @tsudev/search.
    data: mkDoc(DOC_A, `Kiến trúc ${MARK} tổng thể`, '## Mở đầu\n\nNội dung tài liệu A.'),
  })
  await prisma.doc.create({
    // Từ khoá chỉ nằm trong THÂN BÀI, không có ở tiêu đề.
    data: mkDoc(DOC_B, 'Tài liệu phụ', `Đoạn này có nhắc tới ${MARK} ở giữa bài.`),
  })
  await prisma.doc.create({
    // Đã xoá mềm ⇒ phải nằm ngoài kết quả, dù chỉ mục đã tính sẵn.
    data: mkDoc(`${DOC_B}-gone`, `Bản cũ ${MARK}`, 'x', { deletedAt: new Date() }),
  })
  await prisma.post.create({
    data: {
      slug: POST_A,
      title: `Bài viết ${MARK}`,
      contentMd: 'x',
      published: true,
      publishedAt: new Date(),
      searchTitleNorm: `bai viet ${MARK}`,
      searchBodyNorm: 'x',
    },
  })
})

afterAll(async () => {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Doc" WHERE slug LIKE $1`, `doc-search-%-${stamp}%`),
    prisma.$executeRawUnsafe(`DELETE FROM "Post" WHERE slug = $1`, POST_A),
  ])
  await prisma.$disconnect()
})

const search = (qs: string) => withToken(`/api/posts/search?${qs}`)

describe('buildDocSearch', () => {
  it('chuẩn hoá không dấu và rút văn bản thuần khỏi Markdown', () => {
    const s = buildDocSearch({ title: 'Kiến trúc Đề án', contentMd: '## Tiêu đề\n\n`mã` **đậm**' })
    expect(s.searchTitleNorm).toBe('kien truc de an')
    // Cú pháp Markdown KHÔNG được lọt vào chỉ mục - gõ "##" không phải là tìm kiếm.
    expect(s.searchBodyNorm).toBe('tieu de ma dam')
  })
})

describe('buildSnippet', () => {
  it('cắt quanh chỗ khớp và trả về văn bản GỐC (còn dấu) để tô sáng được', () => {
    const body = `${'x'.repeat(300)} Kiến trúc tổng thể ${'y'.repeat(300)}`
    const snip = buildSnippet(body, 'kien truc')
    expect(snip).toContain('Kiến trúc')
    expect(snip.startsWith('…')).toBe(true)
    expect(snip.endsWith('…')).toBe(true)
  })

  it('không khớp thì lấy phần đầu bài chứ không trả rỗng', () => {
    expect(buildSnippet('Một tài liệu ngắn.', 'khongcogi')).toBe('Một tài liệu ngắn.')
  })
})

describe('GET /api/posts/search - phạm vi phủ cả Doc', () => {
  it('tìm thấy tài liệu khi gõ KHÔNG DẤU', async () => {
    const res = await search(`q=kien truc ${MARK}&type=doc`)
    expect(res.status).toBe(200)
    const slugs = res.body.data.map((h: { slug: string }) => h.slug)
    expect(slugs).toContain(DOC_A)
  })

  it('tìm thấy tài liệu khi từ khoá chỉ nằm trong thân bài', async () => {
    const res = await search(`q=${MARK}&type=doc`)
    const slugs = res.body.data.map((h: { slug: string }) => h.slug)
    expect(slugs).toContain(DOC_B)
  })

  it('mỗi hàng tự khai `kind`, và tài liệu trỏ về slug của /docs', async () => {
    const res = await search(`q=${MARK}&type=doc`)
    for (const hit of res.body.data) {
      expect(hit.kind).toBe('doc')
      expect(typeof hit.slug).toBe('string')
      expect(typeof hit.excerpt).toBe('string')
      expect(hit.category).toBe(CATEGORY)
    }
  })

  it('trộn cả hai loại khi không lọc, và đếm theo từng loại ở facet', async () => {
    const res = await search(`q=${MARK}`)
    const kinds = new Set(res.body.data.map((h: { kind: string }) => h.kind))
    expect(kinds).toEqual(new Set(['post', 'doc']))
    const facet = Object.fromEntries(
      res.body.facets.type.map((f: { slug: string; count: number }) => [f.slug, f.count])
    )
    expect(facet.post).toBe(1)
    expect(facet.doc).toBe(2) // DOC_A + DOC_B, KHÔNG tính bản đã xoá mềm
    expect(res.body.meta.total).toBe(3)
  })

  it('KHÔNG trả tài liệu đã xoá mềm', async () => {
    const res = await search(`q=${MARK}&page_size=200`)
    const slugs = res.body.data.map((h: { slug: string }) => h.slug)
    expect(slugs).not.toContain(`${DOC_B}-gone`)
  })

  it('facet loại đếm BỎ QUA bộ lọc type, để người dùng biết chuyển sang loại kia có gì', async () => {
    const res = await search(`q=${MARK}&type=post`)
    expect(res.body.data.every((h: { kind: string }) => h.kind === 'post')).toBe(true)
    expect(res.body.meta.total).toBe(1)
    const facet = Object.fromEntries(
      res.body.facets.type.map((f: { slug: string; count: number }) => [f.slug, f.count])
    )
    expect(facet.doc).toBe(2)
  })

  it('`type` sai chính tả bị BỎ QUA chứ không báo lỗi và không làm rỗng kết quả', async () => {
    const res = await search(`q=${MARK}&type=khong-ton-tai`)
    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBe(3)
  })

  it('lọc `category` chỉ ra tài liệu, và có facet chuyên mục', async () => {
    const res = await search(`q=${MARK}&category=${CATEGORY}`)
    expect(res.body.data.every((h: { kind: string }) => h.kind === 'doc')).toBe(true)
    const cats = res.body.facets.category.map((f: { slug: string }) => f.slug)
    expect(cats).toContain(CATEGORY)
  })

  it('lọc `tag` loại tài liệu ra khỏi phạm vi - tài liệu không mang thẻ', async () => {
    const res = await search(`q=${MARK}&tag=khong-co-the-nay`)
    const facet = Object.fromEntries(
      res.body.facets.type.map((f: { slug: string; count: number }) => [f.slug, f.count])
    )
    expect(facet.doc).toBe(0)
  })

  it('phân trang theo NGÀY chính xác ở trang sau, không mất bản ghi khi trộn hai nguồn', async () => {
    const all = await search(`q=${MARK}&sort=newest&page_size=200`)
    const expected = all.body.data.map((h: { slug: string }) => h.slug)
    expect(expected).toHaveLength(3)

    const collected: string[] = []
    for (const page of [1, 2, 3]) {
      const res = await search(`q=${MARK}&sort=newest&page_size=10&page=${page}`)
      collected.push(...res.body.data.map((h: { slug: string }) => h.slug))
    }
    // page_size=10 nên cả ba nằm ở trang 1; phép đo thật nằm ở dòng dưới - lật
    // HẾT tập chứ không dừng ở trang đầu (bài học phiên 26).
    expect([...new Set(collected)].sort()).toEqual([...expected].sort())
  })

  it('không từ khoá và không bộ lọc ⇒ rỗng, kèm đủ ba nhóm facet', async () => {
    const res = await search('q=a')
    expect(res.body.data).toEqual([])
    expect(res.body.facets).toEqual({ tag: [], category: [], type: [] })
  })
})
