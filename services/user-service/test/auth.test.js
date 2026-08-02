// Enable development bypass + role enforcement for tests
process.env.AUTH_DEV_BYPASS = 'true'
process.env.REQUIRE_ROLE_ENFORCEMENT = 'true'
process.env.USER_READ_ROLE = 'user:read'
const request = require('supertest')
const { app } = require('../src/index')

describe('user-service auth enforcement (dev bypass + role)', () => {
  test('GET /api/users accepts dev user with correct role', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'user:read')
    expect(res.status).toBe(200)
  })

  test('GET /api/users rejects dev user without role', async () => {
    const res = await request(app).get('/api/users').set('x-dev-user', 'tester')
    expect(res.status).toBe(403)
  })
})
