// Bất biến của chế độ gộp. Cái đắt nhất ở đây là test đầu tiên:
//
// Nếu ai đó "đơn giản hoá" src/index.js thành `root.use(app)` ba lần, request
// /api/trust/* sẽ đi vào app content trước và dính cổng chặn INTERNAL_API_TOKEN
// của nó. Huy hiệu SVG mà site khách nhúng sẽ im lặng trả 401 — không có ngoại
// lệ nào ném ra, không log nào đỏ, chỉ là huy hiệu biến mất trên site người ta.
//
// Đặt biến TRƯỚC khi require app: giá trị được đọc lúc module nạp.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.INTERNAL_API_TOKEN = 'test-token'
const request = require('supertest')
const { app, SERVICES } = require('../src/index')

const { signIdentity } = require('@tsudev/identity-token')

/** Header Authorization như BFF sẽ gửi — thay cho header `x-dev-user` đã gỡ. */
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

afterAll(() => {
  delete process.env.INTERNAL_API_TOKEN
})

describe('backend-bundle — endpoint công khai của trust không bị cổng chặn của content nuốt', () => {
  test('huy hiệu SVG trả 200 dù INTERNAL_API_TOKEN đang bật', async () => {
    const res = await request(app).get('/api/trust/seal/khong-co-serial-nay.svg')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/)
  })

  test('JWKS trả 200 dù INTERNAL_API_TOKEN đang bật', async () => {
    const res = await request(app).get('/.well-known/tsudev-trust-jwks.json')
    expect(res.status).toBe(200)
  })

  test('thư mục chứng chỉ công khai không đòi x-internal-token', async () => {
    const res = await request(app).get('/api/trust/directory')
    expect(res.status).not.toBe(401)
  })
})

describe('backend-bundle — cổng chặn của content và storage vẫn nguyên vẹn', () => {
  test('/api/posts thiếu x-internal-token ⇒ 401', async () => {
    const res = await request(app)
      .get('/api/posts')
      .set(await asUser('tester'))
    expect(res.status).toBe(401)
  })

  test('/api/posts đúng token ⇒ không còn 401 vì token', async () => {
    const res = await request(app)
      .get('/api/posts')
      .set('x-internal-token', 'test-token')
      .set(await asUser('tester'))
    expect(res.status).not.toBe(401)
  })

  test('/api/presign thiếu x-internal-token ⇒ 401', async () => {
    const res = await request(app).get('/api/presign')
    expect(res.status).toBe(401)
  })
})

describe('backend-bundle — điều phối và health', () => {
  test('/health trả 200 và kể tên đủ bốn service', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.bundled).toEqual(['content', 'storage', 'trust', 'identity'])
  })

  test('đường dẫn không thuộc bảng sở hữu ⇒ 404, không rơi nhầm vào service nào', async () => {
    const res = await request(app).get('/api/khong-ai-so-huu')
    expect(res.status).toBe(404)
  })

  test('tiền tố so khớp theo ranh giới đoạn, không nuốt tên dài hơn', async () => {
    // '/api/postsomething' KHÔNG được coi là thuộc content chỉ vì bắt đầu bằng
    // '/api/posts'. Nếu bảng dùng startsWith trần thì đây là 401 (dính cổng
    // chặn của content) chứ không phải 404.
    const res = await request(app).get('/api/postsomething')
    expect(res.status).toBe(404)
  })

  test('bảng sở hữu không có tiền tố nào trùng nhau giữa hai service', () => {
    const seen = new Map()
    SERVICES.forEach((s: { name: string; prefixes: string[] }) =>
      s.prefixes.forEach((p) => {
        expect(seen.has(p)).toBe(false)
        seen.set(p, s.name)
      })
    )
  })
})

// Đánh dấu tệp này là MODULE. Không có import/export thì TypeScript coi nó là
// script toàn cục, và các biến top-level (`request`, `app`) của những tệp test
// khác nhau sẽ đụng tên nhau. Không đổi gì lúc chạy.
export {}
