// Đường NỘP ĐƠN sau khi gỡ cơ chế tín dụng.
//
// `CLAUDE.md` từng có gotcha riêng cho `User.credits`: "trust-service thu phí
// nộp đơn cấp dấu bằng cột này. Xoá theo là hỏng luồng nộp đơn, KHÔNG TEST NÀO
// BẮT ĐƯỢC." Tệp này tồn tại để câu cuối đó không còn đúng.
//
// Ba bất biến được khoá lại, và cả ba đều là cách luồng này hỏng ÂM THẦM:
//
//  1. Nộp đơn thành công mà không cần bất kỳ số dư nào.
//  2. Nộp lại sau NEEDS_INFO vẫn chạy - trước đây nhánh "nộp lại" phụ thuộc
//     `feeCharged > 0` để biết đã thu tiền chưa; cột đó nay không còn.
//  3. Các cổng chặn KHÁC (chưa xác minh tên miền, thiếu bằng chứng, không phải
//     chủ sở hữu) vẫn giữ nguyên - gỡ phí không được nới lỏng thứ gì khác.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const OWNER = 'test-submit-owner'
const OTHER = 'test-submit-other'
// Tài khoản KHÔNG có mã mời. Từ đợt chế độ mời, "đã đăng nhập" không còn đủ để
// chạm vào bất cứ đường nào của Con dấu.
const NGOAI = 'test-submit-ngoai'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

let ownerId: string
let programId: string
let orgId: string
let domainId: string

const clean = async () => {
  await prisma.sealEvidence.deleteMany({
    where: { application: { org: { name: 'Test Submit Co' } } },
  })
  await prisma.sealApplication.deleteMany({ where: { org: { name: 'Test Submit Co' } } })
  await prisma.trustDomain.deleteMany({ where: { org: { name: 'Test Submit Co' } } })
  await prisma.trustOrganization.deleteMany({ where: { name: 'Test Submit Co' } })
  await prisma.sealProgram.deleteMany({ where: { slug: 'test-submit-program' } })
  await prisma.user.deleteMany({ where: { username: { in: [OWNER, OTHER, NGOAI] } } })
}

beforeAll(async () => {
  await clean()
  // VIP chứ không phải MEMBER: bề mặt Con dấu nay đòi vai trò VIP - bậc mà mã
  // mời cấp. Người nộp đơn theo định nghĩa là người đã đổi mã.
  const owner = await prisma.user.create({
    data: { username: OWNER, email: `${OWNER}@tsudev.local`, displayName: OWNER, role: 'VIP' },
  })
  ownerId = owner.id
  await prisma.user.create({
    data: { username: OTHER, email: `${OTHER}@tsudev.local`, displayName: OTHER, role: 'VIP' },
  })
  await prisma.user.create({
    data: { username: NGOAI, email: `${NGOAI}@tsudev.local`, displayName: NGOAI, role: 'MEMBER' },
  })
  // Chương trình KHÔNG khai phí - trường đó đã bị gỡ khỏi schema.
  const program = await prisma.sealProgram.create({
    data: {
      slug: 'test-submit-program',
      name: 'Chương trình thử nộp đơn',
      summary: 'Chỉ dùng cho test',
      criteria: [],
      evidenceSpec: [{ kind: 'doc', label: 'Tài liệu', required: true }],
    },
  })
  programId = program.id
  const org = await prisma.trustOrganization.create({
    data: {
      ownerUserId: owner.id,
      ownerName: OWNER,
      name: 'Test Submit Co',
      contactEmail: 'x@example.com',
    },
  })
  orgId = org.id
  const domain = await prisma.trustDomain.create({
    data: {
      orgId: org.id,
      hostname: 'test-submit.example',
      token: 'tok',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    },
  })
  domainId = domain.id
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

/** Tạo một đơn ở trạng thái DRAFT kèm bằng chứng bắt buộc. */
const makeApplication = async (status: 'DRAFT' | 'NEEDS_INFO' = 'DRAFT') => {
  const a = await prisma.sealApplication.create({
    data: { orgId, domainId, programId, applicantId: ownerId, status, scope: 'Thử' },
  })
  await prisma.sealEvidence.create({
    data: { applicationId: a.id, kind: 'doc', label: 'Tài liệu', url: 'https://example.com/x' },
  })
  return a
}

describe('nộp đơn - không còn thu phí', () => {
  test('nộp thành công mà không cần số dư nào', async () => {
    const a = await makeApplication()
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('SUBMITTED')
    // Phản hồi KHÔNG được còn khái niệm phí.
    expect(res.body.feeCharged).toBeUndefined()

    const after = await prisma.sealApplication.findUnique({ where: { id: a.id } })
    expect(after.status).toBe('SUBMITTED')
    expect(after.submittedAt).not.toBeNull()
  }, 20000)

  // Nhánh "nộp lại" trước đây dựa vào `feeCharged > 0` để biết đã thu tiền chưa.
  // Cột đó không còn, nên nhánh này là chỗ dễ vỡ nhất khi gỡ phí.
  test('nộp lại sau NEEDS_INFO vẫn chạy', async () => {
    const a = await makeApplication('NEEDS_INFO')
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('SUBMITTED')
  }, 20000)

  test('đơn đã nộp thì không nộp lại được', async () => {
    const a = await makeApplication()
    await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    const again = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    expect(again.status).toBe(400)
  }, 20000)
})

describe('chế độ mời: MEMBER không nộp đơn được', () => {
  // Cổng này nằm ở middleware chứ không ở handler, nên nó KHÔNG hiện ra trong
  // mã của đường nộp đơn - đúng loại bảo vệ dễ bị gỡ nhầm khi ai đó dọn
  // middleware. Test giữ nó lại.
  test('tài khoản chưa đổi mã mời nhận 403, không phải 400 hay 200', async () => {
    const a = await makeApplication()
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(NGOAI))
    expect(res.status).toBe(403)

    const after = await prisma.sealApplication.findUnique({ where: { id: a.id } })
    expect(after.status).toBe('DRAFT')
  }, 20000)
})

describe('gỡ phí KHÔNG được nới lỏng cổng chặn nào khác', () => {
  test('người không sở hữu tổ chức bị 403', async () => {
    const a = await makeApplication()
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OTHER))
    expect(res.status).toBe(403)
  }, 20000)

  test('thiếu bằng chứng bắt buộc ⇒ 400', async () => {
    const a = await prisma.sealApplication.create({
      data: { orgId, domainId, programId, applicantId: ownerId, status: 'DRAFT' },
    })
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/bằng chứng/i)
  }, 20000)

  test('tên miền chưa xác minh ⇒ 400', async () => {
    const pending = await prisma.trustDomain.create({
      data: { orgId, hostname: 'chua-xac-minh.example', token: 't2', status: 'PENDING' },
    })
    const a = await prisma.sealApplication.create({
      data: { orgId, domainId: pending.id, programId, applicantId: ownerId, status: 'DRAFT' },
    })
    await prisma.sealEvidence.create({
      data: { applicationId: a.id, kind: 'doc', label: 'Tài liệu', url: 'https://example.com/x' },
    })
    const res = await request(app)
      .post(`/api/trust/applications/${a.id}/submit`)
      .set(await asUser(OWNER))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/tên miền/i)
  }, 20000)

  test('chưa đăng nhập ⇒ 401', async () => {
    const a = await makeApplication()
    const res = await request(app).post(`/api/trust/applications/${a.id}/submit`)
    expect(res.status).toBe(401)
  }, 20000)
})

export {}
