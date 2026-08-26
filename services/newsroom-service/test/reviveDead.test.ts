// Đường "Hồi sinh việc đã dừng" - vá lỗi bấm nút mà đếm không bao giờ giảm.
//
// Triệu chứng đã đo trên production: bảng điều khiển báo 30 việc đã dừng, bấm
// "Hồi sinh việc đã dừng" bao nhiêu lần thì vẫn 30. Không có gì đỏ lên, vì
// `reviveQuotaCasualties` trả `{revived: 0}` một cách hoàn toàn hợp lệ.
//
// Nguyên nhân: `reclaimStale()` giết sự kiện kẹt ở CLAIMED quá hạn thuê mà
// KHÔNG để lại sự kiện nhật ký nào. `reviveQuotaCasualties` nhận diện nạn nhân
// qua thông điệp lỗi ở ghi chú kèm theo - không có ghi chú thì không bao giờ
// khớp, nên lớp sự kiện đó nằm lại DEAD vĩnh viễn. Mà kẹt ở CLAIMED chính là
// thứ Render restart gây ra, tức là lớp phổ biến nhất chứ không phải hiếm.
//
// Hai điều được khoá ở đây, và chúng phải đi cùng nhau: `reclaimStale` LUÔN để
// lại dấu vết, và `reviveQuotaCasualties` cứu được cả hàng tồn chết trước khi
// có dấu vết đó.
process.env.NODE_ENV = 'test'
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

const { prisma } = require('@tsudev/db')
const { reviveQuotaCasualties, reclaimStale } = require('../src/dispatcher')

const stamp = Date.now()
const MARK = `revive-test-${stamp}`

/// `NewsroomEvent` cũng bị trigger Postgres chặn xoá CỨNG (mã 42501) - giống
/// `Doc` và `ContentDraft`. Đi qua đúng cửa thoát mà chính thông báo lỗi chỉ ra,
/// và cả hai lệnh phải nằm trong CÙNG giao dịch: `SET LOCAL` chỉ sống hết giao
/// dịch, tách ra là câu thứ hai lại bị chặn.
const clean = () =>
  prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(`DELETE FROM "NewsroomEvent" WHERE payload::text LIKE '%${MARK}%'`),
  ])

beforeAll(clean, 30000)
afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

const deadEvent = (over: Record<string, unknown> = {}) =>
  prisma.newsroomEvent.create({
    data: {
      type: 'draft.submitted',
      status: 'DEAD',
      attempts: 3,
      payload: { mark: MARK },
      ...over,
    },
  })

const note = (error: string, type = 'draft.submitted', draftId: string | null = null) =>
  prisma.newsroomEvent.create({
    data: {
      type: 'event.dead',
      status: 'DONE',
      actorKind: 'system',
      draftId,
      payload: { mark: MARK, type, error },
    },
  })

describe('hồi sinh việc đã dừng', () => {
  test('sự kiện DEAD KHÔNG có ghi chú nào vẫn hồi sinh được (hàng tồn trước bản vá)', async () => {
    const ev = await deadEvent()
    const out = await reviveQuotaCasualties()
    expect(out.revived).toBeGreaterThanOrEqual(1)

    const after = await prisma.newsroomEvent.findUnique({ where: { id: ev.id } })
    expect(after.status).toBe('PENDING')
    // Đặt lại số lần thử, nếu không nó chết lại ngay ở nhịp sau.
    expect(after.attempts).toBe(0)
    expect(after.claimedAt).toBeNull()
  })

  test('chết vì LỖI THẬT thì nằm nguyên - đó là toàn bộ lý do hàm này lọc', async () => {
    const ev = await deadEvent({ draftId: null, type: 'review.approved' })
    await note('TypeError: Cannot read properties of undefined', 'review.approved')

    const out = await reviveQuotaCasualties()
    const after = await prisma.newsroomEvent.findUnique({ where: { id: ev.id } })
    expect(after.status).toBe('DEAD')
    expect(out.keptDead).toBeGreaterThanOrEqual(1)
  })

  test('chết vì CẠN HẠN MỨC thì hồi sinh', async () => {
    const ev = await deadEvent({ type: 'draft.claimed' })
    await note('Neuron quota exceeded for account', 'draft.claimed')

    await reviveQuotaCasualties()
    const after = await prisma.newsroomEvent.findUnique({ where: { id: ev.id } })
    expect(after.status).toBe('PENDING')
  })

  test('chết vì BỊ BỎ RƠI thì hồi sinh - dấu vết mới của reclaimStale', async () => {
    const ev = await deadEvent({ type: 'idea.created' })
    await note('bị bỏ rơi ở CLAIMED quá hạn thuê (tiến trình chết giữa chừng)', 'idea.created')

    await reviveQuotaCasualties()
    const after = await prisma.newsroomEvent.findUnique({ where: { id: ev.id } })
    expect(after.status).toBe('PENDING')
  })

  // Cái này là cốt lõi: không có nó thì bản vá chỉ chữa hàng tồn một lần rồi
  // lỗi mọc lại y hệt ở lần Render restart kế tiếp.
  test('reclaimStale ĐỂ LẠI event.dead khi giết sự kiện kẹt ở CLAIMED', async () => {
    const stale = await prisma.newsroomEvent.create({
      data: {
        type: 'draft.submitted',
        status: 'CLAIMED',
        attempts: 3,
        claimedAt: new Date(Date.now() - 60 * 60 * 1000),
        payload: { mark: MARK },
      },
    })

    // Gọi thẳng `reclaimStale` chứ không qua `tick()`: tick thoát sớm khi
    // NEWSROOM_ENABLED chưa bật, và khi bật thì nó còn gọi LLM. Thứ cần khoá ở
    // đây là đúng một hành vi của một hàm.
    await reclaimStale()

    const after = await prisma.newsroomEvent.findUnique({ where: { id: stale.id } })
    expect(after.status).toBe('DEAD')

    const notes = await prisma.newsroomEvent.findMany({
      where: { type: 'event.dead', payload: { path: ['mark'], equals: MARK } },
    })
    const errs = notes.map((n: { payload: { error?: string } }) => String(n.payload.error || ''))
    expect(errs.some((e: string) => /bị bỏ rơi ở CLAIMED/.test(e))).toBe(true)
  })
})
