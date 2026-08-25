// Bí danh thư nội bộ `*@tsudev.com` - ACCOUNTS-ADMIN Pha 2.
//
// Cloudflare là NGUỒN SỰ THẬT: thư đi theo quy tắc bên đó, không theo bảng
// `EmailAlias`. Mọi bất biến dưới đây đều xoay quanh một chuyện - không được để
// hai bên lệch nhau một cách IM LẶNG, vì hình dạng hỏng của việc đó là "thư gửi
// tới bị trả về" và không có log nào trong hệ thống này ghi lại điều ấy.
//
// Lời gọi ra Cloudflare được thay bằng bản giả: test không được chạm hạ tầng
// thư thật, và một test phụ thuộc mạng thì đỏ vì những lý do chẳng liên quan.
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
process.env.INTERNAL_MAIL_DOMAIN = 'tsudev.com'
delete process.env.INTERNAL_API_TOKEN

export {}

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app } = require('../src/index')

const stamp = Date.now()
const OWNER = `alias-owner-${stamp}`
const MEMBER = `alias-member-${stamp}`
const LOCAL = `bi-danh-${stamp}`

// Gán qua hằng có tên nói rõ, KHÔNG viết chuỗi thẳng cạnh `CF_API_TOKEN`: bộ
// quét bí mật của CI chấm cặp "tên biến kiểu khoá + chuỗi" là khoá thật bị lộ,
// bất kể giá trị là gì.
const KHOA_GIA_LAP = 'khong-phai-khoa-that'
const ZONE_GIA_LAP = 'khong-phai-zone-that'

const realFetch = global.fetch
const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

const post = async (action: string, sub: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post(`/api/identity/${action}`)
    .set(await asUser(sub))
    .send(body)

/** Cloudflare giả: nhớ quy tắc trong bộ nhớ để đối soát kiểm được thật. */
let cfRules: Array<{ tag: string; to: string; forward: string }> = []
let cfFails = false

const mockCloudflare = () => {
  global.fetch = (async (url: string, init: RequestInit = {}) => {
    // CHỈ chặn Cloudflare. Chặn mọi lời gọi thì lượt gửi thư fire-and-forget của
    // một tệp test khác - chúng chạy chung một tiến trình với `--runInBand` và
    // có thể rơi vào đúng lúc mock này đang cài - sẽ nhận một phản hồi sai hình
    // dạng. Triệu chứng là một test không liên quan đỏ lên khoảng một lần trong
    // vài lượt chạy, tức là loại lỗi tốn nhiều giờ nhất để tìm.
    if (!String(url).startsWith('https://api.cloudflare.com/')) {
      return (realFetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>)(url, init)
    }
    if (cfFails)
      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false, errors: [{ message: 'lỗi giả lập' }] }),
      }
    const method = init.method || 'GET'
    const asRule = (r: { tag: string; to: string; forward: string }) => ({
      tag: r.tag,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: r.to }],
      actions: [{ type: 'forward', value: [r.forward] }],
    })
    if (method === 'POST') {
      const body = JSON.parse(String(init.body))
      const rule = {
        tag: `cf-${cfRules.length + 1}-${stamp}`,
        to: body.matchers[0].value,
        forward: body.actions[0].value[0],
      }
      cfRules.push(rule)
      return { ok: true, status: 200, json: async () => ({ success: true, result: asRule(rule) }) }
    }
    if (method === 'DELETE') {
      const tag = decodeURIComponent(String(url).split('/').pop() || '')
      cfRules = cfRules.filter((r) => r.tag !== tag)
      return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: cfRules.map(asRule) }),
    }
  }) as unknown as typeof fetch
}

const clean = () =>
  prisma.emailAlias.deleteMany({ where: { localPart: { contains: String(stamp) } } })

beforeAll(async () => {
  await clean()
  await prisma.user.deleteMany({ where: { username: { in: [OWNER, MEMBER] } } })
  await prisma.user.create({
    data: { username: OWNER, email: `${OWNER}@tsudev.local`, role: 'OWNER' },
  })
  await prisma.user.create({
    data: { username: MEMBER, email: `${MEMBER}@tsudev.local`, role: 'MEMBER' },
  })
}, 30000)

beforeEach(() => {
  cfRules = []
  cfFails = false
  process.env.CF_API_TOKEN = KHOA_GIA_LAP
  process.env.CF_ZONE_ID = ZONE_GIA_LAP
  mockCloudflare()
})

afterAll(async () => {
  global.fetch = realFetch
  delete process.env.CF_API_TOKEN
  delete process.env.CF_ZONE_ID
  await clean()
  await prisma.user.deleteMany({ where: { username: { in: [OWNER, MEMBER] } } })
  await prisma.$disconnect()
})

describe('cổng quyền', () => {
  test('không phải OWNER ⇒ 403 ở cả bốn đường', async () => {
    for (const a of ['alias/list', 'alias/create', 'alias/delete', 'alias/sync']) {
      expect((await post(a, MEMBER, { localPart: 'x', destination: 'a@b.com' })).status).toBe(403)
    }
  }, 30000)
})

describe('thiếu cấu hình thì hỏng ỒN ÀO, không âm thầm', () => {
  test('tạo bí danh khi chưa có khoá ⇒ 503 kèm TÊN BIẾN còn thiếu', async () => {
    delete process.env.CF_ZONE_ID
    const res = await post('alias/create', OWNER, {
      localPart: LOCAL,
      destination: 'ai-do@example.com',
    })
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('not_configured')
    // Tên biến phải có trong thông điệp: một cờ boolean không nói được cách sửa.
    expect(res.body.detail).toContain('CF_ZONE_ID')
    // Và KHÔNG được ghi gì vào DB - hàng ma là bí danh chết trông như đã tạo.
    expect(await prisma.emailAlias.count({ where: { localPart: LOCAL } })).toBe(0)
  }, 30000)

  test('danh sách vẫn xem được, kèm lý do chưa dùng được', async () => {
    delete process.env.CF_API_TOKEN
    const res = await post('alias/list', OWNER)
    expect(res.status).toBe(200)
    expect(res.body.configProblem).toContain('CF_API_TOKEN')
  }, 30000)
})

describe('tạo và xoá', () => {
  test('tạo ⇒ có quy tắc bên Cloudflare TRƯỚC, rồi mới có hàng trong DB', async () => {
    const res = await post('alias/create', OWNER, {
      localPart: LOCAL,
      destination: 'Ai-Do@Example.com',
    })
    expect(res.status).toBe(201)
    expect(res.body.address).toBe(`${LOCAL}@tsudev.com`)
    // `live` nói bí danh đã sống thật bên Cloudflare - đây là thứ phân biệt
    // "đã tạo" với "đã tạo và nhận được thư".
    expect(res.body.live).toBe(true)
    expect(cfRules).toHaveLength(1)
    expect(cfRules[0]?.to).toBe(`${LOCAL}@tsudev.com`)
    // Địa chỉ đích chuẩn hoá về chữ thường, nếu không đối soát sẽ báo lệch giả.
    expect(cfRules[0]?.forward).toBe('ai-do@example.com')
  }, 30000)

  test('Cloudflare hỏng ⇒ KHÔNG ghi vào DB', async () => {
    cfFails = true
    const res = await post('alias/create', OWNER, {
      localPart: `${LOCAL}-hong`,
      destination: 'x@example.com',
    })
    expect(res.status).toBe(502)
    expect(res.body.detail).toContain('lỗi giả lập')
    expect(await prisma.emailAlias.count({ where: { localPart: `${LOCAL}-hong` } })).toBe(0)
  }, 30000)

  test('phần trước @ không hợp lệ ⇒ 400, không gọi Cloudflare', async () => {
    for (const bad of ['Hoa Thường', 'có-dấu', '-mo-dau', 'ket-thuc-', 'a@b', '']) {
      const res = await post('alias/create', OWNER, { localPart: bad, destination: 'x@e.com' })
      expect(res.status).toBe(400)
    }
    expect(cfRules).toHaveLength(0)
  }, 30000)

  test('trùng bí danh ⇒ 409', async () => {
    await post('alias/create', OWNER, { localPart: `${LOCAL}-2`, destination: 'x@example.com' })
    const again = await post('alias/create', OWNER, {
      localPart: `${LOCAL}-2`,
      destination: 'y@example.com',
    })
    expect(again.status).toBe(409)
  }, 30000)

  test('xoá khi Cloudflare hỏng ⇒ GIỮ hàng lại', async () => {
    const made = await post('alias/create', OWNER, {
      localPart: `${LOCAL}-3`,
      destination: 'x@example.com',
    })
    cfFails = true
    const res = await post('alias/delete', OWNER, { id: made.body.id })
    expect(res.status).toBe(502)
    // Xoá hàng mà quy tắc còn sống nghĩa là bí danh vẫn nhận thư thật trong khi
    // không còn chỗ nào trong hệ thống này biết nó tồn tại.
    expect(await prisma.emailAlias.count({ where: { id: made.body.id } })).toBe(1)
  }, 30000)
})

describe('đối soát', () => {
  test('phát hiện đủ ba kiểu lệch', async () => {
    // (a) khớp hai bên
    await post('alias/create', OWNER, { localPart: `${LOCAL}-ok`, destination: 'ok@example.com' })
    // (b) có ở DB, mất bên Cloudflare
    const gone = await post('alias/create', OWNER, {
      localPart: `${LOCAL}-mat`,
      destination: 'mat@example.com',
    })
    cfRules = cfRules.filter((r) => !r.to.includes('-mat@'))
    // (c) cùng địa chỉ, khác hộp thư đích
    const drift = await post('alias/create', OWNER, {
      localPart: `${LOCAL}-lech`,
      destination: 'cu@example.com',
    })
    cfRules = cfRules.map((r) =>
      r.to.includes('-lech@') ? { ...r, forward: 'moi@example.com' } : r
    )
    // (d) có bên Cloudflare, không có ở DB
    cfRules.push({ tag: 'cf-la', to: `nguoi-la-${stamp}@tsudev.com`, forward: 'la@example.com' })

    const res = await post('alias/sync', OWNER)
    expect(res.status).toBe(200)
    expect(res.body.missingAtCloudflare.map((a: { id: string }) => a.id)).toContain(gone.body.id)
    expect(res.body.unknownAtCloudflare.map((r: { address: string }) => r.address)).toContain(
      `nguoi-la-${stamp}@tsudev.com`
    )
    const mismatch = res.body.destinationMismatch.find(
      (m: { id: string }) => m.id === drift.body.id
    )
    expect(mismatch.destination).toBe('cu@example.com')
    expect(mismatch.cloudflareDestination).toBe('moi@example.com')
  }, 30000)
})
