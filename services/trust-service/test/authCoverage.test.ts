// Độ phủ của auth theo nhánh — bất biến khó thấy nhất của trust-service.
//
// Service này KHÔNG gắn auth cho cả `/api` (khác content và storage): huy hiệu
// SVG, trang xác minh, thư mục và JWKS phải công khai vì chúng được trình duyệt
// của khách trên site BÊN THỨ BA tải về, không kèm token nào.
//
// Cái giá: mặc định là CÔNG KHAI. Thêm một route riêng tư mà quên khai nhánh của
// nó trong AUTH_PREFIXES thì nó lặng lẽ mở ra, và không có gì báo lỗi — CLAUDE.md
// liệt kê đúng cái bẫy này. Test dưới đây bắt mọi route mới không thuộc hai nhóm
// đã được quyết định, nên người thêm route buộc phải chọn một bên.
process.env.INTERNAL_IDENTITY_SECRET = 'khoa-test-du-dai-cho-hmac-256-bit!!'
delete process.env.INTERNAL_API_TOKEN

const { app, AUTH_PREFIXES } = require('../src/index')

/**
 * Đường dẫn CỐ Ý công khai. Thêm vào đây là một quyết định, không phải một dòng
 * cấu hình: mọi thứ ở đây phục vụ được cho người chưa đăng nhập.
 */
const PUBLIC_PATHS = [
  '/health',
  '/.well-known/tsudev-trust-jwks.json',
  '/api/trust/programs',
  '/api/trust/verify',
  '/api/trust/directory',
  '/api/trust/seal',
  '/api/trust/profile',
  '/api/trust/jwks',
]

type Layer = { route?: { path?: string } }

function registeredPaths(): string[] {
  const stack = (app as { _router?: { stack: Layer[] } })._router?.stack ?? []
  return stack.map((l) => l.route?.path).filter((p): p is string => typeof p === 'string')
}

const coveredByAuth = (path: string) =>
  AUTH_PREFIXES.some((p: string) => path === p || path.startsWith(p + '/'))

const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))

describe('trust-service: mọi route phải nằm ở một bên rõ ràng của ranh giới auth', () => {
  test('có route được đăng ký (test tự bảo vệ khỏi việc đọc rỗng)', () => {
    expect(registeredPaths().length).toBeGreaterThan(10)
  })

  test('không route nào vừa không công khai vừa không được auth phủ', () => {
    const orphans = registeredPaths().filter((p) => !coveredByAuth(p) && !isPublic(p))
    expect(orphans).toEqual([])
  })

  test('AUTH_PREFIXES không có tiền tố nào nuốt tiền tố công khai', () => {
    const swallowed = PUBLIC_PATHS.filter((pub) => coveredByAuth(pub))
    expect(swallowed).toEqual([])
  })

  test('so khớp theo ranh giới đoạn, không phải startsWith trần', () => {
    // '/api/trust/orgs' không được nuốt '/api/trust/orgsomething'
    expect(coveredByAuth('/api/trust/orgsomething')).toBe(false)
    expect(coveredByAuth('/api/trust/orgs/abc')).toBe(true)
  })
})

export {}
