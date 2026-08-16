'use strict'
/**
 * Luật giám sát, kiểm bằng prisma giả — không cần DB.
 *
 * Ba luật đáng kiểm nhất đều là luật "không làm gì": không hạ dấu vì một lần
 * trượt, không tự thu hồi, không lật quyết định của người. Sai ở đây thì hoặc
 * hệ thống hạ dấu oan của khách, hoặc để dấu treo trên site đã mất quyền — cả
 * hai đều chỉ lộ ra khi đã muộn.
 */

// jest.mock được kéo lên đầu file, nên mọi biến factory chạm tới phải mang tiền
// tố `mock` — đó là quy ước Jest dùng để biết biến đã sẵn sàng.
// Mảng rỗng không có chú thích kiểu sẽ được suy ra là `never[]`, và mọi
// `.push()` sau đó là lỗi. Khai kiểu lỏng nhưng tường minh cho bộ giả.
type AnyRecord = Record<string, unknown>
const mockState: {
  checks: AnyRecord[]
  certUpdates: { id: unknown; data: AnyRecord }[]
  audits: AnyRecord[]
  checkHistory: { passed: boolean }[]
  auditHistory: AnyRecord | null
  verifyResult: { ok: boolean; detail: string }
} = {
  checks: [], // TrustCheck đã ghi
  certUpdates: [], // { id, data }
  audits: [], // TrustAuditLog đã ghi
  checkHistory: [], // lịch sử kiểm trả cho consecutiveFailures, mới nhất trước
  auditHistory: null, // bản ghi đình chỉ/khôi phục gần nhất
  verifyResult: { ok: true, detail: 'ok' },
}

jest.mock('@tsudev/db', () => ({
  prisma: {
    trustCheck: {
      create: jest.fn(async ({ data }) => {
        mockState.checks.push(data)
        return data
      }),
      findMany: jest.fn(async () => mockState.checkHistory),
    },
    trustCertificate: {
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ where, data }) => {
        mockState.certUpdates.push({ id: where.id, data })
        return data
      }),
    },
    trustDomain: { update: jest.fn(async ({ data }) => data) },
    trustAuditLog: {
      create: jest.fn(async ({ data }) => {
        mockState.audits.push(data)
        return data
      }),
      findFirst: jest.fn(async () => mockState.auditHistory),
    },
    // recheckOne gói ghi nhận vào transaction dạng mảng promise.
    $transaction: jest.fn(async (ops) => Promise.all(ops)),
  },
}))

jest.mock('../src/domainVerify', () => ({
  verifyDomain: jest.fn(async () => mockState.verifyResult),
}))

const { checks, certUpdates, audits } = mockState

const { runRecheckCycle, config } = require('../src/recheck')

const cert = (over = {}) => ({
  id: 'cert1',
  serial: 'TSU-CV-2026-000001',
  status: 'ACTIVE',
  domain: {
    id: 'dom1',
    hostname: 'khach.example.com',
    method: 'DNS_TXT',
    token: 'tok',
    verifiedAt: new Date(),
  },
  ...over,
})

const run = (c: AnyRecord, opts: Record<string, unknown> = {}) =>
  runRecheckCycle({ certificates: [c], graceFailures: 3, ...opts })

beforeEach(() => {
  checks.length = 0
  certUpdates.length = 0
  audits.length = 0
  mockState.checkHistory = []
  mockState.auditHistory = null
  mockState.verifyResult = { ok: true, detail: 'ok' }
})

describe('giám sát tên miền', () => {
  test('kiểm đạt: ghi nhận, không đụng vào trạng thái chứng chỉ', async () => {
    const s = await run(cert())
    expect(s).toMatchObject({ checked: 1, passed: 1, failed: 0, suspended: 0, resumed: 0 })
    expect(checks[0]!.passed).toBe(true)
    expect(certUpdates.every((u) => !u.data.status)).toBe(true)
    expect(audits).toHaveLength(0)
  })

  test('trượt lần đầu KHÔNG đình chỉ — DNS chập chờn không phải lỗi của khách', async () => {
    mockState.verifyResult = { ok: false, detail: 'Không tìm thấy bản ghi TXT' }
    mockState.checkHistory = [{ passed: false }] // chính lần vừa ghi
    const s = await run(cert())
    expect(s.failed).toBe(1)
    expect(s.suspended).toBe(0)
    expect(s.results[0].action).toBe('grace')
    expect(certUpdates.some((u) => u.data.status === 'SUSPENDED')).toBe(false)
  })

  test('trượt đủ số lần liên tiếp thì tự đình chỉ và ghi nhật ký', async () => {
    mockState.verifyResult = { ok: false, detail: 'Không tìm thấy bản ghi TXT' }
    mockState.checkHistory = [{ passed: false }, { passed: false }, { passed: false }]
    const s = await run(cert())
    expect(s.suspended).toBe(1)
    expect(certUpdates.some((u) => u.data.status === 'SUSPENDED')).toBe(true)
    expect(audits[0]).toMatchObject({
      action: 'CERTIFICATE_SUSPEND',
      actorId: 'system',
      targetLabel: 'TSU-CV-2026-000001',
    })
    // Tự đình chỉ, tuyệt đối không tự thu hồi.
    expect(certUpdates.some((u) => u.data.status === 'REVOKED')).toBe(false)
  })

  test('chuỗi trượt bị cắt bởi một lần đạt thì đếm lại từ đầu', async () => {
    mockState.verifyResult = { ok: false, detail: 'timeout' }
    mockState.checkHistory = [{ passed: false }, { passed: true }, { passed: false }]
    const s = await run(cert())
    expect(s.suspended).toBe(0)
    expect(s.results[0]).toMatchObject({ action: 'grace', streak: 1 })
  })

  test('hệ thống đình chỉ, sau đó kiểm đạt lại thì tự khôi phục', async () => {
    mockState.auditHistory = { action: 'CERTIFICATE_SUSPEND', actorId: 'system' }
    const s = await run(cert({ status: 'SUSPENDED' }))
    expect(s.resumed).toBe(1)
    expect(certUpdates.some((u) => u.data.status === 'ACTIVE')).toBe(true)
    expect(audits[0]!.action).toBe('CERTIFICATE_RESUME')
  })

  test('người đình chỉ thì máy KHÔNG được bật lại dù kiểm đạt', async () => {
    mockState.auditHistory = { action: 'CERTIFICATE_SUSPEND', actorId: 'user-mod-1' }
    const s = await run(cert({ status: 'SUSPENDED' }))
    expect(s.resumed).toBe(0)
    expect(certUpdates.some((u) => u.data.status === 'ACTIVE')).toBe(false)
    expect(audits).toHaveLength(0)
  })

  test('chứng chỉ đã bị đình chỉ mà kiểm vẫn trượt thì không đình chỉ lần nữa', async () => {
    mockState.verifyResult = { ok: false, detail: 'timeout' }
    mockState.checkHistory = [{ passed: false }, { passed: false }, { passed: false }]
    const s = await run(cert({ status: 'SUSPENDED' }))
    expect(s.suspended).toBe(0)
    expect(audits).toHaveLength(0)
  })

  test('một chứng chỉ lỗi không làm chết cả vòng', async () => {
    const { verifyDomain } = require('../src/domainVerify')
    verifyDomain.mockImplementationOnce(async () => {
      throw new Error('DNS chết')
    })
    const s = await runRecheckCycle({
      certificates: [cert({ id: 'a', serial: 'A' }), cert({ id: 'b', serial: 'B' })],
    })
    expect(s.checked).toBe(2)
    expect(s.errors).toBe(1)
    expect(s.passed).toBe(1)
  })
})

describe('cấu hình giám sát', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  test('mặc định hợp lý và bật sẵn', () => {
    delete process.env.TRUST_RECHECK_ENABLED
    delete process.env.TRUST_RECHECK_GRACE_FAILURES
    expect(config()).toMatchObject({ enabled: true, graceFailures: 3 })
  })

  test('giá trị rác không làm hỏng cấu hình', () => {
    process.env.TRUST_RECHECK_GRACE_FAILURES = 'ba'
    process.env.TRUST_RECHECK_BATCH = '-5'
    expect(config()).toMatchObject({ graceFailures: 3, batch: 25 })
  })

  test('tắt được để nhường cho cron bên ngoài', () => {
    process.env.TRUST_RECHECK_ENABLED = 'false'
    expect(config().enabled).toBe(false)
  })
})

// Đánh dấu tệp này là MODULE. Không có import/export thì TypeScript coi nó là
// script toàn cục, và các biến top-level (`request`, `app`) của những tệp test
// khác nhau sẽ đụng tên nhau. Không đổi gì lúc chạy.
export {}
