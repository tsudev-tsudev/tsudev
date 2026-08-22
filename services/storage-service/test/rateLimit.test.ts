// Giới hạn tần suất cho lưu lượng TRỰC TIẾP tới /api của storage.
//
// Presign là đích lạm dụng đắt nhất (ký URL ghi vào object storage). Cùng mô
// hình với content: BFF không chuyển IP client xuống, nên miễn trừ lưu lượng
// mang x-internal-token đúng và chỉ giới hạn lưu lượng trực tiếp theo IP thật.
//
// Đặt biến TRƯỚC khi require app. process.env dùng chung khi --runInBand nên
// trả lại nguyên trạng ở afterAll.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.INTERNAL_API_TOKEN = 'test-token'
process.env.RATE_LIMIT_DIRECT_MAX = '3'
const request = require('supertest')
const { app } = require('../src/index')

afterAll(() => {
  delete process.env.RATE_LIMIT_DIRECT_MAX
  delete process.env.INTERNAL_API_TOKEN
})

describe('storage-service - giới hạn tần suất /api', () => {
  it('lưu lượng TRỰC TIẾP (không token) bị 429 sau khi vượt ngưỡng', async () => {
    let saw429 = false
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/api/__ratelimit_probe__')
      if (res.status === 429) saw429 = true
    }
    expect(saw429).toBe(true)
  })

  it('lưu lượng qua BFF (x-internal-token đúng) được MIỄN TRỪ, không bao giờ 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .get('/api/__ratelimit_probe__')
        .set('x-internal-token', 'test-token')
      expect(res.status).not.toBe(429)
    }
  })
})
