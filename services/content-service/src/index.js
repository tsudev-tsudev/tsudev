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
const express = require('express')
const { prisma } = require('@tsudev/db')
const { hasAtLeastRole } = require('@tsudev/types')
let notify = { alert: async () => {} }
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

let auth
try {
  auth = require('./authMiddleware')
} catch (e) {
  auth = (req, res, next) => next()
}
const requireRole = (role) =>
  auth && auth.requireRole ? auth.requireRole(role) : (req, res, next) => next()
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Thẻ tác giả gắn vào bài blog. Không còn `reputation`/`rank`: điểm uy tín
// thành viên là cơ chế của diễn đàn, đã bỏ; uy tín nay là hồ sơ tổ chức gắn
// con dấu (docs/refactor-personal-site.md §3.3).
const authorCard = (u) =>
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

app.use('/api', auth)

// ---------------- Blog ----------------
app.get(
  '/api/posts',
  requireRole(process.env.CONTENT_READ_ROLE || 'content:read'),
  asyncHandler(async (req, res) => {
    const take = Math.min(parseInt(req.query.limit) || 20, 50)
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
// Đọc: công khai. Ghi: chỉ ADMIN, và kiểm bằng vai trò LƯU TRONG DB chứ không
// bằng requireRole() — requireRole là no-op trừ khi REQUIRE_ROLE_ENFORCEMENT=true,
// nên dựa vào nó để gác đường ghi là để cửa mở ở local lẫn production.

const PROJECT_KINDS = new Set(['APP', 'TOOL', 'LIBRARY', 'SERVICE'])
const PROJECT_STATUSES = new Set(['WIP', 'BETA', 'STABLE', 'ARCHIVED'])
const COPYRIGHT_STATUSES = new Set(['NONE', 'PENDING', 'REGISTERED'])

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/// Danh tính người gọi, lấy từ payload đã xác thực. Không tự tạo tài khoản như
/// currentUser() cũ của diễn đàn: đường ghi phải khớp một User có thật.
async function actingUser(req) {
  const p = req.user || {}
  const username = p.preferred_username || p.username || p.sub
  if (!username) return null
  return prisma.user.findUnique({ where: { username } })
}

async function requireAdmin(req, res) {
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

const projectCard = (p) => ({
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
function readProjectBody(body, { partial }) {
  const b = body || {}
  const data = {}
  const set = (key, value) => {
    if (value !== undefined) data[key] = value
  }

  if (!partial || b.slug !== undefined) {
    const slug = (b.slug || '').toString().trim().toLowerCase()
    if (!SLUG_RE.test(slug))
      return { error: 'slug phải là chữ thường, số và dấu gạch nối (ví dụ: tsudev-cli)' }
    data.slug = slug
  }
  if (!partial || b.name !== undefined) {
    const name = (b.name || '').toString().trim()
    if (!name) return { error: 'Thiếu name' }
    data.name = name
  }
  if (!partial || b.summary !== undefined) {
    const summary = (b.summary || '').toString().trim()
    if (!summary) return { error: 'Thiếu summary' }
    data.summary = summary
  }

  if (b.kind !== undefined) {
    if (!PROJECT_KINDS.has(b.kind)) return { error: `kind không hợp lệ: ${b.kind}` }
    data.kind = b.kind
  }
  if (b.status !== undefined) {
    if (!PROJECT_STATUSES.has(b.status)) return { error: `status không hợp lệ: ${b.status}` }
    data.status = b.status
  }
  if (b.copyrightStatus !== undefined) {
    if (!COPYRIGHT_STATUSES.has(b.copyrightStatus))
      return { error: `copyrightStatus không hợp lệ: ${b.copyrightStatus}` }
    data.copyrightStatus = b.copyrightStatus
  }

  // REGISTERED mà không có số giấy chứng nhận là một khẳng định pháp lý không có
  // gì chống lưng — chặn ngay ở đây, đừng để nó hiện lên trang công khai.
  const nextCopyright = data.copyrightStatus
  const nextNo = b.copyrightNo === undefined ? undefined : (b.copyrightNo || '').toString().trim()
  if (nextCopyright === 'REGISTERED' && !partial && !nextNo)
    return { error: 'copyrightStatus=REGISTERED thì bắt buộc có copyrightNo' }
  ;['descriptionMd', 'version', 'repoUrl', 'homepageUrl', 'downloadUrl', 'license'].forEach((k) => {
    if (b[k] !== undefined) data[k] = b[k] === null ? null : b[k].toString()
  })
  ;['copyrightNo', 'copyrightOwner', 'trustProgramSlug'].forEach((k) => {
    if (b[k] !== undefined) data[k] = b[k] === null || b[k] === '' ? null : b[k].toString()
  })
  ;['releasedAt', 'copyrightAt'].forEach((k) => {
    if (b[k] === undefined) return
    if (b[k] === null || b[k] === '') return set(k, null)
    const d = new Date(b[k])
    if (Number.isNaN(d.getTime())) return
    data[k] = d
  })
  ;['featured', 'published'].forEach((k) => {
    if (b[k] !== undefined) data[k] = Boolean(b[k])
  })
  if (b.sortOrder !== undefined) data.sortOrder = parseInt(b.sortOrder, 10) || 0

  return { data }
}

app.get(
  '/api/projects',
  asyncHandler(async (req, res) => {
    const where = { published: true }
    if (req.query.kind && PROJECT_KINDS.has(req.query.kind)) where.kind = req.query.kind
    if (req.query.status && PROJECT_STATUSES.has(req.query.status)) where.status = req.query.status
    if (req.query.copyright && COPYRIGHT_STATUSES.has(req.query.copyright))
      where.copyrightStatus = req.query.copyright
    if (req.query.featured === '1') where.featured = true

    const take = Math.min(parseInt(req.query.limit) || 50, 100)
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
    const { data, error } = readProjectBody(req.body, { partial: false })
    if (error) return res.status(400).json({ error })

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

    const { data, error } = readProjectBody(req.body, { partial: true })
    if (error) return res.status(400).json({ error })

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
app.use((err, req, res, next) => {
  console.error('[content] error', err && (err.stack || err.message || err))
  notify.alert({
    service: 'content-service',
    level: 'error',
    message: err && err.message,
    error: err,
    context: `${req.method} ${req.url}`,
  })
  if (res && !res.headersSent)
    res.status(500).json({ error: err && err.message ? err.message : 'internal error' })
})

async function startServer() {
  app.listen(port, bindHost, () => console.log(`content-service listening on ${bindHost}:${port}`))
}

if (process.env.NODE_ENV !== 'test') startServer().catch(() => {})

module.exports = { app, startServer }
