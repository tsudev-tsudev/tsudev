// Độ phủ của auth cho trust-service - bất biến khó thấy nhất của service này.
//
// ĐẢO CHIỀU ở đợt "chế độ mời" (docs/refactor-trust-invite-access.md, Phần A):
// trước đây mặc định là CÔNG KHAI và từng nhánh riêng tư phải tự khai trong
// AUTH_PREFIXES, nên quên khai một nhánh là nó lặng lẽ mở ra. Nay cả
// `/api/trust` đóng theo mặc định và chỉ còn một danh sách MIỄN TRỪ ngắn
// (PUBLIC_PATHS). Quên khai một miễn trừ chỉ làm route đó đóng lại - hỏng ồn ào
// chứ không lộ dữ liệu.
//
// Tệp này giữ đúng tính chất mà bản cũ bảo vệ: mọi route buộc phải nằm rõ ràng ở
// MỘT bên của ranh giới, không có mặc định im lặng. Nó kiểm cả hai tầng:
// bảng định tuyến (tĩnh) và phản hồi thật (401/403/200).
process.env.NODE_ENV = 'test'
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const request = require('supertest')
const { prisma } = require('@tsudev/db')
const { signIdentity } = require('@tsudev/identity-token')
const { app, PUBLIC_PATHS, GATED_PREFIX } = require('../src/index')

const MEMBER = 'test-gating-member'
const VIP = 'test-gating-vip'

const asUser = async (sub: string) => ({
  Authorization: `Bearer ${await signIdentity({ sub }, process.env.INTERNAL_IDENTITY_SECRET)}`,
})

type Layer = { route?: { path?: string } }

function registeredPaths(): string[] {
  const stack = (app as { _router?: { stack: Layer[] } })._router?.stack ?? []
  return stack.map((l) => l.route?.path).filter((p): p is string => typeof p === 'string')
}

const underGate = (path: string) => path === GATED_PREFIX || path.startsWith(GATED_PREFIX + '/')

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p: string) => path === p || path.startsWith(p + '/'))

describe('trust-service: bảng định tuyến', () => {
  test('có route được đăng ký (test tự bảo vệ khỏi việc đọc rỗng)', () => {
    expect(registeredPaths().length).toBeGreaterThan(10)
  })

  test('mọi route hoặc nằm dưới cổng, hoặc nằm trong danh sách miễn trừ', () => {
    const orphans = registeredPaths().filter((p) => !underGate(p) && !isPublic(p))
    expect(orphans).toEqual([])
  })

  test('không miễn trừ nào nằm dưới tiền tố được gác', () => {
    // Một miễn trừ đặt nhầm dưới /api/trust sẽ bị cổng nuốt và không bao giờ
    // công khai như người viết tưởng.
    expect(PUBLIC_PATHS.filter((p: string) => underGate(p))).toEqual([])
  })

  test('danh sách miễn trừ đúng bằng hai đường đã quyết định', () => {
    // Danh sách này là quyết định sản phẩm, không phải cấu hình. Thêm một đường
    // vào đó phải làm test này đỏ để người thêm buộc phải giải thích.
    expect([...PUBLIC_PATHS].sort()).toEqual(
      ['/.well-known/tsudev-trust-jwks.json', '/health'].sort()
    )
  })
})

describe('trust-service: phản hồi thật ở ranh giới', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { username: VIP },
      update: { role: 'VIP' },
      create: {
        username: VIP,
        email: `${VIP}@tsudev.local`,
        displayName: VIP,
        role: 'VIP',
      },
    })
    await prisma.user.upsert({
      where: { username: MEMBER },
      update: { role: 'MEMBER' },
      create: {
        username: MEMBER,
        email: `${MEMBER}@tsudev.local`,
        displayName: MEMBER,
        role: 'MEMBER',
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: [VIP, MEMBER] } } })
    await prisma.$disconnect()
  })

  // Năm nhánh này CÔNG KHAI trước đợt chế độ mời. Chúng là toàn bộ phần bề mặt
  // đổi bên, nên chúng là phần dễ hồi quy nhất.
  const CHUYEN_SANG_RIENG = [
    '/api/trust/programs',
    '/api/trust/verify/TSU-CR-2026-000001',
    '/api/trust/directory',
    '/api/trust/seal/khong-co.svg',
    '/api/trust/profile/khong-co',
  ]

  test.each(CHUYEN_SANG_RIENG)('khách chưa đăng nhập nhận 401: %s', async (path) => {
    const res = await request(app).get(path)
    expect(res.status).toBe(401)
  })

  test.each(CHUYEN_SANG_RIENG)('MEMBER nhận 403 (đăng nhập là chưa đủ): %s', async (path) => {
    const res = await request(app)
      .get(path)
      .set(await asUser(MEMBER))
    expect(res.status).toBe(403)
  })

  test('VIP đi qua được cổng', async () => {
    const res = await request(app)
      .get('/api/trust/programs')
      .set(await asUser(VIP))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  test('nhánh quản trị vẫn đòi ADMIN chứ không dừng ở VIP', async () => {
    const res = await request(app)
      .get('/api/trust/admin/summary')
      .set(await asUser(VIP))
    expect(res.status).toBe(403)
  })

  test('JWKS vẫn 200 khi chưa đăng nhập - cố ý nằm ngoài chế độ mời', async () => {
    const res = await request(app).get('/.well-known/tsudev-trust-jwks.json')
    expect(res.status).toBe(200)
    expect(res.body.keys.length).toBeGreaterThan(0)
  })

  test('/health vẫn 200 khi chưa đăng nhập - Render gọi nó không có token', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})

export {}
