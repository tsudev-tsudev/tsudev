// Khoá object S3 phải do SERVICE cấp, không phải do người gọi chọn.
//
// Trước đợt này, `POST /api/presign` dùng nguyên `key` trong thân request và
// `POST /api/upload` dùng nguyên header `x-filename`. Bất kỳ ai đăng nhập được
// cũng ký được URL ghi đè lên object của người khác.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { app } = require('../src/index')

const { signIdentity } = require('@tsudev/identity-token')

/** Header Authorization như BFF sẽ gửi - thay cho header `x-dev-user` đã gỡ. */
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const USER = 'test-key-member'

beforeAll(async () => {
  await prisma.user.upsert({
    where: { username: USER },
    update: { role: 'MEMBER' },
    create: { username: USER, email: `${USER}@tsudev.local`, displayName: USER, role: 'MEMBER' },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: USER } })
  await prisma.$disconnect()
})

const presign = async (body: Record<string, unknown>) =>
  request(app)
    .post('/api/presign')
    .set(await asUser(USER))
    .send(body)

describe('storage-service: khoá object không do client quyết định', () => {
  test('bỏ qua `key` client gửi - không ghi đè được object có sẵn', async () => {
    const res = await presign({ key: 'anh-dai-dien-cua-nguoi-khac.png', fileName: 'cua-toi.png' })
    expect(res.status).toBe(200)
    expect(res.body.key).not.toBe('anh-dai-dien-cua-nguoi-khac.png')
    expect(res.body.key).toMatch(/^\d{10,}-cua-toi\.png$/)
  })

  test('bỏ thành phần đường dẫn - khoá luôn phẳng', async () => {
    const res = await presign({ fileName: '../../../etc/passwd' })
    expect(res.status).toBe(200)
    expect(res.body.key).not.toContain('/')
    expect(res.body.key).not.toContain('..')
    expect(res.body.key).toMatch(/^\d{10,}-passwd$/)
  })

  test('hai lần ký cùng một tên cho hai khoá khác nhau', async () => {
    const a = await presign({ fileName: 'trung-ten.txt' })
    await new Promise((r) => setTimeout(r, 2))
    const b = await presign({ fileName: 'trung-ten.txt' })
    expect(a.body.key).not.toBe(b.body.key)
  })

  test('tên rỗng vẫn cho khoá dùng được', async () => {
    const res = await presign({ fileName: '' })
    expect(res.status).toBe(200)
    expect(res.body.key).toMatch(/^\d{10,}-upload$/)
  })

  test('ký tự điều khiển và khoảng trắng bị thay, không lọt vào khoá', async () => {
    const res = await presign({ fileName: 'a b\tc\nd.png' })
    expect(res.status).toBe(200)
    expect(res.body.key).toMatch(/^\d{10,}-[A-Za-z0-9._-]+$/)
  })
})

export {}
