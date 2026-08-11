// Cổng chặn x-internal-token (giai đoạn 5). Bốn service backend nằm ở URL Render
// công khai vì frontend-main chạy trên Cloudflare Workers, ngoài mạng Render —
// đây là lớp bù cho việc không giấu được chúng sau mạng nội bộ.
//
// Đặt biến TRƯỚC khi require app: giá trị được đọc lúc module nạp.
process.env.AUTH_DEV_BYPASS = 'true'
process.env.INTERNAL_API_TOKEN = 'test-token'
const request = require('supertest')
const { app } = require('../src/index')

// process.env dùng chung giữa các file test khi jest chạy --runInBand, nên phải
// trả lại nguyên trạng — nếu không, file chạy sau sẽ bị cổng chặn này mà không
// hiểu vì sao 401.
afterAll(() => {
  delete process.env.INTERNAL_API_TOKEN
})

describe('user-service — cổng chặn x-internal-token', () => {
  test('thiếu header ⇒ 401', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'user:read')
    expect(res.status).toBe(401)
  })

  test('sai token ⇒ 401', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-internal-token', 'sai-be-bet')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'user:read')
    expect(res.status).toBe(401)
  })

  test('đúng token ⇒ đi tiếp (không còn 401 vì token)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-internal-token', 'test-token')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'user:read')
    expect(res.status).not.toBe(401)
  })

  test('/health đứng ngoài cổng chặn — health check của Render phải chạy', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})
