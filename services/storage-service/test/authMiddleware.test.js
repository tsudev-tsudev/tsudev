// Enable development bypass for tests
process.env.AUTH_DEV_BYPASS = 'true'
process.env.REQUIRE_ROLE_ENFORCEMENT = 'true'
process.env.STORAGE_PRESIGN_ROLE = 'storage:presign'
process.env.STORAGE_UPLOAD_ROLE = 'storage:upload'
const request = require('supertest')
const { app } = require('../src/index')

describe('storage-service auth enforcement (dev bypass)', () => {
  test('GET /api/presign accepts dev user with correct role', async () => {
    const res = await request(app)
      .get('/api/presign')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'storage:presign')
      .query({ fileName: 'foo.txt' })
    expect(res.status).toBe(200)
  })

  test('GET /api/presign rejects dev user without role', async () => {
    const res = await request(app)
      .get('/api/presign')
      .set('x-dev-user', 'tester')
      .query({ fileName: 'foo.txt' })
    expect(res.status).toBe(403)
  })

  test('POST /api/presign accepts dev user with correct role', async () => {
    const res = await request(app)
      .post('/api/presign')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'storage:presign')
      .send({ fileName: 'foo.txt' })
    expect(res.status).toBe(200)
  })

  test('POST /api/upload accepts dev user with correct upload role', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('x-dev-user', 'tester')
      .set('x-dev-roles', 'storage:upload')
      .send(Buffer.from('hello'))
    expect(res.status).toBe(200)
  })

  test('POST /api/upload rejects dev user without upload role', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Content-Type', 'application/octet-stream')
      .set('x-dev-user', 'tester')
      .send(Buffer.from('hello'))
    expect(res.status).toBe(403)
  })
})
