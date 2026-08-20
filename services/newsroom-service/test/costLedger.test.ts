// Chi phí của một lượt chạy HỎNG cũng là chi phí thật.
//
// Bối cảnh: `withRun()` chỉ ghi `neuronsUsed` ở nhánh THÀNH CÔNG, vì con số đó
// đi về theo đường `return` của agent. Nhưng ba trong bốn agent `throw` NGAY
// SAU lượt gọi mô hình (parse JSON hỏng, bài quá ngắn, phán quyết không đọc
// được) - Neuron đã tiêu, sổ ghi 0. Và van ngân sách hằng ngày đọc chính cái sổ
// đó, nên nó đếm thiếu nhiều nhất đúng vào ngày mô hình trả lời tệ nhất.
//
// Test này khoá cách sửa: ghi chi phí tại RANH GIỚI NHÀ CUNG CẤP, vào một sổ
// theo ngữ cảnh, trước khi người gọi có cơ hội ném lỗi.
import { readFileSync } from 'fs'
import { join } from 'path'

export {}

jest.mock('@tsudev/db', () => ({
  prisma: {
    agentRun: { aggregate: jest.fn(async () => ({ _sum: { neuronsUsed: 0 } })) },
    newsroomEvent: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => ({ id: 'e' })),
    },
  },
}))

const CF_OK = {
  success: true,
  result: { response: 'khong-phai-json', usage: { prompt_tokens: 1000, completion_tokens: 2000 } },
}

const CF_QUOTA = {
  success: false,
  errors: [
    { code: 10000, message: 'you have used up your daily free allocation of 10,000 neurons' },
  ],
}

const GEMINI_OK = {
  candidates: [{ content: { parts: [{ text: 'xong' }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
}

const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body } as unknown as Response)

describe('sổ chi phí theo ngữ cảnh', () => {
  const OLD_ENV = process.env
  let llm: typeof import('../src/llm')

  beforeEach(() => {
    jest.resetModules()
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

  test('người gọi ném lỗi SAU lượt gọi mô hình: sổ vẫn giữ nguyên chi phí', async () => {
    global.fetch = jest.fn(async () => reply(200, CF_OK)) as never

    const ledger = llm.newCostLedger()
    await expect(
      llm.withCostLedger(ledger, async () => {
        await llm.complete({ system: 's', user: 'u', maxTokens: 100 })
        // Đúng hình dạng của runWriter/runEditor: gọi xong mới phát hiện đầu ra
        // không dùng được.
        throw new Error('Writer trả về bài rỗng hoặc quá ngắn')
      })
    ).rejects.toThrow('quá ngắn')

    expect(ledger.calls).toBe(1)
    expect(ledger.neurons).toBeGreaterThan(0)
    expect(ledger.inputTokens).toBe(1000)
    expect(ledger.outputTokens).toBe(2000)
    expect(ledger.provider).toBe('workers-ai')
  })

  test('nhiều lượt gọi trong một lượt chạy thì CỘNG DỒN, không ghi đè', async () => {
    global.fetch = jest.fn(async () => reply(200, CF_OK)) as never

    const ledger = llm.newCostLedger()
    await llm.withCostLedger(ledger, async () => {
      await llm.complete({ system: 's', user: 'u', maxTokens: 100 })
      await llm.complete({ system: 's', user: 'u', maxTokens: 100 })
    })

    expect(ledger.calls).toBe(2)
    expect(ledger.inputTokens).toBe(2000)
  })

  test('chuyển sang dự phòng được ghi vào sổ - dashboard đọc từ đây', async () => {
    global.fetch = jest.fn(async (url: string) =>
      String(url).includes('cloudflare') ? reply(429, CF_QUOTA) : reply(200, GEMINI_OK)
    ) as never

    const ledger = llm.newCostLedger()
    await llm.withCostLedger(ledger, () => llm.complete({ system: 's', user: 'u', maxTokens: 100 }))

    expect(ledger.switched).toBe(true)
    expect(ledger.provider).toBe('gemini')
    // Gemini không tính theo Neuron; token thì vẫn phải đếm.
    expect(ledger.inputTokens).toBe(10)
  })

  test('gọi ngoài một lượt chạy agent thì không nổ - script và test vẫn gọi được', async () => {
    global.fetch = jest.fn(async () => reply(200, CF_OK)) as never
    await expect(llm.complete({ system: 's', user: 'u', maxTokens: 100 })).resolves.toHaveProperty(
      'provider',
      'workers-ai'
    )
  })
})

// Quét NGUỒN: chạy thật đòi database. Thứ cần khoá ở đây là HÌNH DẠNG - nhánh
// hỏng của withRun() có ghi số đo hay không.
describe('withRun ghi số đo ở CẢ HAI nhánh', () => {
  const SRC = readFileSync(join(__dirname, '../src/dispatcher.ts'), 'utf8')
  const FN = SRC.slice(SRC.indexOf('async function withRun'), SRC.indexOf('// Săn tin'))

  test('nhánh catch ghi chi phí, không chỉ errorMsg', () => {
    const branch = FN.slice(FN.indexOf('} catch (err) {'))
    expect(branch).toContain('spent()')
    expect(branch).toContain('errorMsg')
  })

  test('số đo lấy từ sổ ngữ cảnh, không từ giá trị agent trả về', () => {
    expect(FN).toContain('withCostLedger(ledger, fn)')
    expect(FN).toContain('neuronsUsed: ledger.neurons')
    // Sổ thứ hai chạy song song là cách hai con số lệch nhau mà không ai biết.
    expect(FN).not.toMatch(/cost\.(neurons|inputTokens)/)
  })

  test('chưa gọi được nhà cung cấp nào thì KHÔNG bịa tên nhà cung cấp', () => {
    // `usedProvider` không nhận null trong schema; bỏ trường đi để cột giữ mặc định.
    expect(FN).toContain('...(ledger.provider ? { usedProvider: ledger.provider } : {})')
  })
})
