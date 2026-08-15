// Enable development bypass + role enforcement for tests
process.env.AUTH_DEV_BYPASS = 'true'
// Không phụ thuộc thứ tự file test: cổng chặn internal-token phải tắt ở đây.
delete process.env.INTERNAL_API_TOKEN
process.env.REQUIRE_ROLE_ENFORCEMENT = 'true'
process.env.CONTENT_READ_ROLE = 'content:read'
const request = require('supertest')
const { app } = require('../src/index')

describe('content-service auth enforcement (dev bypass + role)', () => {
  test('GET /api/posts accepts dev user with correct role', async () => {
    const res = await request(app)
      .get('/api/posts')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'content:read')
    expect(res.status).toBe(200)
  })

  test('GET /api/posts rejects dev user without role', async () => {
    const res = await request(app).get('/api/posts').set('x-dev-user', 'tester')
    expect(res.status).toBe(403)
  })
})

// Đánh dấu tệp này là MODULE. Không có import/export thì TypeScript coi nó là
// script toàn cục, và các biến top-level (`request`, `app`) của những tệp test
// khác nhau sẽ đụng tên nhau. Không đổi gì lúc chạy.
export {}
