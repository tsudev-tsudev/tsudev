require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env - nạp thêm .env ở
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
import { createAuthMiddleware, lookupUser } from '@tsudev/auth'
import { createRateLimit } from '@tsudev/ratelimit'
import type { Post, Prisma, Project, User } from '@prisma/client'
import { hasAtLeastRole, emailUsable } from '@tsudev/types'
import { buildPostSearch, viNormalizeText } from '@tsudev/search'

type Notifier = { alert: (payload: Record<string, unknown>) => Promise<void> }

/**
 * Đọc một tham số truy vấn dạng CHUỖI.
 *
 * Express khai `req.query.x` là `string | ParsedQs | (string|ParsedQs)[] |
 * undefined` - và nó nói đúng: người gọi điều khiển hình dạng này. `?limit=1`
 * cho chuỗi, `?limit=1&limit=2` cho mảng, `?limit[a]=1` cho object. Bản cũ đưa
 * thẳng giá trị đó vào parseInt, nơi mảng bị ép về chuỗi và object thành NaN -
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

// Header bảo mật cho mọi phản hồi của service. Ba service đều phục vụ cho bên
// thứ ba (huy hiệu SVG, JWKS, trang xác minh), nên `nosniff` ở đây không thừa:
// nó chặn trình duyệt tự diễn giải một phản hồi thành HTML thực thi được.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

const port = process.env.PORT || process.env.PORT_CONTENT_SERVICE || 4001
// Mặc định 0.0.0.0 - đừng đổi: bind loopback bên trong container là tự cắt liên
// lạc giữa các container. Máy dev đặt BIND_HOST=127.0.0.1 qua .env (topology).
const bindHost = process.env.BIND_HOST || '0.0.0.0'

// Xác thực dùng chung. Trước đây mỗi service giữ một bản authMiddleware gần
// trùng nhau, và CLAUDE.md phải cảnh báo "đổi hành vi xác thực phải sửa cả ba".
const auth = createAuthMiddleware('content')

// Bọc handler async: Promise bị từ chối mà không có .catch sẽ không bao giờ tới
// được error handler của Express - request treo cho tới khi client bỏ cuộc.
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

// Ba service backend nằm trên URL Render CÔNG KHAI - không giấu sau mạng nội bộ
// được, vì frontend-main chạy trên Cloudflare Workers, ngoài mạng Render. Cổng
// chặn này là lớp bù: chỉ ai biết INTERNAL_API_TOKEN mới gọi được /api.
//
// TỰ NGUYỆN: biến không đặt thì middleware là no-op, nên local dev và CI không
// đổi hành vi. Đặt nó ở Render (và cùng giá trị cho biến của frontend) là bật.
// /health đứng ngoài để health check của Render vẫn chạy.
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || ''

// Giới hạn tần suất cho lưu lượng TRỰC TIẾP (không mang internal token tin cậy).
// Lưu lượng qua BFF của Next mang token đúng được MIỄN TRỪ: BFF không chuyển IP
// client xuống, nên giới hạn theo IP mà không miễn trừ sẽ gộp cả site vào một xô
// (xem @tsudev/ratelimit). Đặt TRƯỚC cổng token để chặn dội request không hợp lệ
// rẻ tiền. Ngưỡng chỉnh được qua env cho vận hành và test.
const directLimit = createRateLimit({
  name: 'content-direct',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_DIRECT_MAX) || 300,
})
app.use('/api', (req, res, next) => {
  if (INTERNAL_TOKEN && req.get('x-internal-token') === INTERNAL_TOKEN) return next()
  return directLimit(req, res, next)
})

app.use('/api', (req, res, next) => {
  if (!INTERNAL_TOKEN) return next()
  if (req.get('x-internal-token') === INTERNAL_TOKEN) return next()
  return res.status(401).json({ error: 'Thiếu hoặc sai x-internal-token' })
})

// XÁC THỰC TUỲ CHỌN, không phải chặn cứng. Gắn req.user nếu người gọi có mang
// danh tính; KHÔNG từ chối nếu không có.
//
// Trước đây đây là `app.use('/api', auth)` - chặn cứng - và nó làm production
// trống trơn: blog, tài liệu và dự án là nội dung CÔNG KHAI, nhưng BFF của Next
// gọi SSR chỉ kèm x-internal-token chứ không có Bearer JWT (không có phiên người
// dùng nào khi khách vãng lai mở trang). Ở local khi ấy không lộ ra vì
// AUTH_DEV_BYPASS bật; ở production nó trả 401, `lib/api.ts` nuốt lỗi thành []
// nên TRIỆU CHỨNG LÀ TRANG TRỐNG, KHÔNG PHẢI TRANG LỖI.
//
// An toàn vì đường ghi không dựa vào lớp này: mọi route ghi nằm dưới /api/admin
// và tự gọi requireAdmin(), vốn đọc vai trò TỪ DB và trả 401 khi thiếu req.user
// - fail closed. Đây cũng là hình mà storage-service (auth theo từng route) và
// trust-service (auth theo nhánh) vốn đã dùng; content-service là cái lệch.
//
// Token SAI vẫn bị từ chối: chỉ bỏ qua khi người gọi không đưa gì cả.
//
// Nhánh AUTH_DEV_BYPASS đã bị gỡ cùng với chính cờ đó. Nó làm mọi request ở
// local đi qua xác thực bắt buộc trong khi ở production thì không - tức là hai
// môi trường chạy hai đường khác nhau ngay tại chỗ nhạy cảm nhất, và đó là lý
// do lỗi 401 của production không bao giờ lộ ra khi chạy local.
const optionalAuth: RequestHandler = (req, res, next) => {
  const bearer = /^Bearer /i.test(req.get('authorization') || '')
  if (!bearer) return next()
  return auth(req, res, next)
}
app.use('/api', optionalAuth)

// ---------------- Blog ----------------
//
// KHÔNG có cổng vai trò ở đây, có chủ đích: blog, tài liệu và dự án là nội dung
// công khai. Bản trước từng gắn một cổng vai trò lên chính đường đọc này, thứ
// chỉ vô hại vì cổng đó khi ấy là no-op - bật lên là blog biến mất khỏi site.
//
// Thứ cần bảo vệ là đường GHI, nằm dưới /api/admin với requireAdmin().

// Điều kiện HIỂN THỊ CÔNG KHAI, gom một chỗ để không đường đọc nào quên:
//   - `deletedAt: null` BẮT BUỘC (Toà soạn xoá mềm; quên = bài xoá lộ ra).
//   - cổng LỊCH: publishedAt NULL (dữ liệu cũ) hoặc <= bây giờ. Bài hẹn tương lai ẩn.
const publicVisibleAnd = (now: Date): Prisma.PostWhereInput[] => [
  { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
]
const publicPostWhere = (now: Date): Prisma.PostWhereInput => ({
  published: true,
  deletedAt: null,
  AND: publicVisibleAnd(now),
})

type PostWithAuthor = Post & { author: User | null }
// Thẻ danh sách/tìm kiếm: đủ để render card, KHÔNG lộ cột nội bộ (search*Norm,
// authoredByAgentId, sourceDraftId). Ngày hiển thị = publishedAt (fallback createdAt).
const publicPostCard = (p: PostWithAuthor) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  tags: p.tags,
  coverImageUrl: p.coverImageUrl,
  publishedAt: p.publishedAt ?? p.createdAt,
  createdAt: p.createdAt,
  author: authorCard(p.author),
})
const publicPostDetail = (p: PostWithAuthor) => ({
  ...publicPostCard(p),
  contentMd: p.contentMd,
  references: (p.references ?? []) as PostRef[],
  metaDescription: p.metaDescription,
  updatedAt: p.updatedAt,
})

// Xếp hạng độ liên quan (SEARCH_AND_FILTER §5). Khớp trên cột đã chuẩn hoá; qn là
// từ khoá đã chuẩn hoá không dấu. Tie-break: bài mới hơn trước (§5 tiêu chí phụ).
const scorePost = (p: Post, qn: string): number => {
  if (!qn) return 0
  const t = p.searchTitleNorm ?? ''
  const b = p.searchBodyNorm ?? ''
  let s = 0
  if (t === qn) s += 100
  else if (t.startsWith(qn)) s += 70
  else if (t.includes(qn)) s += 50
  if (p.tags.some((tag) => viNormalizeText(tag).includes(qn))) s += 30
  if (b.includes(qn)) s += 10
  return s
}

app.get(
  '/api/posts',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const take = Math.min(qInt(req.query.limit, 20), 50)
    const tag = qStr(req.query.tag)?.trim()
    const posts = await prisma.post.findMany({
      where: tag ? { ...publicPostWhere(now), tags: { has: tag } } : publicPostWhere(now),
      // Xếp theo ngày HIỂN THỊ (publishedAt), fallback createdAt cho dữ liệu cũ.
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { author: true },
    })
    res.json(posts.map(publicPostCard))
  })
)

// Tìm kiếm/lọc theo SEARCH_AND_FILTER §7. ĐỨNG TRƯỚC '/api/posts/:slug' để không
// bị nuốt thành slug "search". Trần page_size cứng 100 (chống cạn tài nguyên).
app.get(
  '/api/posts/search',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const rawQ = (qStr(req.query.q) ?? '').trim()
    const qn = viNormalizeText(rawQ)
    const tag = qStr(req.query.tag)?.trim()
    const sort = qStr(req.query.sort) ?? 'relevance'
    const page = qInt(req.query.page, 1)
    const pageSize = Math.min(qInt(req.query.page_size, 20), 100)

    // Truy vấn từ 2 ký tự (§2.1). Không q, không tag ⇒ không tìm gì.
    const hasQuery = qn.length >= 2
    if (!hasQuery && !tag) {
      return res.json({
        data: [],
        meta: { total: 0, page, page_size: pageSize, query_normalized: qn },
        facets: { tag: [] },
      })
    }

    const where: Prisma.PostWhereInput = {
      published: true,
      deletedAt: null,
      AND: [
        ...publicVisibleAnd(now),
        ...(hasQuery
          ? [
              {
                OR: [{ searchTitleNorm: { contains: qn } }, { searchBodyNorm: { contains: qn } }],
              } as Prisma.PostWhereInput,
            ]
          : []),
        ...(tag ? [{ tags: { has: tag } } as Prisma.PostWhereInput] : []),
      ],
    }

    const total = await prisma.post.count({ where })

    // Sắp theo ngày ⇒ phân trang ở DB (rẻ). Sắp theo độ liên quan ⇒ lấy tập ứng
    // viên có trần rồi xếp hạng trong bộ nhớ (quy mô nhỏ, §8). Trần 500 giữ chi
    // phí hữu hạn kể cả khi từ khoá quá phổ biến.
    let rows: PostWithAuthor[]
    if (sort === 'newest' || sort === 'oldest' || !hasQuery) {
      rows = await prisma.post.findMany({
        where,
        orderBy: [
          { publishedAt: sort === 'oldest' ? 'asc' : 'desc' },
          { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: true },
      })
    } else {
      const candidates = await prisma.post.findMany({
        where,
        take: 500,
        include: { author: true },
      })
      candidates.sort((a, b) => {
        const d = scorePost(b, qn) - scorePost(a, qn)
        if (d !== 0) return d
        const ta = (a.publishedAt ?? a.createdAt).getTime()
        const tb = (b.publishedAt ?? b.createdAt).getTime()
        return tb - ta
      })
      rows = candidates.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    }

    // Facet thẻ: đếm trong tập khớp (trần 500) - "khi khả thi" (§6.3).
    const facetSource = await prisma.post.findMany({
      where,
      take: 500,
      select: { tags: true },
    })
    const tagCount = new Map<string, number>()
    for (const r of facetSource)
      for (const tg of r.tags) tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1)
    const tagFacet = [...tagCount.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    res.json({
      data: rows.map(publicPostCard),
      meta: { total, page, page_size: pageSize, query_normalized: qn },
      facets: { tag: tagFacet },
    })
  })
)

app.get(
  '/api/posts/:slug',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const post = await prisma.post.findUnique({
      where: { slug: req.params.slug },
      include: { author: true },
    })
    // Cổng lịch: bài hẹn tương lai coi như chưa tồn tại với công chúng.
    const scheduled = post?.publishedAt ? post.publishedAt.getTime() > now.getTime() : false
    if (!post || !post.published || post.deletedAt || scheduled)
      return res.status(404).json({ error: 'Post not found' })
    res.json(publicPostDetail(post))
  })
)

// ---------------- Docs ----------------
app.get(
  '/api/docs',
  asyncHandler(async (req, res) => {
    const docs = await prisma.doc.findMany({
      where: { deletedAt: null },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    })
    res.json(docs.map((d) => ({ id: d.id, slug: d.slug, title: d.title, category: d.category })))
  })
)

app.get(
  '/api/docs/:slug',
  asyncHandler(async (req, res) => {
    const doc = await prisma.doc.findUnique({ where: { slug: req.params.slug } })
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Doc not found' })
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

async function requireAdmin(req: Request, res: Response): Promise<User | null> {
  // lookupUser() của @tsudev/auth: tra cứu chứ KHÔNG tạo (đường ghi phải khớp
  // một User có thật), và nó cũng đối chiếu sessionVersion để một phiên đã bị
  // thu hồi không đi qua được. Trước đây đây là bản `actingUser` cục bộ - bản
  // thứ ba của cùng một hàm, và là bản duy nhất bỏ sót phép so sánh đó.
  const user = await lookupUser(req)
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
 * Nhờ nó mà sau `if (!parsed.ok) return`, TypeScript BIẾT `parsed.data` có mặt -
 * không còn chỗ nào đọc data của một request đã bị từ chối.
 */
type ReadBodyResult = { ok: true; data: ProjectWritable } | { ok: false; error: string }

function readProjectBody(body: unknown, { partial }: { partial: boolean }): ReadBodyResult {
  const b = (body ?? {}) as Record<string, unknown>
  const data: ProjectWritable = {}
  // Các vòng lặp bên dưới gán theo khoá động. Giữ MỘT tham chiếu lỏng kiểu ở đây
  // thay vì rắc cast khắp nơi - hình dạng trả về cho nơi gọi vẫn là ProjectWritable.
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
  // gì chống lưng - chặn ngay ở đây, đừng để nó hiện lên trang công khai.
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
    // `deletedAt: null` bắt buộc trên mọi đường đọc công khai - xem đợt 5 của
    // docs/refactor-newsroom-agents.md.
    const where: Prisma.ProjectWhereInput = { published: true, deletedAt: null }
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
    if (!project || !project.published || project.deletedAt)
      return res.status(404).json({ error: 'Không tìm thấy dự án' })
    res.json(project)
  })
)

/// Danh sách đầy đủ cho trang quản trị - gồm cả dự án chưa công bố.
app.get(
  '/api/admin/projects',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    // `?trash=1` xem thùng rác. Mặc định ẩn đã xoá: trang quản trị mà trộn lẫn
    // dự án còn sống với dự án đã xoá là cách để một ngày nào đó sửa nhầm cái
    // đã bỏ đi rồi tưởng mình vừa sửa cái đang chạy.
    const trash = req.query.trash === '1'
    const projects = await prisma.project.findMany({
      where: trash ? { deletedAt: { not: null } } : { deletedAt: null },
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

/**
 * XOÁ MỀM, không phải xoá cứng.
 *
 * Đổi ở đợt 5 của Toà soạn Agent AI. Giữ nguyên động từ DELETE và hình dạng
 * phản hồi để không phá `/admin/projects` đang chạy - thay đổi nằm ở chỗ bản
 * ghi vẫn còn trong DB và khôi phục được.
 *
 * ⚠️ Route này PHẢI đổi TRƯỚC khi trigger tsudev_block_hard_delete được gắn cho
 * bảng Project. Đảo thứ tự là mọi lượt xoá dự án ném lỗi 500 - một tính năng
 * đang chạy được bỗng hỏng vì một migration.
 */
app.delete(
  '/api/admin/projects/:slug',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const current = await prisma.project.findUnique({ where: { slug: req.params.slug } })
    if (!current || current.deletedAt)
      return res.status(404).json({ error: 'Không tìm thấy dự án' })
    await prisma.project.update({ where: { id: current.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true, softDeleted: true })
  })
)

/** Khôi phục từ thùng rác. Chỉ ADMIN, giống mọi đường ghi khác dưới /api/admin. */
app.post(
  '/api/admin/projects/:slug/restore',
  asyncHandler(async (req, res) => {
    if (!(await requireAdmin(req, res))) return
    const current = await prisma.project.findUnique({ where: { slug: req.params.slug } })
    if (!current) return res.status(404).json({ error: 'Không tìm thấy dự án' })
    const project = await prisma.project.update({
      where: { id: current.id },
      data: { deletedAt: null },
    })
    res.json(project)
  })
)

// ---------------- Đăng bài cho AUTHOR ----------------
//
// Bề mặt để NGƯỜI có vai trò AUTHOR (trở lên) tự đăng và sửa bài blog của CHÍNH
// MÌNH. Khác hẳn hai đường ghi còn lại của service:
//   - `/api/admin/*` gác requireAdmin (ADMIN trở lên), không giới hạn tác giả;
//   - Toà soạn Agent AI ghi qua ContentDraft rồi CHIẾU sang Post.
//
// Ở đây gác requireRole('AUTHOR') VÀ mọi truy vấn kẹp thêm `authorId === me.id`:
// người đi qua đường này - kể cả ADMIN/OWNER, vốn cao hơn AUTHOR - chỉ đụng được
// bài của chính họ. Muốn sửa bài của người khác là một bề mặt KHÁC, chưa có.
// Bài do người viết mang `authoredByAgentId: null` (phân biệt với bài Toà soạn).

async function requireAuthor(req: Request, res: Response): Promise<User | null> {
  // Cùng khuôn requireAdmin: lookupUser() tra cứu (không tạo) và đối chiếu
  // sessionVersion, fail closed. Ngưỡng là AUTHOR thay vì ADMIN.
  const user = await lookupUser(req)
  if (!user) {
    res.status(401).json({ error: 'Bạn cần đăng nhập' })
    return null
  }
  if (!hasAtLeastRole(user.role, 'AUTHOR')) {
    res.status(403).json({ error: 'Yêu cầu quyền đăng bài' })
    return null
  }
  return user
}

/**
 * requireAuthor + email ĐỦ DÙNG. Dùng cho đường GHI Post (tạo/sửa/xoá): chưa xác
 * minh mà đã quá ân hạn thì chặn. Đường ĐỌC (list/get) vẫn dùng requireAuthor -
 * xem được bản nháp của mình dù chưa xác minh là vô hại. Ngưỡng ân hạn sống một
 * chỗ ở @tsudev/types, khớp với cổng nâng vai trò ở auth-service.
 */
async function requireVerifiedAuthor(req: Request, res: Response): Promise<User | null> {
  const me = await requireAuthor(req, res)
  if (!me) return null
  if (!emailUsable(me.emailVerifiedAt, me.createdAt)) {
    res.status(403).json({ error: 'email_unverified' })
    return null
  }
  return me
}

// Suy slug từ tiêu đề tiếng Việt: bỏ dấu (NFD tách dấu ra rồi xoá), đ→d, gom
// mọi thứ không phải [a-z0-9] thành gạch nối. Kết quả vẫn được SLUG_RE kiểm lại.
const slugify = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

type PostRef = { label: string; url: string }
type PostWritable = {
  slug?: string
  title?: string
  excerpt?: string | null
  contentMd?: string
  tags?: string[]
  published?: boolean
  publishedAt?: Date | null
  references?: PostRef[]
  coverImageUrl?: string | null
  metaDescription?: string | null
}
type PostBodyResult = { ok: true; data: PostWritable } | { ok: false; error: string }

// URL người dùng khai (nguồn tham khảo, ảnh bìa) CHỈ chấp nhận http/https - chặn
// `javascript:`/`data:` (XSS khi render) và giao thức lạ. Trần độ dài chống nhồi.
const isHttpUrl = (s: string): boolean => {
  if (s.length > 2048) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Làm sạch mảng "Nguồn tham khảo": mỗi phần tử {label,url}, url phải http/https. */
function readReferences(
  raw: unknown
): { ok: true; refs: PostRef[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'references phải là mảng' }
  if (raw.length > 50) return { ok: false, error: 'references tối đa 50 mục' }
  const refs: PostRef[] = []
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>
    const url = String(o.url ?? '').trim()
    if (!url) continue
    if (!isHttpUrl(url)) return { ok: false, error: `URL nguồn không hợp lệ: ${url.slice(0, 80)}` }
    // Nhãn rỗng ⇒ suy từ host để vùng hiển thị luôn có chữ đọc được.
    let label = String(o.label ?? '')
      .trim()
      .slice(0, 200)
    if (!label) {
      try {
        label = new URL(url).host
      } catch {
        label = url
      }
    }
    refs.push({ label, url })
  }
  return { ok: true, refs }
}

/**
 * Làm sạch phần thân request cho Post. `authorId`/`authoredByAgentId` CỐ Ý không
 * đọc từ đây - tác giả do phiên quyết định, không do người dùng khai.
 */
function readPostBody(body: unknown, { partial }: { partial: boolean }): PostBodyResult {
  const b = (body ?? {}) as Record<string, unknown>
  const data: PostWritable = {}

  if (!partial || b.title !== undefined) {
    const title = String(b.title ?? '').trim()
    if (!title) return { ok: false, error: 'Thiếu title' }
    data.title = title
  }
  if (!partial || b.contentMd !== undefined) {
    const contentMd = String(b.contentMd ?? '')
    if (!contentMd.trim()) return { ok: false, error: 'Thiếu contentMd' }
    data.contentMd = contentMd
  }
  // slug: gửi thì kiểm; tạo mới mà bỏ trống thì suy từ title.
  if (b.slug !== undefined && String(b.slug).trim() !== '') {
    const slug = String(b.slug).trim().toLowerCase()
    if (!SLUG_RE.test(slug))
      return {
        ok: false,
        error: 'slug phải là chữ thường, số và dấu gạch nối (ví dụ: bai-viet-dau)',
      }
    data.slug = slug
  } else if (!partial) {
    const derived = slugify(data.title || '')
    if (!SLUG_RE.test(derived))
      return { ok: false, error: 'Không suy được slug từ title; hãy nhập slug' }
    data.slug = derived
  }
  if (b.excerpt !== undefined) {
    const ex = b.excerpt === null ? null : String(b.excerpt).trim()
    data.excerpt = ex === '' ? null : ex
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) return { ok: false, error: 'tags phải là mảng chuỗi' }
    data.tags = b.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
  }
  if (b.published !== undefined) data.published = Boolean(b.published)

  // Ngày hiển thị/lên lịch. null = xoá (đọc công khai fallback createdAt). Chuỗi
  // ISO ⇒ Date; ngày tương lai = hẹn lịch (đường đọc ẩn tới giờ).
  if (b.publishedAt !== undefined) {
    if (b.publishedAt === null || b.publishedAt === '') {
      data.publishedAt = null
    } else {
      const d = new Date(String(b.publishedAt))
      if (Number.isNaN(d.getTime())) return { ok: false, error: 'publishedAt không hợp lệ' }
      data.publishedAt = d
    }
  }
  if (b.references !== undefined) {
    const r = readReferences(b.references)
    if (!r.ok) return { ok: false, error: r.error }
    data.references = r.refs
  }
  if (b.coverImageUrl !== undefined) {
    const c = b.coverImageUrl === null ? null : String(b.coverImageUrl).trim()
    if (c && !isHttpUrl(c)) return { ok: false, error: 'coverImageUrl phải là http/https' }
    data.coverImageUrl = c === '' ? null : c
  }
  if (b.metaDescription !== undefined) {
    const m = b.metaDescription === null ? null : String(b.metaDescription).trim().slice(0, 320)
    data.metaDescription = m === '' ? null : m
  }

  return { ok: true, data }
}

// Thẻ bài cho trang soạn của tác giả. KHÁC authorCard/đường đọc công khai: mang
// theo cả `published` và bài chưa công bố, vì chủ nhân cần thấy bản nháp của mình.
const authorPostCard = (p: Post) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  contentMd: p.contentMd,
  tags: p.tags,
  published: p.published,
  publishedAt: p.publishedAt,
  references: p.references ?? [],
  coverImageUrl: p.coverImageUrl,
  metaDescription: p.metaDescription,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
})

/** Bài còn sống của CHÍNH tác giả (gồm bản chưa công bố). Không lộ bài đã xoá. */
app.get(
  '/api/author/posts',
  asyncHandler(async (req, res) => {
    const me = await requireAuthor(req, res)
    if (!me) return
    const posts = await prisma.post.findMany({
      where: { authorId: me.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(posts.map(authorPostCard))
  })
)

app.post(
  '/api/author/posts',
  asyncHandler(async (req, res) => {
    const me = await requireVerifiedAuthor(req, res)
    if (!me) return
    const parsed = readPostBody(req.body, { partial: false })
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const data = parsed.data as Required<Pick<PostWritable, 'slug' | 'title' | 'contentMd'>> &
      PostWritable

    const clash = await prisma.post.findUnique({ where: { slug: data.slug } })
    if (clash) return res.status(409).json({ error: `slug "${data.slug}" đã tồn tại` })

    // Cột chỉ mục tìm kiếm tính SẴN lúc ghi (SEARCH_AND_FILTER §4). Một nguồn.
    const search = buildPostSearch({
      title: data.title,
      excerpt: data.excerpt ?? null,
      contentMd: data.contentMd,
    })
    const post = await prisma.post.create({
      // Tác giả bị GHIM theo phiên; authoredByAgentId null = do người viết.
      data: {
        slug: data.slug,
        title: data.title,
        contentMd: data.contentMd,
        excerpt: data.excerpt ?? null,
        tags: data.tags ?? [],
        published: data.published ?? true,
        // Không khai ⇒ đăng ngay (ngày hiển thị = lúc tạo); khai tương lai = lên lịch.
        publishedAt: data.publishedAt ?? new Date(),
        references: (data.references ?? []) as unknown as Prisma.InputJsonValue,
        coverImageUrl: data.coverImageUrl ?? null,
        metaDescription: data.metaDescription ?? null,
        ...search,
        authorId: me.id,
        authoredByAgentId: null,
      },
    })
    res.status(201).json(authorPostCard(post))
  })
)

/**
 * Tìm một bài mà `me` được phép sửa: đúng slug, đúng tác giá, chưa xoá. Trả 404
 * cho MỌI trường hợp khác (không có / của người khác / đã xoá) - không tiết lộ
 * bài của tác giả khác có tồn tại hay không.
 */
async function findOwnPost(slug: string | undefined, meId: string): Promise<Post | null> {
  if (!slug) return null
  const post = await prisma.post.findUnique({ where: { slug } })
  if (!post || post.authorId !== meId || post.deletedAt) return null
  return post
}

app.get(
  '/api/author/posts/:slug',
  asyncHandler(async (req, res) => {
    const me = await requireAuthor(req, res)
    if (!me) return
    const post = await findOwnPost(req.params.slug, me.id)
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài của bạn' })
    res.json(authorPostCard(post))
  })
)

app.patch(
  '/api/author/posts/:slug',
  asyncHandler(async (req, res) => {
    const me = await requireVerifiedAuthor(req, res)
    if (!me) return
    const current = await findOwnPost(req.params.slug, me.id)
    if (!current) return res.status(404).json({ error: 'Không tìm thấy bài của bạn' })

    const parsed = readPostBody(req.body, { partial: true })
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const data = parsed.data

    if (data.slug && data.slug !== current.slug) {
      const clash = await prisma.post.findUnique({ where: { slug: data.slug } })
      if (clash) return res.status(409).json({ error: `slug "${data.slug}" đã tồn tại` })
    }

    // Tính lại chỉ mục từ giá trị SAU khi trộn (patch có thể chỉ đổi một phần).
    const { references, ...rest } = data
    const search = buildPostSearch({
      title: data.title ?? current.title,
      excerpt: data.excerpt !== undefined ? data.excerpt : current.excerpt,
      contentMd: data.contentMd ?? current.contentMd,
    })
    const post = await prisma.post.update({
      where: { id: current.id },
      data: {
        ...rest,
        ...(references !== undefined
          ? { references: references as unknown as Prisma.InputJsonValue }
          : {}),
        ...search,
      },
    })
    res.json(authorPostCard(post))
  })
)

/** XOÁ MỀM, khớp khuôn của Toà soạn (xoá cứng bị trigger Postgres chặn). */
app.delete(
  '/api/author/posts/:slug',
  asyncHandler(async (req, res) => {
    const me = await requireVerifiedAuthor(req, res)
    if (!me) return
    const current = await findOwnPost(req.params.slug, me.id)
    if (!current) return res.status(404).json({ error: 'Không tìm thấy bài của bạn' })
    await prisma.post.update({ where: { id: current.id }, data: { deletedAt: new Date() } })
    res.json({ ok: true, softDeleted: true })
  })
)

// Cò nổ có chủ đích để kiểm thử đường dây cảnh báo (TSD §6.3).
//
// Chặn ở production: endpoint này không cần đăng nhập, và mỗi lần gọi là một
// cảnh báo thật bắn về Telegram/email. Để mở thì bất kỳ ai cũng làm ngập kênh
// trực của đội - thứ khiến cảnh báo thật bị bỏ qua.
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
  // Ở production trả chuỗi chung: `err.message` hay mang theo đường dẫn tệp trên
  // máy chủ hoặc tên bảng - thứ giúp người dò tìm dựng bản đồ hệ thống. Chi tiết
  // đã được ghi đầy đủ vào log ở trên.
  if (res && !res.headersSent)
    res
      .status(500)
      .json({ error: process.env.NODE_ENV === 'production' ? 'internal error' : message })
}
app.use(errorHandler)

/** Chuẩn bị trước khi phục vụ. Chạy ở CẢ hai chế độ: tiến trình riêng và nhúng
 *  trong services/backend-bundle. content-service không có gì phải dựng sẵn -
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
