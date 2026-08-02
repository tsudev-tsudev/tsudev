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
const { REP, rankFor, hasAtLeastRole } = require('@tsudev/types')
let notify = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}
const app = express()
app.use(express.json({ limit: '1mb' }))
const port = process.env.PORT || process.env.PORT_CONTENT_SERVICE || 4001

let auth
try {
  auth = require('./authMiddleware')
} catch (e) {
  auth = (req, res, next) => next()
}
const requireRole = (role) =>
  auth && auth.requireRole ? auth.requireRole(role) : (req, res, next) => next()
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const slugify = (s) =>
  (s || 'thread')
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'thread'

// Resolve the acting user from auth payload; auto-provision in dev so posting works.
async function currentUser(req) {
  const p = req.user || {}
  const username = p.preferred_username || p.username || p.sub
  if (!username) return null
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, email: `${username}@tsudev.local`, displayName: username, role: 'MEMBER' },
  })
}

const authorCard = (u) =>
  u
    ? {
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
        reputation: u.reputation,
        rank: rankFor(u.reputation),
      }
    : null

// --- Moderation helpers -------------------------------------------------
async function requireModerator(req, res) {
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Bạn cần đăng nhập' })
    return null
  }
  if (!hasAtLeastRole(user.role, 'MODERATOR')) {
    res.status(403).json({ error: 'Yêu cầu quyền kiểm duyệt viên' })
    return null
  }
  return user
}

async function logModAction(mod, action, targetType, targetId, targetLabel, note) {
  return prisma.modAction.create({
    data: {
      moderatorId: mod.id,
      moderatorName: mod.displayName || mod.username,
      action,
      targetType,
      targetId,
      targetLabel,
      note,
    },
  })
}

async function activeBanFor(username) {
  const ban = await prisma.ban.findFirst({
    where: { username, active: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!ban) return null
  if (ban.until && ban.until < new Date()) {
    await prisma.ban.update({ where: { id: ban.id }, data: { active: false } }).catch(() => {})
    return null
  }
  return ban
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'content-service' }))

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

// ---------------- Forum: reads ----------------
app.get(
  '/api/forum/categories',
  asyncHandler(async (req, res) => {
    const cats = await prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: {
        boards: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { threads: true } } },
        },
      },
    })
    res.json(
      cats.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        boards: c.boards.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          description: b.description,
          threadCount: b._count.threads,
        })),
      }))
    )
  })
)

app.get(
  '/api/forum/boards/:slug',
  asyncHandler(async (req, res) => {
    const board = await prisma.board.findUnique({ where: { slug: req.params.slug } })
    if (!board) return res.status(404).json({ error: 'Board not found' })
    const take = Math.min(parseInt(req.query.limit) || 20, 50)
    const threads = await prisma.thread.findMany({
      where: { boardId: board.id },
      orderBy: [{ pinned: 'desc' }, { lastPostAt: 'desc' }],
      take,
      include: { author: true, _count: { select: { posts: true } } },
    })
    res.json({
      board: { id: board.id, slug: board.slug, name: board.name, description: board.description },
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        pinned: t.pinned,
        locked: t.locked,
        views: t.views,
        replies: Math.max(t._count.posts - 1, 0),
        lastPostAt: t.lastPostAt,
        author: authorCard(t.author),
      })),
    })
  })
)

app.get(
  '/api/forum/threads/:id',
  asyncHandler(async (req, res) => {
    const thread = await prisma.thread.findUnique({
      where: { id: req.params.id },
      include: {
        board: true,
        author: true,
        posts: { orderBy: { createdAt: 'asc' }, include: { author: true, reactions: true } },
      },
    })
    if (!thread) return res.status(404).json({ error: 'Thread not found' })
    await prisma.thread
      .update({ where: { id: thread.id }, data: { views: { increment: 1 } } })
      .catch(() => {})
    res.json({
      id: thread.id,
      title: thread.title,
      slug: thread.slug,
      pinned: thread.pinned,
      locked: thread.locked,
      views: thread.views + 1,
      createdAt: thread.createdAt,
      board: { id: thread.board.id, slug: thread.board.slug, name: thread.board.name },
      author: authorCard(thread.author),
      posts: thread.posts.map((p) => ({
        id: p.id,
        contentMd: p.deleted ? '_[Bài viết đã bị gỡ bởi kiểm duyệt]_' : p.contentMd,
        deleted: p.deleted,
        isSolution: p.isSolution,
        createdAt: p.createdAt,
        editedAt: p.editedAt,
        author: authorCard(p.author),
        reactions: p.reactions.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1
          return acc
        }, {}),
      })),
    })
  })
)

// ---------------- Forum: writes (auth required) ----------------
async function awardReputation(userId, delta, reason, sourceType, sourceId) {
  await prisma.$transaction([
    prisma.reputationEvent.create({ data: { userId, delta, reason, sourceType, sourceId } }),
    prisma.user.update({ where: { id: userId }, data: { reputation: { increment: delta } } }),
  ])
}

app.post(
  '/api/forum/boards/:slug/threads',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Authentication required' })
    const ban = await activeBanFor(user.username)
    if (ban) return res.status(403).json({ error: `Tài khoản của bạn đang bị cấm: ${ban.reason}` })
    const board = await prisma.board.findUnique({ where: { slug: req.params.slug } })
    if (!board) return res.status(404).json({ error: 'Board not found' })
    const { title, content } = req.body || {}
    if (!title || title.trim().length < 3)
      return res.status(400).json({ error: 'Tiêu đề tối thiểu 3 ký tự' })
    if (!content || content.trim().length < 1)
      return res.status(400).json({ error: 'Nội dung không được trống' })

    let slug = slugify(title)
    const dup = await prisma.thread.findFirst({ where: { boardId: board.id, slug } })
    if (dup) slug = `${slug}-${Date.now().toString(36)}`

    const thread = await prisma.thread.create({
      data: {
        boardId: board.id,
        authorId: user.id,
        title: title.trim(),
        slug,
        lastPostAt: new Date(),
        posts: { create: [{ authorId: user.id, contentMd: content.trim() }] },
      },
    })
    await awardReputation(user.id, REP.THREAD_CREATED, 'Tạo chủ đề', 'thread', thread.id)
    res.status(201).json({ id: thread.id, slug: thread.slug, boardSlug: board.slug })
  })
)

app.post(
  '/api/forum/threads/:id/posts',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Authentication required' })
    const ban = await activeBanFor(user.username)
    if (ban) return res.status(403).json({ error: `Tài khoản của bạn đang bị cấm: ${ban.reason}` })
    const thread = await prisma.thread.findUnique({ where: { id: req.params.id } })
    if (!thread) return res.status(404).json({ error: 'Thread not found' })
    if (thread.locked) return res.status(403).json({ error: 'Chủ đề đã bị khoá' })
    const { content } = req.body || {}
    if (!content || content.trim().length < 1)
      return res.status(400).json({ error: 'Nội dung không được trống' })

    const post = await prisma.forumPost.create({
      data: { threadId: thread.id, authorId: user.id, contentMd: content.trim() },
    })
    await prisma.thread.update({ where: { id: thread.id }, data: { lastPostAt: new Date() } })
    await awardReputation(user.id, REP.POST_CREATED, 'Trả lời chủ đề', 'post', post.id)
    res.status(201).json({ id: post.id })
  })
)

app.post(
  '/api/forum/posts/:id/react',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Authentication required' })
    const type = (req.body && req.body.type) || 'LIKE'
    const post = await prisma.forumPost.findUnique({ where: { id: req.params.id } })
    if (!post) return res.status(404).json({ error: 'Post not found' })
    try {
      await prisma.reaction.create({ data: { postId: post.id, userId: user.id, type } })
    } catch (e) {
      // unique violation → toggle off
      await prisma.reaction.deleteMany({ where: { postId: post.id, userId: user.id, type } })
      return res.json({ toggled: 'off' })
    }
    res.json({ toggled: 'on' })
  })
)

// ---------------- Report (any authenticated member) ----------------
app.post(
  '/api/forum/reports',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const { targetType, targetId, reason } = req.body || {}
    if (!['THREAD', 'POST'].includes(targetType))
      return res.status(400).json({ error: 'targetType không hợp lệ' })
    if (!targetId) return res.status(400).json({ error: 'Thiếu targetId' })
    if (!reason || reason.trim().length < 3)
      return res.status(400).json({ error: 'Lý do tối thiểu 3 ký tự' })

    // Snapshot a short preview of the reported content.
    let preview = null
    if (targetType === 'POST') {
      const p = await prisma.forumPost.findUnique({ where: { id: targetId } })
      if (!p) return res.status(404).json({ error: 'Không tìm thấy bài viết' })
      preview = p.contentMd.slice(0, 140)
    } else {
      const t = await prisma.thread.findUnique({ where: { id: targetId } })
      if (!t) return res.status(404).json({ error: 'Không tìm thấy chủ đề' })
      preview = t.title
    }
    await prisma.report.create({
      data: {
        reporterId: user.id,
        reporterName: user.displayName || user.username,
        targetType,
        targetId,
        targetPreview: preview,
        reason: reason.trim(),
      },
    })
    res.status(201).json({ ok: true })
  })
)

// ================= Moderation (MODERATOR / ADMIN) =================
app.get(
  '/api/mod/summary',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const [openReports, activeBans, deletedPosts, lockedThreads, pendingListings] =
      await Promise.all([
        prisma.report.count({ where: { status: 'OPEN' } }),
        prisma.ban.count({ where: { active: true } }),
        prisma.forumPost.count({ where: { deleted: true } }),
        prisma.thread.count({ where: { locked: true } }),
        prisma.listing.count({ where: { status: 'PENDING' } }),
      ])
    res.json({
      moderator: { username: mod.username, role: mod.role },
      openReports,
      activeBans,
      deletedPosts,
      lockedThreads,
      pendingListings,
    })
  })
)

app.get(
  '/api/mod/reports',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const status = (req.query.status || 'OPEN').toUpperCase()
    const reports = await prisma.report.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json(reports)
  })
)

app.post(
  '/api/mod/reports/:id/resolve',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const action = (req.body && req.body.action) === 'dismiss' ? 'DISMISSED' : 'RESOLVED'
    const report = await prisma.report.findUnique({ where: { id: req.params.id } })
    if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' })
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: action,
        resolvedById: mod.id,
        resolvedByName: mod.displayName || mod.username,
        resolvedAt: new Date(),
        resolution: (req.body && req.body.note) || null,
      },
    })
    await logModAction(
      mod,
      action === 'RESOLVED' ? 'RESOLVE_REPORT' : 'DISMISS_REPORT',
      'report',
      report.id,
      report.targetPreview,
      req.body && req.body.note
    )
    res.json({ ok: true, status: action })
  })
)

app.post(
  '/api/mod/threads/:id/pin',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const t = await prisma.thread.findUnique({ where: { id: req.params.id } })
    if (!t) return res.status(404).json({ error: 'Không tìm thấy chủ đề' })
    const updated = await prisma.thread.update({ where: { id: t.id }, data: { pinned: !t.pinned } })
    await logModAction(mod, updated.pinned ? 'PIN' : 'UNPIN', 'thread', t.id, t.title)
    res.json({ pinned: updated.pinned })
  })
)

app.post(
  '/api/mod/threads/:id/lock',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const t = await prisma.thread.findUnique({ where: { id: req.params.id } })
    if (!t) return res.status(404).json({ error: 'Không tìm thấy chủ đề' })
    const updated = await prisma.thread.update({ where: { id: t.id }, data: { locked: !t.locked } })
    await logModAction(mod, updated.locked ? 'LOCK' : 'UNLOCK', 'thread', t.id, t.title)
    res.json({ locked: updated.locked })
  })
)

app.post(
  '/api/mod/posts/:id/delete',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const p = await prisma.forumPost.findUnique({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ error: 'Không tìm thấy bài viết' })
    const updated = await prisma.forumPost.update({
      where: { id: p.id },
      data: { deleted: !p.deleted, deletedAt: p.deleted ? null : new Date() },
    })
    await logModAction(
      mod,
      'DELETE_POST',
      'post',
      p.id,
      p.contentMd.slice(0, 80),
      updated.deleted ? 'gỡ' : 'khôi phục'
    )
    res.json({ deleted: updated.deleted })
  })
)

app.post(
  '/api/mod/users/:username/ban',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const target = await prisma.user.findUnique({ where: { username: req.params.username } })
    if (!target) return res.status(404).json({ error: 'Không tìm thấy thành viên' })
    if (hasAtLeastRole(target.role, 'MODERATOR'))
      return res.status(403).json({ error: 'Không thể cấm kiểm duyệt viên/quản trị' })
    const { reason, days } = req.body || {}
    const until = days && Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400000) : null
    await prisma.ban.updateMany({
      where: { username: target.username, active: true },
      data: { active: false },
    })
    const ban = await prisma.ban.create({
      data: {
        userId: target.id,
        username: target.username,
        moderatorName: mod.displayName || mod.username,
        reason: (reason || 'Vi phạm nội quy').trim(),
        until,
        active: true,
      },
    })
    await logModAction(
      mod,
      'BAN_USER',
      'user',
      target.id,
      target.username,
      until ? `${days} ngày` : 'vĩnh viễn'
    )
    res.status(201).json({ id: ban.id, until: ban.until })
  })
)

app.post(
  '/api/mod/users/:username/unban',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const target = await prisma.user.findUnique({ where: { username: req.params.username } })
    if (!target) return res.status(404).json({ error: 'Không tìm thấy thành viên' })
    await prisma.ban.updateMany({
      where: { username: target.username, active: true },
      data: { active: false },
    })
    await logModAction(mod, 'UNBAN_USER', 'user', target.id, target.username)
    res.json({ ok: true })
  })
)

app.get(
  '/api/mod/audit',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const actions = await prisma.modAction.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    res.json(actions)
  })
)

// Listing moderation queue
app.get(
  '/api/mod/listings',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const listings = await prisma.listing.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })
    res.json(listings)
  })
)

app.post(
  '/api/mod/listings/:id/approve',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } })
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin đăng' })
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'ACTIVE' } })
    await logModAction(mod, 'RESOLVE_REPORT', 'listing', l.id, l.title, 'duyệt tin đăng')
    res.json({ status: 'ACTIVE' })
  })
)

app.post(
  '/api/mod/listings/:id/reject',
  asyncHandler(async (req, res) => {
    const mod = await requireModerator(req, res)
    if (!mod) return
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } })
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin đăng' })
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'REJECTED' } })
    await logModAction(mod, 'DISMISS_REPORT', 'listing', l.id, l.title, 'từ chối tin đăng')
    res.json({ status: 'REJECTED' })
  })
)

// ================= Messaging (auth required) =================
async function sellerRating(sellerId) {
  const rated = await prisma.order.findMany({
    where: { sellerId, rating: { not: null } },
    select: { rating: true },
  })
  if (!rated.length) return { avg: null, count: 0 }
  return {
    avg: Math.round((rated.reduce((s, o) => s + o.rating, 0) / rated.length) * 10) / 10,
    count: rated.length,
  }
}

app.get(
  '/api/messages/conversations',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    })
    const items = parts
      .map((p) => {
        const c = p.conversation
        const other = c.participants.find((x) => x.userId !== user.id)
        const last = c.messages[0]
        const unread =
          last && (!p.lastReadAt || last.createdAt > p.lastReadAt) && last.senderId !== user.id
        return {
          id: c.id,
          with: other ? other.username : '?',
          lastMessage: last ? last.body : '',
          lastMessageAt: c.lastMessageAt,
          unread: !!unread,
        }
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    res.json(items)
  })
)

app.get(
  '/api/messages/unread',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.json({ count: 0 })
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      include: {
        conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    })
    let count = 0
    for (const p of parts) {
      const last = p.conversation.messages[0]
      if (last && last.senderId !== user.id && (!p.lastReadAt || last.createdAt > p.lastReadAt))
        count++
    }
    res.json({ count })
  })
)

app.post(
  '/api/messages/conversations',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const targetName = ((req.body && req.body.username) || '').trim()
    if (!targetName) return res.status(400).json({ error: 'Thiếu username' })
    const target = await prisma.user.findUnique({ where: { username: targetName } })
    if (!target) return res.status(404).json({ error: 'Không tìm thấy thành viên' })
    if (target.id === user.id)
      return res.status(400).json({ error: 'Không thể nhắn cho chính mình' })

    // find existing 1:1 conversation
    const mine = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    })
    const ids = mine.map((m) => m.conversationId)
    let convo = null
    if (ids.length) {
      const shared = await prisma.conversationParticipant.findFirst({
        where: { userId: target.id, conversationId: { in: ids } },
      })
      if (shared) convo = { id: shared.conversationId }
    }
    if (!convo) {
      convo = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: user.id, username: user.username },
              { userId: target.id, username: target.username },
            ],
          },
        },
      })
    }
    res.status(201).json({ id: convo.id })
  })
)

app.get(
  '/api/messages/conversations/:id',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const part = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: user.id },
    })
    if (!part) return res.status(403).json({ error: 'Không có quyền truy cập' })
    const convo = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { participants: true, messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    })
    const other = convo.participants.find((x) => x.userId !== user.id)
    await prisma.conversationParticipant
      .update({ where: { id: part.id }, data: { lastReadAt: new Date() } })
      .catch(() => {})
    res.json({
      id: convo.id,
      with: other ? other.username : '?',
      messages: convo.messages.map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderId === user.id,
        senderName: m.senderName,
        createdAt: m.createdAt,
      })),
    })
  })
)

app.post(
  '/api/messages/conversations/:id',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const ban = await activeBanFor(user.username)
    if (ban) return res.status(403).json({ error: `Tài khoản của bạn đang bị cấm: ${ban.reason}` })
    const part = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: user.id },
    })
    if (!part) return res.status(403).json({ error: 'Không có quyền' })
    const body = ((req.body && req.body.body) || '').trim()
    if (!body) return res.status(400).json({ error: 'Nội dung trống' })
    const msg = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: user.id,
        senderName: user.displayName || user.username,
        body,
      },
    })
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { lastMessageAt: new Date() },
    })
    res.status(201).json({ id: msg.id })
  })
)

// ================= Marketplace =================
app.get(
  '/api/market/listings',
  asyncHandler(async (req, res) => {
    const status = (req.query.status || 'ACTIVE').toUpperCase()
    let where = { status }
    if (req.query.mine) {
      const user = await currentUser(req)
      if (user) where = { sellerId: user.id }
    }
    const listings = await prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json(listings)
  })
)

app.get(
  '/api/market/listings/:id',
  asyncHandler(async (req, res) => {
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } })
    if (!l) return res.status(404).json({ error: 'Không tìm thấy tin đăng' })
    const rating = await sellerRating(l.sellerId)
    res.json({ ...l, sellerRating: rating })
  })
)

app.post(
  '/api/market/listings',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const ban = await activeBanFor(user.username)
    if (ban) return res.status(403).json({ error: `Tài khoản của bạn đang bị cấm: ${ban.reason}` })
    const { title, description, priceCredits, category } = req.body || {}
    if (!title || title.trim().length < 3)
      return res.status(400).json({ error: 'Tiêu đề tối thiểu 3 ký tự' })
    const price = parseInt(priceCredits)
    if (!(price >= 0)) return res.status(400).json({ error: 'Giá không hợp lệ' })
    const listing = await prisma.listing.create({
      data: {
        sellerId: user.id,
        sellerName: user.displayName || user.username,
        title: title.trim(),
        description: (description || '').trim(),
        priceCredits: price,
        category: (category || 'general').trim(),
        status: 'PENDING',
      },
    })
    res.status(201).json({ id: listing.id, status: listing.status })
  })
)

app.post(
  '/api/market/listings/:id/buy',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } })
    if (!listing) return res.status(404).json({ error: 'Không tìm thấy tin đăng' })
    if (listing.status !== 'ACTIVE')
      return res.status(400).json({ error: 'Tin đăng không khả dụng' })
    if (listing.sellerId === user.id)
      return res.status(400).json({ error: 'Không thể mua tin của chính bạn' })
    if (user.credits < listing.priceCredits)
      return res.status(400).json({ error: 'Không đủ tín dụng' })

    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: listing.priceCredits } },
      })
      return tx.order.create({
        data: {
          listingId: listing.id,
          buyerId: user.id,
          buyerName: user.displayName || user.username,
          sellerId: listing.sellerId,
          amountCredits: listing.priceCredits,
          status: 'HELD',
        },
      })
    })
    res
      .status(201)
      .json({ id: order.id, status: order.status, message: 'Đã giữ tín dụng trong ký quỹ' })
  })
)

app.get(
  '/api/market/orders',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const orders = await prisma.order.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(
      orders.map((o) => ({
        id: o.id,
        title: o.listing.title,
        amountCredits: o.amountCredits,
        status: o.status,
        role: o.buyerId === user.id ? 'buyer' : 'seller',
        rating: o.rating,
        createdAt: o.createdAt,
      }))
    )
  })
)

app.post(
  '/api/market/orders/:id/release',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    if (order.buyerId !== user.id)
      return res.status(403).json({ error: 'Chỉ người mua mới xác nhận' })
    if (order.status !== 'HELD')
      return res.status(400).json({ error: 'Đơn không ở trạng thái ký quỹ' })
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'RELEASED' } })
      await tx.user.update({
        where: { id: order.sellerId },
        data: { credits: { increment: order.amountCredits } },
      })
      await tx.listing.update({ where: { id: order.listingId }, data: { status: 'SOLD' } })
    })
    res.json({ status: 'RELEASED', message: 'Đã giải ngân cho người bán' })
  })
)

app.post(
  '/api/market/orders/:id/refund',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    const isMod = hasAtLeastRole(user.role, 'MODERATOR')
    if (order.buyerId !== user.id && !isMod)
      return res.status(403).json({ error: 'Không có quyền' })
    if (order.status !== 'HELD')
      return res.status(400).json({ error: 'Đơn không ở trạng thái ký quỹ' })
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } })
      await tx.user.update({
        where: { id: order.buyerId },
        data: { credits: { increment: order.amountCredits } },
      })
      await tx.listing.update({ where: { id: order.listingId }, data: { status: 'ACTIVE' } })
    })
    res.json({ status: 'REFUNDED', message: 'Đã hoàn tín dụng cho người mua' })
  })
)

app.post(
  '/api/market/orders/:id/rate',
  asyncHandler(async (req, res) => {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Bạn cần đăng nhập' })
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    if (order.buyerId !== user.id)
      return res.status(403).json({ error: 'Chỉ người mua mới đánh giá' })
    if (order.status !== 'RELEASED')
      return res.status(400).json({ error: 'Chỉ đánh giá đơn đã hoàn tất' })
    const rating = Math.max(1, Math.min(5, parseInt(req.body && req.body.rating) || 0))
    await prisma.order.update({
      where: { id: order.id },
      data: { rating, ratingComment: ((req.body && req.body.comment) || '').trim() || null },
    })
    res.json({ ok: true, rating })
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
  app.listen(port, () => console.log(`content-service listening on ${port}`))
}

if (process.env.NODE_ENV !== 'test') startServer().catch(() => {})

module.exports = { app, startServer }
