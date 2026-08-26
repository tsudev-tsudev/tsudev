// Giữ tệp là MODULE - xem chú thích ở test/reviveDead.test.ts.
export {}

// Mọi route của toà soạn phải nằm RÕ RÀNG ở một bên ranh giới.
//
// Khuôn lấy từ services/trust-service/test/authCoverage.test.ts, và lý do y hệt:
// service này gắn auth theo NHÁNH chứ không cho cả `/api`. Mặc định của Express
// là công khai, nên thêm một nhánh riêng tư mà quên khai thì nó lộ ra - im lặng.
//
// Ở đây hậu quả nặng hơn trust-service: không có nhánh công khai nào cả. Một
// route lọt lưới là cả bảng điều khiển vận hành mở ra internet.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.NEWSROOM_TICK_TOKEN = 'tick-secret'
const { app, AUTH_PREFIXES, TOKEN_PREFIXES } = require('../src/index')

interface Layer {
  route?: { path: string; methods: Record<string, boolean> }
}

const routes = (): { path: string; method: string }[] => {
  const out: { path: string; method: string }[] = []
  for (const layer of (app._router.stack as Layer[]) || []) {
    if (!layer.route) continue
    for (const m of Object.keys(layer.route.methods)) {
      out.push({ path: layer.route.path, method: m.toUpperCase() })
    }
  }
  return out
}

const covered = (p: string): boolean =>
  [...AUTH_PREFIXES, ...TOKEN_PREFIXES].some((pre: string) => p === pre || p.startsWith(pre + '/'))

describe('ranh giới xác thực của newsroom-service', () => {
  test('mọi route /api đều nằm dưới một tiền tố đã khai', () => {
    const uncovered = routes()
      .filter((r) => r.path.startsWith('/api'))
      .filter((r) => !covered(r.path))
    expect(uncovered).toEqual([])
  })

  test('chỉ /health là công khai', () => {
    const publicRoutes = routes().filter((r) => !r.path.startsWith('/api'))
    expect(publicRoutes.map((r) => r.path).sort()).toEqual(['/health'])
  })

  test('KHÔNG có động từ DELETE ở bất kỳ đâu', () => {
    // Tầng chặn thứ nhất trong ba tầng: agent không có route nào để gọi. Đây là
    // tầng rẻ nhất và mạnh nhất - nó không dựa vào việc kiểm tra nào chạy đúng.
    expect(routes().filter((r) => r.method === 'DELETE')).toEqual([])
  })

  test('/api/newsroom/tick từ chối khi thiếu token', async () => {
    const request = require('supertest')
    expect((await request(app).post('/api/newsroom/tick')).status).toBe(401)
    expect(
      (await request(app).post('/api/newsroom/tick').set('x-newsroom-token', 'sai')).status
    ).toBe(401)
  })

  test('/api/newsroom/state từ chối khi không có danh tính', async () => {
    const request = require('supertest')
    const res = await request(app).get('/api/newsroom/state')
    expect(res.status).toBeGreaterThanOrEqual(401)
    expect(res.status).toBeLessThan(500)
  })
})
