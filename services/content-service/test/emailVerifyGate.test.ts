// Cổng ân hạn xác minh email trên đường GHI Post.
//
// Bất biến: đăng bài (tạo/sửa/xoá) đòi email ĐỦ DÙNG - đã xác minh, HOẶC chưa xác
// minh nhưng còn trong ân hạn 7 ngày kể từ khi tạo tài khoản. Quá ân hạn mà chưa
// xác minh ⇒ 403 email_unverified. Đường ĐỌC (list/get) KHÔNG bị chặn: xem bản
// nháp của mình khi chưa xác minh là vô hại.
//
// Ngưỡng ân hạn sống ở @tsudev/types (emailUsable), dùng chung với cổng nâng vai
// trò của auth-service - test này khoá hành vi phía content-service.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const stamp = Date.now()
const A_VERIFIED = `test-ev-verified-${stamp}`
const A_GRACE = `test-ev-grace-${stamp}`
const A_EXPIRED = `test-ev-expired-${stamp}`

const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

// upsert cho phép đặt emailVerifiedAt và createdAt lúc create; update dọn lại
// đúng trạng thái nếu lượt trước bỏ dở, để rerun an toàn.
const mkUser = (username: string, emailVerifiedAt: Date | null, createdAt: Date) =>
  prisma.user.upsert({
    where: { username },
    update: { role: 'AUTHOR', emailVerifiedAt },
    create: {
      username,
      email: `${username}@tsudev.local`,
      displayName: username,
      role: 'AUTHOR',
      emailVerifiedAt,
      createdAt,
    },
  })

let expiredId: string
const EXPIRED_POST_SLUG = `bai-cua-expired-${stamp}`

beforeAll(async () => {
  const [, , exp] = await Promise.all([
    mkUser(A_VERIFIED, new Date(), EIGHT_DAYS_AGO),
    mkUser(A_GRACE, null, new Date()),
    mkUser(A_EXPIRED, null, EIGHT_DAYS_AGO),
  ])
  expiredId = exp.id
  // Seed một bài SẴN CÓ cho tài khoản quá hạn (đường route bị chặn nên phải nạp
  // thẳng qua prisma) để kiểm patch/delete cũng bị chặn.
  await prisma.post.create({
    data: {
      slug: EXPIRED_POST_SLUG,
      title: 'Bài cũ của expired',
      contentMd: 'x',
      authorId: expiredId,
      authoredByAgentId: null,
      published: true,
    },
  })
})

afterAll(async () => {
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL tsudev.allow_hard_delete = 'on'`),
    prisma.$executeRawUnsafe(
      `DELETE FROM "Post" WHERE "authorId" IN (SELECT id FROM "User" WHERE username IN ($1,$2,$3))`,
      A_VERIFIED,
      A_GRACE,
      A_EXPIRED
    ),
  ])
  await prisma.user.deleteMany({
    where: { username: { in: [A_VERIFIED, A_GRACE, A_EXPIRED] } },
  })
  await prisma.$disconnect()
})

describe('tạo bài: cổng ân hạn xác minh', () => {
  test('đã xác minh ⇒ 201', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A_VERIFIED))
      .send({ slug: `ev-verified-${stamp}`, title: 'Bài verified', contentMd: 'x' })
    expect(res.status).toBe(201)
  })

  test('chưa xác minh nhưng CÒN ân hạn ⇒ 201', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A_GRACE))
      .send({ slug: `ev-grace-${stamp}`, title: 'Bài grace', contentMd: 'x' })
    expect(res.status).toBe(201)
  })

  test('chưa xác minh và QUÁ ân hạn ⇒ 403 email_unverified', async () => {
    const res = await request(app)
      .post('/api/author/posts')
      .set(await asUser(A_EXPIRED))
      .send({ slug: `ev-expired-${stamp}`, title: 'Bài expired', contentMd: 'x' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('email_unverified')
  })
})

describe('quá ân hạn: sửa/xoá bị chặn, đọc vẫn được', () => {
  test('PATCH ⇒ 403', async () => {
    const res = await request(app)
      .patch(`/api/author/posts/${EXPIRED_POST_SLUG}`)
      .set(await asUser(A_EXPIRED))
      .send({ title: 'Đổi tiêu đề' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('email_unverified')
  })

  test('DELETE ⇒ 403', async () => {
    const res = await request(app)
      .delete(`/api/author/posts/${EXPIRED_POST_SLUG}`)
      .set(await asUser(A_EXPIRED))
    expect(res.status).toBe(403)
  })

  test('đọc danh sách bài của mình VẪN được (200)', async () => {
    const res = await request(app)
      .get('/api/author/posts')
      .set(await asUser(A_EXPIRED))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('đọc một bài của mình VẪN được (200)', async () => {
    const res = await request(app)
      .get(`/api/author/posts/${EXPIRED_POST_SLUG}`)
      .set(await asUser(A_EXPIRED))
    expect(res.status).toBe(200)
  })
})

export {}
