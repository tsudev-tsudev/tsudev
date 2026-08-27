// Giữ tệp là MODULE - xem chú thích ở test/reviveDead.test.ts.
export {}

// Đường đăng TÀI LIỆU của Toà soạn Agent AI - NEWSROOM-DOCS B0/B4.
//
// Vì sao tệp này tồn tại: `/docs` trên production có đúng 2 tài liệu, cả hai từ
// seed gốc, 0 bài do agent viết. Nhưng nhánh `draft.target === 'DOC'` trong
// `onPublishRequested` LÀ CÓ và trông hoàn chỉnh. Nghịch lý đó có một lời giải
// duy nhất: nhánh này **chưa từng chạy**, vì `seed-newsroom.js` khai 8 nguồn
// BLOG, 2 nguồn PROJECT và 0 nguồn DOC - không có nguồn thì không có đề tài,
// không có đề tài thì không có bản nháp.
//
// ⚠️ Cập nhật 27/08/2026: thêm nguồn DOC (26/08) hoá ra CHƯA ĐỦ. Nguồn tồn tại
// trên prod mà `lastScanAt` vẫn NULL - van áp lực ngược toàn cục để BLOG chiếm
// hết hàng đợi, và truy vấn chọn nguồn không có `orderBy` nên nguồn thêm sau nằm
// cuối hàng. Nhánh này VẪN chưa chạy thật lần nào tính tới hôm đó. Xem
// `backPressure.test.ts` và phiếu `20260827-02`.
//
// Mã không chạy bao giờ là mã chưa biết có đúng không. Trước khi thêm nguồn đề
// tài để nó bắt đầu chạy thật, khoá lại ở đây rằng nó chạy đúng.
process.env.NODE_ENV = 'test'
// Mọi test newsroom trước tệp này đều MOCK `@tsudev/db`, nên chưa tệp nào cần
// DATABASE_URL. Tệp này chạm cơ sở dữ liệu thật, và npm workspace đặt cwd ở
// thư mục service - nơi không có `.env`. Nạp từ gốc repo, giống hệt `src/index.ts`.
// `dotenv` không ghi đè biến đã có, nên ở CI (biến đến từ env của job) đây là no-op.
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

const { prisma } = require('@tsudev/db')
const { onPublishRequested } = require('../src/dispatcher')

const stamp = Date.now()
const TITLE = `Hướng dẫn kiểm thử đường tài liệu ${stamp}`
const SLUG = `huong-dan-kiem-thu-duong-tai-lieu-${stamp}`

/**
 * `Doc` và `ContentDraft` đều bị trigger Postgres chặn xoá CỨNG (mã 42501) -
 * đó là lớp bảo vệ thật, không phải quy ước, nên dữ liệu test đi qua đúng cửa
 * thoát mà chính thông báo lỗi chỉ ra. Xoá mềm không dùng được ở đây: lần chạy
 * sau sẽ đếm phải hàng cũ.
 *
 * Cả hai lệnh phải nằm trong CÙNG một giao dịch với `SET LOCAL` - `SET LOCAL`
 * chỉ sống hết giao dịch, nên tách ra là câu thứ hai lại bị chặn.
 */
const clean = () =>
  prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "Doc" WHERE slug LIKE '%${stamp}%'`),
    prisma.$executeRawUnsafe(`DELETE FROM "ContentDraft" WHERE title LIKE '%${stamp}%'`),
  ])

beforeAll(clean, 30000)
afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const makeDraft = (over: Record<string, unknown> = {}) =>
  prisma.contentDraft.create({
    data: {
      target: 'DOC',
      status: 'PENDING_REVIEW',
      title: TITLE,
      slug: SLUG,
      contentMd: '## Mục đích\n\nNội dung tài liệu do agent viết.',
      ...over,
    },
  })

describe('đăng bản nháp DOC', () => {
  test('tạo ra hàng Doc thật và đánh dấu bản nháp là PUBLISHED', async () => {
    const draft = await makeDraft()
    await onPublishRequested(draft.id)

    const doc = await prisma.doc.findUnique({ where: { slug: SLUG } })
    expect(doc).not.toBeNull()
    expect(doc.title).toBe(TITLE)
    expect(doc.contentMd).toContain('Nội dung tài liệu do agent viết')
    // Lần ngược về bản nháp đã sinh ra nó - thiếu cái này thì không truy được
    // tài liệu nào do agent nào viết, ở vòng sửa thứ mấy.
    expect(doc.sourceDraftId).toBe(draft.id)
    expect(doc.deletedAt).toBeNull()

    const after = await prisma.contentDraft.findUnique({ where: { id: draft.id } })
    expect(after.status).toBe('PUBLISHED')
    expect(after.slug).toBe(SLUG)
  }, 30000)

  test('Doc vừa tạo lọt qua đúng bộ lọc mà /api/docs dùng', async () => {
    // `/api/docs` liệt kê `where: { deletedAt: null }`. Khẳng định ở đây bằng
    // CHÍNH điều kiện đó thay vì tin rằng nó sẽ hiện: đăng thành công mà trang
    // vẫn trống là đúng hình dạng lỗi mà repo này đã gặp nhiều lần.
    const listed = await prisma.doc.findMany({
      where: { deletedAt: null, slug: SLUG },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    })
    expect(listed).toHaveLength(1)
  }, 30000)

  test('slug đụng nhau ⇒ tự tách, KHÔNG ghi đè tài liệu đã có', async () => {
    const draft = await makeDraft({ title: `${TITLE} bản hai` })
    await onPublishRequested(draft.id)

    const docs = await prisma.doc.findMany({ where: { slug: { startsWith: SLUG } } })
    expect(docs.length).toBe(2)
    expect(new Set(docs.map((d: { slug: string }) => d.slug)).size).toBe(2)
  }, 30000)

  test('gọi lại trên bản nháp ĐÃ đăng không tạo tài liệu thứ hai', async () => {
    const before = await prisma.doc.count({ where: { slug: { startsWith: SLUG } } })
    const published = await prisma.contentDraft.findFirst({
      where: { slug: SLUG, status: 'PUBLISHED' },
    })
    await onPublishRequested(published.id)
    const after = await prisma.doc.count({ where: { slug: { startsWith: SLUG } } })
    expect(after).toBe(before)
  }, 30000)
})

export {}
