require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env — nạp thêm .env ở
// gốc repo. Thiếu bước này thì `npm --workspace ... test` chạy không có
// DATABASE_URL và mọi route chạm DB đều trả 500.
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}
// Initialize optional Sentry instrumentation for server-side
try {
  require('../../../packages/observability/initSentry').initServer({ service: 'content-service' })
} catch (e) {
  // ignore
}
import express from 'express'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import { prisma } from '@tsudev/db'
import { createAuthMiddleware } from '@tsudev/auth'
import type { Prisma, Project, User } from '@prisma/client'
import { hasAtLeastRole } from '@tsudev/types'

type Notifier = { alert: (payload: Record<string, unknown>) => Promise<void> }

/**
 * Đọc một tham số truy vấn dạng CHUỖI.
 *
 * Express khai `req.query.x` là `string | ParsedQs | (string|ParsedQs)[] |
 * undefined` — và nó nói đúng: người gọi điều khiển hình dạng này. `?limit=1`
 * cho chuỗi, `?limit=1&limit=2` cho mảng, `?limit[a]=1` cho object. Bản cũ đưa
 * thẳng giá trị đó vào parseInt, nơi mảng bị ép về chuỗi và object thành NaN —
 * im lặng cả hai trường hợp. Ở đây chỉ chuỗi mới được đi tiếp.
 */
const qStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const qInt = (v: unknown, dflt: number): number => {
  const n = parseInt(qStr(v) ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : dflt
}

let notify: Notifier = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}
const app = express()
app.use(express.json({ limit: '1mb' }))
const port = process.env.PORT || process.env.PORT_CONTENT_SERVICE || 4001
// Mặc định 0.0.0.0 — đừng đổi: bind loopback bên trong container là tự cắt liên
// lạc giữa các container. Máy dev đặt BIND_HOST=127.0.0.1 qua .env (topology).
const bindHost = process.env.BIND_HOST || '0.0.0.0'

// Xác thực dùng chung. Trước đây mỗi service giữ một bản authMiddleware gần
// trùng nhau, và CLAUDE.md phải cảnh báo "đổi hành vi xác thực phải sửa cả ba".
const auth = createAuthMiddleware('content')

// Bọc handler async: Promise bị từ chối mà không có .catch sẽ không bao giờ tới
// được error handler của Express — request treo cho tới khi client bỏ cuộc.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)

// Thẻ tác giả gắn vào bài blog. Không còn `reputation`/`rank`: điểm uy tín
// thành viên là cơ chế của diễn đàn, đã bỏ; uy tín nay là hồ sơ tổ chức gắn
// con dấu (docs/refactor-personal-site.md §3.3).
const authorCard = (
  u: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'> | null | undefined
) =>
  u
    ? {
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
      }
    : null

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'content-service' }))

// Ba service backend nằm trên URL Render CÔNG KHAI — không giấu sau mạng nội bộ
// được, vì frontend-main chạy trên Cloudflare Workers, ngoài mạng Render. Cổng
// chặn này là lớp bù: chỉ ai biết INTERNAL_API_TOKEN mới gọi được /api.
//
// TỰ NGUYỆN: biến không đặt thì middleware là no-op, nên local dev và CI không
// đổi hành vi. Đặt nó ở Render (và cùng giá trị cho biến của frontend) là bật.
// /health đứng ngoài để health check của Render vẫn chạy.
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || ''
app.use('/api', (req, res, next) => {
  if (!INTERNAL_TOKEN) return next()
  if (req.get('x-internal-token') === INTERNAL_TOKEN) return next()
  return res.status(401).json({ error: 'Thiếu hoặc sai x-internal-token' })
})

// XÁC THỰC TUỲ CHỌN, không phải chặn cứng. Gắn req.user nếu người gọi có mang
// danh tính; KHÔNG từ chối nếu không có.
//
// Trước đây đây là `app.use('/api', auth)` — chặn cứng — và nó làm production
// trống trơn: blog, tài liệu và dự án là nội dung CÔNG KHAI, nhưng BFF của Next
// gọi SSR chỉ kèm x-internal-token chứ không có Bearer JWT (không có phiên người
// dùng nào khi khách vãng lai mở trang). Ở local không lộ ra vì AUTH_DEV_BYPASS
// bật; ở production nó trả 401, `lib/api.js` nuốt lỗi thành [] nên TRIỆU CHỨNG
// LÀ TRANG TRỐNG, KHÔNG PHẢI TRANG LỖI.
//
// An toàn vì đường ghi không dựa vào lớp này: mọi route ghi nằm dưới /api/admin
// và tự gọi requireAdmin(), vốn đọc vai trò TỪ DB và trả 401 khi thiếu req.user
// — fail closed. Đây cũng là hình mà storage-service (auth theo từng route) và
// trust-service (auth theo nhánh) vốn đã dùng; content-service là cái lệch.
//
// Token SAI vẫn bị từ chối: chỉ bỏ qua khi người gọi không đưa gì cả.
const optionalAuth: RequestHandler = (req, res, next) => {
  const bearer = /^Bearer /i.test(req.get('authorization') || '')
  const devBypass = process.env.AUTH_DEV_BYPASS === 'true'
  if (!bearer && !devBypass) return next()
  return auth(req, res, next)
}
app.use('/api', optionalAuth)

// ---------------- Blog ----------------
//
// KHÔNG có cổng vai trò ở đây, có chủ đích: blog, tài liệu và dự án là nội dung
// công khai. Bản trước từng gắn một cổng vai trò lên chính đường đọc này, thứ
// chỉ vô hại vì cổng đó khi ấy là no-op — bật lên là blog biến mất khỏi site.
//
// Thứ cần bảo vệ là đường GHI, nằm dưới /api/admin với requireAdmin().
app.get(
  '/api/posts',
  asyncHandler(async (req, res) => {
    const take = Math.min(qInt(req.query.limit, 20), 50)
    const posts = await prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take,
      include: { author: true },
    })
    res.json(
      posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        tags: p.tags,
        createdAt: p.createdAt,
        author: authorCard(p.author),
      }))
    )
  })
)

app.get(
  '/api/posts/:slug',
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({
      where: { slug: req.params.slug },
      include: { author: true },
    })
    if (!post || !post.published) return res.status(404).json({ error: 'Post not found' })
    res.json({ ...post, author: authorCard(post.author) })
  })
)

// ---------------- Docs ----------------
app.get(
  '/api/docs',
  asyncHandler(async (req, res) => {
    const docs = await prisma.doc.findMany({ orderBy: [{ category: 'asc' }, { position: 'asc' }] })
    res.json(docs.map((d) => ({ id: d.id, slug: d.slug, title: d.title, category: d.category })))
  })
)

app.get(
  '/api/docs/:slug',
  asyncHandler(async (req, res) => {
    const doc = await prisma.doc.findUnique({ where: { slug: req.params.slug } })
    if (!doc) return res.status(404).json({ error: 'Doc not found' })
    res.json(doc)
  })
)

// ---------------- Dự án & bản quyền ----------------
//
// Đọc: công khai. Ghi: chỉ ADMIN, kiểm bằng vai trò LƯU TRONG DB qua
// requireAdmin(). Thêm đường ghi mới phải theo đúng khuôn đó.

const PROJECT_KINDS = new Set(['APP', 'TOOL', 'LIBRARY', 'SERVICE'])
const PROJECT_STATUSES = new Set(['WIP', 'BETA', 'STABLE', 'ARCHIVED'])
const COPYRIGHT_STATUSES = new Set(['NONE', 'PENDING', 'REGISTERED'])

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/// Danh tính người gọi, lấy từ payload đã xác thực. Không tự tạo tài khoản như
/// currentUser() cũ của diễn đàn: đường ghi phải khớp một User có thật.
async function actingUser(req: Request): Promise<User | null> {
  const p = req.user
  const username = p?.preferred_username || p?.sub
  if (!username) return null
  return prisma.user.findUnique({ where: { username } })
}

async function requireAdmin(req: Request, res: Response): Promise<User | null> {
  const user = await actingUser(req)
  if (!user) {
    res.status(401).json({ error: 'Bạn cần đăng nhập' })
    return null
  }
  if (!hasAtLeastRole(user.role, 'ADMIN')) {
    res.status(403).json({ error: 'Yêu cầu quyền quản trị' })
    return null
  }
  return user
}

const projectCard = (p: Project) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  summary: p.summary,
  kind: p.kind,
  status: p.status,
  version: p.version,
  releasedAt: p.releasedAt,
  license: p.license,
  copyrightStatus: p.copyrightStatus,
  copyrightNo: p.copyrightNo,
  copyrightAt: p.copyrightAt,
  repoUrl: p.repoUrl,
  homepageUrl: p.homepageUrl,
  trustProgramSlug: p.trustProgramSlug,
  featured: p.featured,
})

/// Nhận và làm sạch phần thân request. Trả { data } hoặc { error }.
type ProjectWritable = Partial<Prisma.ProjectUncheckedCreateInput>
/**
 * Discriminant tường minh (`ok`) chứ không phải "có trường error hay không".
 * Nhờ nó mà sau `if (!parsed.ok) return`, TypeScript BIẾT `parsed.data` có mặt —
 * không còn chỗ nào đọc data của một request đã bị từ chối.
 */
type ReadBodyResult = { ok: true; data: ProjectWritable } | { ok: false; error: string }

function readProjectBody(body: unknown, { partial }: { partial: boolean }): ReadBodyResult {
  const b = (body ?? {}) as Record<string, unknown>
  const data: ProjectWritable = {}
  // Các vòng lặp bên dưới gán theo khoá động. Giữ MỘT tham chiếu lỏng kiểu ở đây
  // thay vì rắc cast khắp nơi — hình dạng trả về cho nơi gọi vẫn là ProjectWritable.
  const loose = data as Record<string, unknown>
  const set = (key: string, value: unknown) => {
    if (value !== undefined) loose[key] = value
  }

  if (!partial || b.slug !== undefined) {
    const slug = (b.slug || '').toString().trim().toLowerCase()
    if (!SLUG_RE.test(slug))
      return { ok: false, error: 'slug phải là chữ thường, số và dấu gạch nối (ví dụ: tsudev-cli)' }
    data.slug = slug
  }
  if (!partial || b.name !== undefined) {
    const name = (b.name || '').toString().trim()
    if (!name) return { ok: false, error: 'Thiếu name' }
    data.name = name
  }
  if (!partial || b.summary !== undefined) {
    const summary = (b.summary || '').toString().trim()
    if (!summary) return { ok: false, error: 'Thiếu summary' }
    data.summary = summary
  }

  // Ba trường enum: Set.has() nhận `unknown` nên bản cũ vẫn "kiểm" đúng lúc chạy,
  // nhưng giá trị đi ra vẫn là `any`. Thu hẹp về string trước khi tra Set thì
  // vừa giữ nguyên hành vi, vừa không để `any` chảy vào tầng Prisma.
  if (b.kind !== undefined) {
    const kind = String(b.kind)
    if (!PROJECT_KINDS.has(kind)) return { ok: false, error: `kind không hợp lệ: ${kind}` }
    data.kind = kind as Prisma.ProjectUncheckedCreateInput['kind']
  }
  if (b.status !== undefined) {
    const status = String(b.status)
    if (!PROJECT_STATUSES.has(status)) return { ok: false, error: `status không hợp lệ: ${status}` }
    data.status = status as Prisma.ProjectUncheckedCreateInput['status']
  }
  if (b.copyrightStatus !== undefined) {
    const cs = String(b.copyrightStatus)
    if (!COPYRIGHT_STATUSES.has(cs))
      return { ok: false, error: `copyrightStatus không hợp lệ: ${cs}` }
    data.copyrightStatus = cs as Prisma.ProjectUncheckedCreateInput['copyrightStatus']
  }

  // REGISTERED mà không có số giấy chứng nhận là một khẳng định pháp lý không có
  // gì chống lưng — chặn ngay ở đây, đừng để nó hiện lên trang công khai.
  const nextCopyright = data.copyrightStatus
  const nextNo = b.copyrightNo === undefined ? undefined : String(b.copyrightNo || '').trim()
  if (nextCopyright === 'REGISTERED' && !partial && !nextNo)
    return { ok: false, error: 'copyrightStatus=REGISTERED thì bắt buộc có copyrightNo' }
  for (const k of [
    'descriptionMd',
    'version',
    'repoUrl',
    'homepageUrl',
    'downloadUrl',
    'license',
  ]) {
    if (b[k] !== undefined) loose[k] = b[k] === null ? null : String(b[k])
  }
  for (const k of ['copyrightNo', 'copyrightOwner', 'trustProgramSlug']) {
    if (b[k] !== undefined) loose[k] = b[k] === null || b[k] === '' ? null : String(b[k])
  }
  for (const k of ['releasedAt', 'copyrightAt']) {
    const v = b[k]
    if (v === undefined) continue
    if (v === null || v === '') {
      set(k, null)
      continue
    }
    // `new Date(x)` nhận cả number lẫn string; mọi thứ khác cho Invalid Date và
    // bị bỏ qua ở dòng dưới, đúng như bản cũ.
    const d = new Date(v as string | number)
    if (Number.isNaN(d.getTime())) continue
    loose[k] = d
  }
  for (const k of ['featured', 'published']) {
    if (b[k] !== undefined) loose[k] = Boolean(b[k])
  }
  if (b.sortOrder !== undefined) data.sortOrder = parseInt(String(b.sortOrder), 10) || 0

  return { ok: true, data }
}

app.get(
  '/api/projects',
  asyncHandler(async (req, res) => {
    const where: Prisma.ProjectWhereInput = { published: true }
    const kind = qStr(req.query.kind)
    const status = qStr(req.query.status)
    const copyright = qStr(req.query.copyright)
    if (kind && PROJECT_KINDS.has(kind)) where.kind = kind as Prisma.ProjectWhereInput['kind']
    if (status && PROJECT_STATUSES.has(status))
      where.status = status as Prisma.ProjectWhereInput['status']
    if (copyright && COPYRIGHT_STATUSES.has(copyright))
      where.copyrightStatus = copyright as Prisma.ProjectWhereInput['copyrightStatus']
    if (req.query.featured === '1') where.featured = true

    const take = Math.min(qInt(req.query.limit, 50), 100)
    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take,
    })
    res.json(projects.map(projectCard))
  })
)

app.get(
  '/api/projects/:slug',
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({ where: { slug: req.params.slug } })
    if (!project || !project.published)
      return res.status(404).json({ error: 'Không tìm thấy dự án' })
    res.json(project)
  })
)

/// Danh sách đầy đủ cho trang quản trị — gồm cả dự án chưa công bố.
app.get(
  '/api/admin/projects',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const projects = await prisma.project.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
    res.json(projects)
  })
)

app.post(
  '/api/admin/projects',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const parsed = readProjectBody(req.body, { partial: false })
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    // `partial: false` ⇒ readProjectBody đã chặn thiếu slug/name/summary bằng
    // `return { error }` ở trên. Đây là chỗ DUY NHẤT khẳng định điều đó.
    const data = parsed.data as Prisma.ProjectUncheckedCreateInput

    const clash = await prisma.project.findUnique({ where: { slug: data.slug } })
    if (clash) return res.status(409).json({ error: `slug "${data.slug}" đã tồn tại` })

    const project = await prisma.project.create({ data })
    res.status(201).json(project)
  })
)

app.patch(
  '/api/admin/projects/:slug',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const current = await prisma.project.findUnique({ where: { slug: req.params.slug } })
    if (!current) return res.status(404).json({ error: 'Không tìm thấy dự án' })

    const parsed = readProjectBody(req.body, { partial: true })
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const data = parsed.data

    // Kiểm chéo với giá trị SAU khi ghép, không phải với phần thân request:
    // PATCH chỉ gửi copyrightStatus vẫn phải thoả ràng buộc "REGISTERED cần số".
    const merged = { ...current, ...data }
    if (merged.copyrightStatus === 'REGISTERED' && !merged.copyrightNo)
      return res
        .status(400)
        .json({ error: 'copyrightStatus=REGISTERED thì bắt buộc có copyrightNo' })

    if (data.slug && data.slug !== current.slug) {
      const clash = await prisma.project.findUnique({ where: { slug: data.slug } })
      if (clash) return res.status(409).json({ error: `slug "${data.slug}" đã tồn tại` })
    }

    const project = await prisma.project.update({ where: { id: current.id }, data })
    res.json(project)
  })
)

app.delete(
  '/api/admin/projects/:slug',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const current = await prisma.project.findUnique({ where: { slug: req.params.slug } })
    if (!current) return res.status(404).json({ error: 'Không tìm thấy dự án' })
    await prisma.project.delete({ where: { id: current.id } })
    res.json({ ok: true })
  })
)

// Cò nổ có chủ đích để kiểm thử đường dây cảnh báo (TSD §6.3).
//
// Chặn ở production: endpoint này không cần đăng nhập, và mỗi lần gọi là một
// cảnh báo thật bắn về Telegram/email. Để mở thì bất kỳ ai cũng làm ngập kênh
// trực của đội — thứ khiến cảnh báo thật bị bỏ qua.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_BOOM === 'true') {
  app.get('/debug/boom', () => {
    throw new Error('Boom! Lỗi chủ động để kiểm thử cảnh báo.')
  })
}

// Express chỉ nhận diện đây là middleware xử lý lỗi khi hàm khai đủ 4 tham số;
// bỏ `next` cho hết lint thì toàn bộ xử lý lỗi im lặng ngừng hoạt động.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[content] error', err instanceof Error ? err.stack || message : err)
  notify.alert({
    service: 'content-service',
    level: 'error',
    message,
    error: err,
    context: `${req.method} ${req.url}`,
  })
  if (res && !res.headersSent) res.status(500).json({ error: message || 'internal error' })
}
app.use(errorHandler)

/** Chuẩn bị trước khi phục vụ. Chạy ở CẢ hai chế độ: tiến trình riêng và nhúng
 *  trong services/backend-bundle. content-service không có gì phải dựng sẵn —
 *  giữ hàm rỗng để ba service có cùng một hợp đồng khởi tạo. */
async function init() {}

async function startServer() {
  await init()
  app.listen(Number(port), bindHost, () =>
    console.log(`content-service listening on ${bindHost}:${port}`)
  )
}

// EMBEDDED=1 do services/backend-bundle đặt trước khi require file này: ở chế
// độ gộp chỉ tiến trình cha mở cổng, và chính nó gọi init(). Mở cổng riêng ở
// đây là tranh cổng với cha.
if (process.env.NODE_ENV !== 'test' && !process.env.EMBEDDED) startServer().catch(() => {})

export { app, startServer, init }
