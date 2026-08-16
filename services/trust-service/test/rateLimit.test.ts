// Bộ giới hạn tần suất cho nhánh công khai của con dấu.
//
// Hai thứ được khoá lại, và cả hai đều là cách bộ giới hạn "chạy được" mà vẫn
// vô dụng:
//
//  1. Đếm theo IP THẬT trong `x-forwarded-for`, không phải `req.ip`. Service
//     luôn đứng sau proxy, nên đếm theo req.ip là gộp cả thế giới vào một xô và
//     ngưỡng chung sẽ chặn oan tất cả.
//  2. Không cho qua 2× ngưỡng ở ranh giới cửa sổ. Cửa sổ cố định ngây thơ cho
//     phép gửi đủ ngưỡng ở cuối cửa sổ này rồi đủ ngưỡng nữa ngay đầu cửa sổ
//     sau — tức là 2× trong một khoảnh khắc.
process.env.NODE_ENV = 'test'

const express = require('express')
const request = require('supertest')
const { createRateLimit } = require('../src/rateLimit')

const appWith = (max: number, windowMs: number) => {
  const app = express()
  app.use(createRateLimit({ name: 'test', windowMs, max }))
  app.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }))
  return app
}

const hit = (app: unknown, ip: string) => request(app).get('/x').set('x-forwarded-for', ip)

describe('giới hạn tần suất', () => {
  test('cho qua tới ngưỡng rồi trả 429', async () => {
    const app = appWith(3, 60_000)
    for (let i = 0; i < 3; i++) expect((await hit(app, '198.51.100.1')).status).toBe(200)
    const blocked = await hit(app, '198.51.100.1')
    expect(blocked.status).toBe(429)
    // Retry-After cho client biết chờ bao lâu — thiếu nó thì client tử tế cũng
    // chỉ biết thử lại ngay, và thành ra tự dội thêm.
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
  })

  test('đếm riêng theo từng IP', async () => {
    const app = appWith(2, 60_000)
    await hit(app, '198.51.100.2')
    await hit(app, '198.51.100.2')
    expect((await hit(app, '198.51.100.2')).status).toBe(429)
    // IP khác vẫn phải đi qua được.
    expect((await hit(app, '198.51.100.3')).status).toBe(200)
  })

  test('lấy IP đầu tiên trong chuỗi x-forwarded-for', async () => {
    const app = appWith(1, 60_000)
    await request(app).get('/x').set('x-forwarded-for', '198.51.100.4, 10.0.0.1')
    // Cùng IP client, proxy khác ⇒ vẫn là một xô.
    const second = await request(app).get('/x').set('x-forwarded-for', '198.51.100.4, 10.0.0.9')
    expect(second.status).toBe(429)
  })

  test('cửa sổ hết hạn thì cho qua lại', async () => {
    const app = appWith(1, 60)
    expect((await hit(app, '198.51.100.5')).status).toBe(200)
    expect((await hit(app, '198.51.100.5')).status).toBe(429)
    await new Promise((r) => setTimeout(r, 140))
    expect((await hit(app, '198.51.100.5')).status).toBe(200)
  })
})

export {}
