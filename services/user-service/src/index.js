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
  require('../../../packages/observability/initSentry').initServer({ service: 'user-service' })
} catch (e) {
  // ignore
}
const express = require('express')
const { prisma } = require('@tsudev/db')
const { rankFor } = require('@tsudev/types')
let notify = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}
const app = express()
app.use(express.json())
const port = process.env.PORT || process.env.PORT_USER_SERVICE || 4000

// Try to load auth middleware; fallback to permissive middleware in dev
let auth
try {
  auth = require('./authMiddleware')
} catch (e) {
  auth = (req, res, next) => next()
}

// convenience wrapper so callers can always call requireRole(...)
const requireRole = (role) =>
  auth && auth.requireRole ? auth.requireRole(role) : (req, res, next) => next()

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName || u.username,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  role: u.role,
  reputation: u.reputation,
  credits: u.credits,
  rank: rankFor(u.reputation),
  createdAt: u.createdAt,
})

// Protect API routes
app.use('/api', auth)

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-service' }))

// List members (leaderboard-friendly: sorted by reputation)
app.get(
  '/api/users',
  requireRole(process.env.USER_READ_ROLE || 'user:read'),
  asyncHandler(async (req, res) => {
    const take = Math.min(parseInt(req.query.limit) || 50, 100)
    const users = await prisma.user.findMany({ orderBy: { reputation: 'desc' }, take })
    res.json(users.map(publicUser))
  })
)

// Public profile by username
app.get(
  '/api/users/:username',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const [threads, posts] = await Promise.all([
      prisma.thread.count({ where: { authorId: user.id } }),
      prisma.forumPost.count({ where: { authorId: user.id } }),
    ])
    res.json({ ...publicUser(user), stats: { threads, posts } })
  })
)

// Express chỉ nhận diện đây là middleware xử lý lỗi khi hàm khai đủ 4 tham số;
// bỏ `next` cho hết lint thì toàn bộ xử lý lỗi im lặng ngừng hoạt động.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
  console.error('[user] error', err && (err.stack || err.message || err))
  notify.alert({
    service: 'user-service',
    level: 'error',
    message: err && err.message,
    error: err,
    context: `${req.method} ${req.url}`,
  })
  if (res && !res.headersSent)
    res.status(500).json({ error: err && err.message ? err.message : 'internal error' })
})

async function startServer() {
  app.listen(port, () => console.log(`user-service listening on ${port}`))
}

if (process.env.NODE_ENV !== 'test') startServer().catch(() => {})

module.exports = { app, startServer }
