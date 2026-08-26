// Xác minh tài khoản bằng MÃ SỐ (VERIFY-CODE, 26/08/2026).
//
// Đợt này bỏ việc tin cờ `emailVerified` của Google/GitHub. Cờ đó nói NHÀ CUNG
// CẤP tin địa chỉ đó; nó không nói người vừa đăng nhập đọc được hộp thư đó ngay
// bây giờ - mà "đọc được ngay bây giờ" mới là thứ mọi đường khôi phục tài khoản
// dựa vào. Nay ai cũng đi qua cùng một cửa: bấm nút, nhận mã, gõ lại mã.
//
// Bất biến khoá ở đây - BA lớp chặn, và chúng chặn ba thứ KHÁC NHAU:
//   (1) Cooldown: hai lần gửi liên tiếp ⇒ 429 `too_soon` kèm `retryAfterSec`.
//   (2) Trần ngày: quá `VERIFY_CODE_DAILY_CAP` ⇒ 429 `daily_cap`.
//   (3) Trần lần GÕ SAI: đây là lớp DUY NHẤT chặn được kiểu tấn công không cần
//       gửi thêm mã nào - chỉ gõ liên tục vào một mã đang có hiệu lực. Hai lớp
//       trên hoàn toàn vô dụng với hướng đó, và một mã 6 số chỉ có 10^6 khả năng.
//   (4) Mã của người này KHÔNG mở được tài khoản người kia.
//   (5) Dùng một lần thật: gõ đúng lần hai ⇒ không còn mã.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.VERIFY_CODE_COOLDOWN_MS = '60000'
process.env.VERIFY_CODE_DAILY_CAP = '3'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')
const { issueVerifyCode, MAX_CODE_ATTEMPTS, generateNumericCode } = require('../src/tokens')

const stamp = Date.now()
const U_A = `test-vc-a-${stamp}`
const U_B = `test-vc-b-${stamp}`
const USERS = [U_A, U_B]

/// `sub` là USERNAME, không phải id - `lookupUser` của @tsudev/auth tra theo
/// `preferred_username || sub` rồi `findUnique({ where: { username } })`. Ký
/// bằng id thì mọi lời gọi trả 401 mà không nói vì sao; đã trả giá một lần.
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity(
    { sub, sv: 0 },
    process.env.INTERNAL_IDENTITY_SECRET
  )}`,
})

const authPost = async (path: string, sub: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post(`/api/identity/${path}`)
    .set(await asUser(sub))
    .send(body)

let idA: string
let idB: string

const clearThrottles = async (userId: string) => {
  // Dọn CẢ hai lớp chặn: token mang cooldown, SecurityEvent mang trần ngày.
  await prisma.authToken.deleteMany({ where: { userId, purpose: 'EMAIL_VERIFY_CODE' } })
  await prisma.securityEvent.deleteMany({ where: { userId, type: 'verify_code_sent' } })
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  const [a, b] = await Promise.all([
    prisma.user.create({
      data: { username: U_A, email: `${U_A}@tsudev.local`, role: 'MEMBER' },
    }),
    prisma.user.create({
      data: { username: U_B, email: `${U_B}@tsudev.local`, role: 'MEMBER' },
    }),
  ])
  idA = a.id
  idB = b.id
}, 30000)

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { in: USERS } } })
  await prisma.$disconnect()
})

beforeEach(async () => {
  await clearThrottles(idA)
  await clearThrottles(idB)
  await prisma.user.updateMany({
    where: { id: { in: [idA, idB] } },
    data: { emailVerifiedAt: null },
  })
})

describe('mã 6 số', () => {
  test('sinh bằng CSPRNG và luôn đủ 6 chữ số', () => {
    for (let i = 0; i < 200; i++) expect(generateNumericCode()).toMatch(/^\d{6}$/)
    // Không kiểm được "ngẫu nhiên" bằng test, nhưng kiểm được là nó KHÔNG kẹt ở
    // một giá trị - đó là dạng hỏng thật sự sẽ xảy ra nếu ai đó thay nguồn.
    const seen = new Set(Array.from({ length: 50 }, () => generateNumericCode()))
    expect(seen.size).toBeGreaterThan(40)
  })
})

describe('gửi mã', () => {
  test('gửi được, và trả về hạn dùng + số lượt còn lại trong ngày', async () => {
    const res = await authPost('verify/code/send', U_A)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.ttlMinutes).toBe(10)
    expect(res.body.remainingToday).toBe(2) // cap=3, vừa dùng 1
    const row = await prisma.authToken.findFirst({
      where: { userId: idA, purpose: 'EMAIL_VERIFY_CODE' },
    })
    expect(row).not.toBeNull()
    // DB giữ BĂM, không giữ mã. Rò một bản sao DB không được thành khả năng
    // xác minh hộ người khác.
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('LỚP 1 - gửi hai lần liên tiếp ⇒ 429 kèm số giây phải đợi', async () => {
    expect((await authPost('verify/code/send', U_A)).status).toBe(200)
    const second = await authPost('verify/code/send', U_A)
    expect(second.status).toBe(429)
    expect(second.body.error).toBe('too_soon')
    expect(second.body.retryAfterSec).toBeGreaterThan(0)
  })

  test('LỚP 2 - quá trần ngày ⇒ 429 daily_cap', async () => {
    // Rải đều cả ngày thì lách được cooldown; trần ngày là thứ chặn hướng đó.
    // Mô phỏng bằng cách xoá token (hết cooldown) mà GIỮ nhật ký (đếm trần).
    for (let i = 0; i < 3; i++) {
      expect((await authPost('verify/code/send', U_A)).status).toBe(200)
      await prisma.authToken.deleteMany({ where: { userId: idA, purpose: 'EMAIL_VERIFY_CODE' } })
    }
    const over = await authPost('verify/code/send', U_A)
    expect(over.status).toBe(429)
    expect(over.body.error).toBe('daily_cap')
    expect(over.body.cap).toBe(3)
  })

  test('đã xác minh rồi thì không gửi nữa', async () => {
    await prisma.user.update({ where: { id: idA }, data: { emailVerifiedAt: new Date() } })
    const res = await authPost('verify/code/send', U_A)
    expect(res.body.alreadyVerified).toBe(true)
    const row = await prisma.authToken.findFirst({
      where: { userId: idA, purpose: 'EMAIL_VERIFY_CODE' },
    })
    expect(row).toBeNull()
  })
})

describe('gõ mã', () => {
  test('mã đúng ⇒ tài khoản được đánh dấu đã xác minh', async () => {
    const code = await issueVerifyCode(idA)
    const res = await authPost('verify/code/confirm', U_A, { code: code.raw })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const row = await prisma.user.findUnique({ where: { id: idA } })
    expect(row.emailVerifiedAt).not.toBeNull()
  })

  test('nhận cả mã dán kèm khoảng trắng', async () => {
    const code = await issueVerifyCode(idA)
    const spaced = `${code.raw.slice(0, 3)} ${code.raw.slice(3)}`
    expect((await authPost('verify/code/confirm', U_A, { code: spaced })).status).toBe(200)
  })

  test('LỚP 3 - gõ sai quá số lần cho phép ⇒ mã chết, KHÔNG cần gửi thêm mã nào', async () => {
    const code = await issueVerifyCode(idA)
    const wrong = code.raw === '000000' ? '111111' : '000000'

    for (let i = 1; i <= MAX_CODE_ATTEMPTS; i++) {
      const r = await authPost('verify/code/confirm', U_A, { code: wrong })
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('wrong_code')
      expect(r.body.attemptsLeft).toBe(MAX_CODE_ATTEMPTS - i)
    }

    const blocked = await authPost('verify/code/confirm', U_A, { code: wrong })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toBe('too_many_attempts')

    // Và mã ĐÚNG cũng không dùng được nữa - nếu không thì trần lần gõ chỉ là
    // một gờ giảm tốc, kẻ tấn công cứ gõ tiếp là qua.
    const withRight = await authPost('verify/code/confirm', U_A, { code: code.raw })
    expect(withRight.status).toBe(429)
    const row = await prisma.user.findUnique({ where: { id: idA } })
    expect(row.emailVerifiedAt).toBeNull()
  })

  test('LỚP 4 - mã của người khác KHÔNG mở được tài khoản mình', async () => {
    const codeB = await issueVerifyCode(idB)
    const res = await authPost('verify/code/confirm', U_A, { code: codeB.raw })
    expect(res.status).toBe(400)
    const a = await prisma.user.findUnique({ where: { id: idA } })
    expect(a.emailVerifiedAt).toBeNull()
    // Và mã của B vẫn còn nguyên cho chính B dùng.
    const b = await authPost('verify/code/confirm', U_B, { code: codeB.raw })
    expect(b.status).toBe(200)
  })

  test('LỚP 5 - dùng một lần thật', async () => {
    const code = await issueVerifyCode(idA)
    expect((await authPost('verify/code/confirm', U_A, { code: code.raw })).status).toBe(200)
    await prisma.user.update({ where: { id: idA }, data: { emailVerifiedAt: null } })
    const again = await authPost('verify/code/confirm', U_A, { code: code.raw })
    expect(again.status).toBe(400)
    expect(again.body.error).toBe('no_code')
  })

  test('mã hết hạn ⇒ từ chối', async () => {
    await issueVerifyCode(idA)
    await prisma.authToken.updateMany({
      where: { userId: idA, purpose: 'EMAIL_VERIFY_CODE' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await authPost('verify/code/confirm', U_A, { code: '123456' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('expired')
  })

  test('mã sai định dạng bị chặn TRƯỚC khi chạm database', async () => {
    for (const bad of ['', 'abcdef', '12345', '1234567']) {
      const r = await authPost('verify/code/confirm', U_A, { code: bad })
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('bad_code')
    }
  })

  test('chưa đăng nhập ⇒ 401 ở cả hai đường', async () => {
    expect((await request(app).post('/api/identity/verify/code/send').send({})).status).toBe(401)
    expect(
      (await request(app).post('/api/identity/verify/code/confirm').send({ code: '123456' })).status
    ).toBe(401)
  })
})
