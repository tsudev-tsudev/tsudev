// Nội dung công khai phải đọc được KHI KHÔNG CÓ danh tính nào.
//
// Đây là ca đã làm production trống trơn: blog/tài liệu/dự án là nội dung công
// khai, nhưng BFF của Next gọi SSR không mang Bearer JWT — khách vãng lai không
// có phiên nào cả. Chặn cứng `/api` bằng auth thì mọi lời gọi trả 401 và
// `lib/api.ts` nuốt thành [], nên TRIỆU CHỨNG LÀ TRANG TRỐNG chứ không phải
// trang lỗi. Không test nào bắt được, vì local khi ấy luôn bật AUTH_DEV_BYPASS —
// cờ đó nay đã bị gỡ hẳn, và dev chạy đúng đường mà production chạy.
//
// Đặt biến TRƯỚC khi require app: giá trị đọc lúc module nạp.
process.env.INTERNAL_API_TOKEN = 'test-token'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
const request = require('supertest')
const { app } = require('../src/index')

const withToken = (path: string) => request(app).get(path).set('x-internal-token', 'test-token')

afterAll(() => {
  delete process.env.INTERNAL_API_TOKEN
})

describe('content-service — đọc công khai không cần JWT', () => {
  test.each(['/api/posts', '/api/docs', '/api/projects'])('GET %s ⇒ 200', async (p) => {
    const res = await withToken(p)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('vẫn phải qua cổng x-internal-token', async () => {
    const res = await request(app).get('/api/posts')
    expect(res.status).toBe(401)
  })
})

describe('content-service — đường ghi vẫn đóng', () => {
  test('GET /api/admin/projects không danh tính ⇒ 401', async () => {
    const res = await withToken('/api/admin/projects')
    expect(res.status).toBe(401)
  })

  test('POST /api/admin/projects không danh tính ⇒ 401', async () => {
    const res = await request(app)
      .post('/api/admin/projects')
      .set('x-internal-token', 'test-token')
      .send({ slug: 'khong-duoc-tao', name: 'x' })
    expect(res.status).toBe(401)
  })

  test('Bearer token rác vẫn bị từ chối — xác thực tuỳ chọn KHÔNG có nghĩa là bỏ qua', async () => {
    const res = await withToken('/api/posts').set('authorization', 'Bearer rac-ruoi')
    expect(res.status).toBe(401)
  })
})

// Đánh dấu tệp này là MODULE. Không có import/export thì TypeScript coi nó là
// script toàn cục, và các biến top-level (`request`, `app`) của những tệp test
// khác nhau sẽ đụng tên nhau. Không đổi gì lúc chạy.
export {}
