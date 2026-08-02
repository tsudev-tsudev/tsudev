// Enable development bypass + role enforcement for tests
process.env.AUTH_DEV_BYPASS = 'true'
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
