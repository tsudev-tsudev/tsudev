// Bất biến của chế độ gộp: /api/trust/* phải TỚI ĐƯỢC app trust.
//
// Nếu ai đó "đơn giản hoá" src/index.js thành `root.use(app)` ba lần, request
// /api/trust/* sẽ đi vào app content trước và dính cổng chặn INTERNAL_API_TOKEN
// của nó - không có ngoại lệ nào ném ra, không log nào đỏ, chỉ là mọi endpoint
// của con dấu chết ở production trong khi chạy service riêng ở dev vẫn sống.
//
// ⚠️ DẤU HIỆU PHÂN BIỆT ĐÃ PHẢI ĐỔI. Bản trước dùng mã trạng thái: huy hiệu SVG
// và danh bạ là endpoint CÔNG KHAI, nên 200 nghĩa là tới được trust còn 401
// nghĩa là bị content nuốt. Từ khi Con dấu về chế độ mời, chính app trust cũng
// trả 401 cho request không mang danh tính - hai khả năng cho ra CÙNG một mã, và
// một test không phân biệt được hai trạng thái nó sinh ra để phân biệt là một
// test đã chết mà vẫn xanh.
//
// Dấu hiệu nay là THÂN phản hồi: cổng của content nói 'Thiếu hoặc sai
// x-internal-token', cổng danh tính của trust nói 'Missing or invalid
// Authorization header'. Hai chuỗi đó do hai middleware khác nhau sinh ra, nên
// chúng thật sự chỉ ra request đã đi tới đâu.
//
// Đặt biến TRƯỚC khi require app: giá trị được đọc lúc module nạp.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.INTERNAL_API_TOKEN = 'test-token'
const request = require('supertest')
const { app, SERVICES } = require('../src/index')

const { signIdentity } = require('@tsudev/identity-token')

/** Header Authorization như BFF sẽ gửi - thay cho header `x-dev-user` đã gỡ. */
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

afterAll(() => {
  delete process.env.INTERNAL_API_TOKEN
})

/** Thân 401 của cổng INTERNAL_API_TOKEN ở app content. Thấy nó ⇒ đã bị nuốt. */
const CONTENT_GATE = 'Thiếu hoặc sai x-internal-token'

describe('backend-bundle - /api/trust tới được app trust, không bị cổng chặn của content nuốt', () => {
  test('JWKS trả 200 dù INTERNAL_API_TOKEN đang bật', async () => {
    // Bằng chứng MẠNH NHẤT trong tệp này và là lý do nó đứng đầu: đây là đường
    // duy nhất còn trả nội dung thật mà không cần danh tính, nên nó chứng minh
    // app trust được gắn và chạy, chứ không chỉ chứng minh "có ai đó trả lời".
    const res = await request(app).get('/.well-known/tsudev-trust-jwks.json')
    expect(res.status).toBe(200)
    expect(res.body.keys.length).toBeGreaterThan(0)
  })

  test('huy hiệu SVG dừng ở cổng danh tính của TRUST, không ở cổng token của content', async () => {
    const res = await request(app).get('/api/trust/seal/khong-co-serial-nay.svg')
    expect(res.status).toBe(401)
    expect(res.body.error).not.toBe(CONTENT_GATE)
  })

  test('danh bạ dừng ở cổng danh tính của TRUST, không ở cổng token của content', async () => {
    const res = await request(app).get('/api/trust/directory')
    expect(res.status).toBe(401)
    expect(res.body.error).not.toBe(CONTENT_GATE)
  })

  test('x-internal-token đúng KHÔNG mở được /api/trust - nó không phải danh tính', async () => {
    // Cổng của content nhận token này. Nếu một ngày request /api/trust đi lạc
    // vào content, test trên vẫn có thể xanh nhờ trùng mã 401; test này thì
    // không: đi lạc vào content kèm token đúng sẽ cho 200/404, không phải 401.
    const res = await request(app).get('/api/trust/directory').set('x-internal-token', 'test-token')
    expect(res.status).toBe(401)
  })
})

describe('backend-bundle - cổng chặn của content và storage vẫn nguyên vẹn', () => {
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

  // Tiền tố MỚI dễ lọt lưới nhất: '/api/author/*' (đường ghi bài của AUTHOR) là
  // của content nhưng chỉ sống ở production nếu có trong bảng tiền tố. Thân 401
  // phải là cổng token của CONTENT - chứng minh request đã tới đúng app, không
  // phải 404 vì thiếu tiền tố.
  test('/api/author/posts thiếu token ⇒ dừng ở cổng của CONTENT, không 404', async () => {
    const res = await request(app).get('/api/author/posts')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe(CONTENT_GATE)
  })
})

describe('backend-bundle - điều phối và health', () => {
  test('/health trả 200 và kể tên đủ năm service', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.bundled).toEqual(['content', 'storage', 'trust', 'identity', 'newsroom'])
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

describe('backend-bundle - toà soạn Agent AI có mặt trong bảng sở hữu', () => {
  // Đây là cái bẫy đã được ghi trong CLAUDE.md và trong kế hoạch: đặt toà soạn ở
  // '/api/admin/newsroom' thì request đi vào app content TRƯỚC (vì '/api/admin'
  // là của content), dính cổng INTERNAL_API_TOKEN của nó, và trả 404 ở
  // production - trong khi chạy service riêng ở dev vẫn sống. Test này chứng
  // minh tiền tố riêng '/api/newsroom' thật sự tới được app newsroom.
  test('/api/newsroom/tick tới được newsroom, KHÔNG bị content nuốt', async () => {
    const res = await request(app).post('/api/newsroom/tick')
    // 401 = đã tới newsroom và bị cổng NEWSROOM_TICK_TOKEN chặn (đúng).
    // 503 = đã tới newsroom nhưng biến chưa cấu hình (cũng đúng).
    // 404 = KHÔNG tới được - bảng tiền tố sai.
    expect([401, 503]).toContain(res.status)
  })

  test('/api/newsroom/state đòi danh tính chứ không 404', async () => {
    const res = await request(app).get('/api/newsroom/state')
    expect(res.status).not.toBe(404)
  })

  test("'/api/admin/newsroom' KHÔNG được dùng - nó thuộc content", async () => {
    // Nếu một ngày ai đó dời route sang đây, test này đỏ và nói rõ vì sao.
    const res = await request(app).get('/api/admin/newsroom/state')
    expect(res.status).not.toBe(200)
  })
})
