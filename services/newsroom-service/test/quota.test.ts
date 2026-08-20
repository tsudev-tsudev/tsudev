// Cạn hạn mức LLM là chuyện BÌNH THƯỜNG, không phải sự cố - và hệ phải xử nó
// như vậy.
//
// Bối cảnh: 20/08/2026 bảng điều khiển /admin/newsroom đầy dòng đỏ
// "AiError: AiError: you have used up your daily free allocation of 10,000
// neurons". Ba khiếm khuyết chồng lên nhau, test này khoá cả ba:
//
//   1. Van ngân sách đọc SỔ CỦA TA (`neuronsUsedToday`, ước lượng từ bảng quy
//      đổi) chứ không phải sổ của Cloudflare. Hai sổ lệch nhau ⇒ van không bao
//      giờ đóng và mọi nhịp còn lại trong ngày đâm vào cùng bức tường.
//   2. Không có trí nhớ: mỗi nhịp lại thử lại lượt gọi chắc chắn hỏng.
//   3. Cạn hạn mức đi chung đường với lỗi thật ⇒ ăn hết ba lần thử của sự kiện
//      ⇒ bản nháp DEAD vĩnh viễn vì một lý do sẽ tự hết lúc 00:00 UTC.
import { readFileSync } from 'fs'
import { join } from 'path'

export {}

const events: { type: string; payload: Record<string, unknown> }[] = []

jest.mock('@tsudev/db', () => ({
  prisma: {
    agentRun: { aggregate: jest.fn(async () => ({ _sum: { neuronsUsed: 10 } })) },
    newsroomEvent: {
      findFirst: jest.fn(async ({ where }: { where: { type: string; payload?: unknown } }) => {
        const p = where.payload as { equals?: string } | undefined
        const hit = events.find(
          (e) => e.type === where.type && (!p?.equals || e.payload.provider === p.equals)
        )
        return hit ? { id: 'ev1' } : null
      }),
      create: jest.fn(async ({ data }: { data: { type: string; payload: never } }) => {
        events.push({ type: data.type, payload: data.payload })
        return { id: 'ev1' }
      }),
    },
  },
}))

const CF_QUOTA_BODY = {
  success: false,
  errors: [
    {
      code: 10000,
      message:
        'AiError: AiError: you have used up your daily free allocation of 10,000 neurons, ' +
        "please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage",
    },
  ],
}

const GEMINI_OK = {
  candidates: [{ content: { parts: [{ text: 'xong' }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
}

const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body } as unknown as Response)

describe('cạn hạn mức Workers AI', () => {
  const OLD_ENV = process.env
  let llm: typeof import('../src/llm')

  beforeEach(() => {
    jest.resetModules()
    events.length = 0
    process.env = {
      ...OLD_ENV,
      CF_ACCOUNT_ID: 'acc',
      CF_AI_TOKEN: 'tok',
      GEMINI_API_KEY: 'gkey',
      NEWSROOM_DAILY_NEURON_BUDGET: '8000',
    }
    llm = require('../src/llm')
  })
  afterAll(() => {
    process.env = OLD_ENV
  })

  test('thông điệp thật của Cloudflare được nhận ra là cạn hạn mức, không phải hỏng', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      String(url).includes('cloudflare') ? reply(429, CF_QUOTA_BODY) : reply(200, GEMINI_OK)
    )
    global.fetch = fetchMock as never

    const out = await llm.complete({ system: 's', user: 'u', maxTokens: 100 })
    expect(out.provider).toBe('gemini')
    expect(out.switched).toBe(true)
    // Ghi lại lời của chính nhà cung cấp - đây là sổ hạn mức THẬT, tách khỏi
    // van ngân sách ước lượng.
    expect(events.some((e) => e.type === 'provider.exhausted')).toBe(true)
  })

  test('nhớ tới 00:00 UTC: nhịp sau KHÔNG gọi lại Workers AI nữa', async () => {
    events.push({ type: 'provider.exhausted', payload: { provider: 'workers-ai' } })
    const fetchMock = jest.fn(async (url: string) => {
      void url
      return reply(200, GEMINI_OK)
    })
    global.fetch = fetchMock as never

    const out = await llm.complete({ system: 's', user: 'u', maxTokens: 100 })
    expect(out.provider).toBe('gemini')
    const hosts = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(hosts.some((h) => h.includes('cloudflare'))).toBe(false)
  })

  test('cạn cả hai đường ⇒ AllProvidersExhaustedError, KHÔNG phải Error thường', async () => {
    delete process.env.GEMINI_API_KEY
    jest.resetModules()
    llm = require('../src/llm')
    global.fetch = jest.fn(async () => reply(429, CF_QUOTA_BODY)) as never

    await expect(llm.complete({ system: 's', user: 'u', maxTokens: 100 })).rejects.toBeInstanceOf(
      llm.AllProvidersExhaustedError
    )
  })

  test('thiếu HẲN cấu hình vẫn là lỗi ồn ào - hoãn tới mai không tự sửa được', async () => {
    delete process.env.CF_ACCOUNT_ID
    delete process.env.CF_AI_TOKEN
    delete process.env.GEMINI_API_KEY
    jest.resetModules()
    llm = require('../src/llm')

    const err = await llm
      .complete({ system: 's', user: 'u', maxTokens: 100 })
      .catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(llm.AllProvidersExhaustedError)
  })
})

// Phần còn lại quét NGUỒN: chạy thật đòi database + hàng đợi thật, mà thứ cần
// khoá ở đây là HÌNH DẠNG của đường xử lý - hoãn chứ không giết.
describe('dispatcher hoãn thay vì giết', () => {
  const SRC = readFileSync(join(__dirname, '../src/dispatcher.ts'), 'utf8')

  test('hỏi nhà cung cấp TRƯỚC khi nhận việc', () => {
    const fn = SRC.slice(SRC.indexOf('export async function tick'))
    const guard = fn.indexOf('anyProviderAvailableToday')
    const claim = fn.indexOf('claimBatch')
    expect(guard).toBeGreaterThan(-1)
    // Nhận rồi mới biết không làm được thì `attempts` đã tăng vô ích - ba nhịp
    // như thế là sự kiện chết vì một lý do hoàn toàn tạm thời.
    expect(guard).toBeLessThan(claim)
  })

  test('cạn hạn mức thì trả sự kiện về PENDING và HOÀN LẠI lần thử', () => {
    const fn = SRC.slice(SRC.indexOf('export async function tick'))
    const branch = fn.slice(fn.indexOf('if (isQuotaHalt(err))'))
    expect(branch).toMatch(/status:\s*'PENDING'/)
    expect(branch).toMatch(/attempts:\s*\{\s*decrement:\s*1\s*\}/)
    // Không được đi tiếp: việc sau cũng gọi mô hình.
    expect(branch.slice(0, branch.indexOf('const msg'))).toContain('break')
  })

  test('không đổ oan cho nguồn tin: lastError chỉ ghi khi KHÔNG phải cạn hạn mức', () => {
    const fn = SRC.slice(SRC.indexOf('async function scanSources'))
    const idx = fn.indexOf('if (isQuotaHalt(err)) throw err')
    expect(idx).toBeGreaterThan(-1)
    expect(idx).toBeLessThan(fn.indexOf('lastError: String'))
  })

  test('có đường hồi sinh cho bản nháp đã chết vì hạn mức', () => {
    expect(SRC).toContain('export async function reviveQuotaCasualties')
    // Lỗi THẬT phải nằm yên ở DEAD - hồi sinh tất tay là xoá mất bằng chứng.
    expect(SRC).toContain('QUOTA_FINGERPRINT')
  })
})
