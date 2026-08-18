'use strict'
require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env - nạp thêm .env ở
// gốc repo để service chạy được cả khi khởi động ngoài `npm run dev:local`.
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}
try {
  require('../../../packages/observability/initSentry').initServer({ service: 'newsroom-service' })
} catch (e) {
  // ignore
}

import express from 'express'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import cors from 'cors'
import { prisma } from '@tsudev/db'
import { createAuthMiddleware, requireRole } from '@tsudev/auth'
import { tick } from './dispatcher'
import { DAILY_NEURON_BUDGET, neuronsUsedToday } from './llm'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const clientError = (e: unknown): string =>
  process.env.NODE_ENV === 'production' ? 'internal error' : errMsg(e) || 'internal error'

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'newsroom-service' }))

/**
 * RANH GIỚI XÁC THỰC - gắn theo NHÁNH, giống trust-service, không cho cả `/api`.
 *
 * Bề mặt này chia làm hai nửa và cả hai đều PHẢI được khai rõ ràng:
 *
 *   - `/api/newsroom/tick`  : máy gọi máy. Gác bằng NEWSROOM_TICK_TOKEN, KHÔNG
 *     phải bằng danh tính người dùng - Worker cron không có phiên đăng nhập.
 *   - `/api/newsroom/state` và mọi nhánh còn lại : chỉ ADMIN. Đây là bảng điều
 *     khiển vận hành, không phải nội dung công khai.
 *
 * Không có nhánh công khai nào. Thêm route mới ⇒ phải chọn một bên, và
 * test/authCoverage.test.ts sẽ bắt nếu quên.
 */
const AUTH_PREFIXES = ['/api/newsroom/state', '/api/newsroom/admin']
const TOKEN_PREFIXES = ['/api/newsroom/tick']

const auth = createAuthMiddleware('newsroom-service')
for (const p of AUTH_PREFIXES) {
  app.use(p, auth, requireRole('ADMIN'))
}

/**
 * Cổng cho nhịp đập của cron.
 *
 * So sánh phải là hằng thời gian? Không cần: token này chỉ kích hoạt một lượt
 * xử lý hàng đợi, không tiết lộ và không sửa dữ liệu người dùng. Nhưng nó VẪN
 * phải có - để mở thì bất kỳ ai cũng ép toà soạn đốt sạch hạn mức Neuron trong
 * vài phút, và đó là một kiểu DoS vào ví (ở đây là vào hạn mức).
 */
const tickGate: RequestHandler = (req, res, next) => {
  const expected = process.env.NEWSROOM_TICK_TOKEN
  if (!expected) {
    return res.status(503).json({ error: 'NEWSROOM_TICK_TOKEN chưa được cấu hình' })
  }
  const got = req.get('x-newsroom-token')
  if (got !== expected) return res.status(401).json({ error: 'unauthorized' })
  next()
}
for (const p of TOKEN_PREFIXES) {
  app.use(p, tickGate)
}

// --------------------------------------------------------------------------
// Nhịp đập
// --------------------------------------------------------------------------

/**
 * Trả 202 NGAY, chạy việc ở nền.
 *
 * Một lượt gọi LLM mất 30-60 giây. Giữ kết nối HTTP mở suốt thời gian đó qua
 * Cloudflare Worker là tự tạo timeout, và cron sẽ báo lỗi cho một lượt chạy
 * thật ra đã thành công. Tiến trình Node sống lâu nên promise nền chạy tiếp
 * bình thường; cái giá là lượt chạy có thể chết giữa chừng khi Render restart,
 * và đó là lý do dispatcher có reclaimStale().
 */
app.post(
  '/api/newsroom/tick',
  asyncHandler(async (req, res) => {
    res.status(202).json({ accepted: true })
    tick().catch((err) => {
      console.error('[newsroom] tick thất bại:', errMsg(err))
    })
  })
)

// --------------------------------------------------------------------------
// Trạng thái cho dashboard
// --------------------------------------------------------------------------

app.get(
  '/api/newsroom/state',
  asyncHandler(async (req, res) => {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined

    const [agents, drafts, channels, sources, budgetUsed] = await Promise.all([
      prisma.agentProfile.findMany({ orderBy: { dept: 'asc' } }),
      prisma.contentDraft.findMany({
        where: { deletedAt: null, status: { not: 'ARCHIVED' } },
        orderBy: { updatedAt: 'desc' },
        take: 120,
        select: {
          id: true,
          target: true,
          status: true,
          title: true,
          slug: true,
          revisionCount: true,
          reviewFeedback: true,
          authorAgentId: true,
          updatedAt: true,
        },
      }),
      prisma.newsroomChannel.findMany(),
      prisma.newsroomSource.findMany({ orderBy: { label: 'asc' } }),
      neuronsUsedToday(),
    ])

    // Nhật ký: lấy các sự kiện MỚI HƠN con trỏ. Con trỏ là id của sự kiện cuối
    // cùng client đã thấy; dùng createdAt của nó làm mốc thay vì so id, vì cuid
    // không sắp xếp được theo thời gian.
    const cursor = since
      ? await prisma.newsroomEvent.findUnique({ where: { id: since }, select: { createdAt: true } })
      : null

    const events = await prisma.newsroomEvent.findMany({
      where: cursor ? { createdAt: { gt: cursor.createdAt } } : {},
      orderBy: { createdAt: 'desc' },
      take: 80,
    })

    // Số đo cho sàn ảo: chỉ 5 phút gần nhất, đủ để thấy "đang bận" mà không
    // phải quét cả bảng AgentRun ở mỗi lượt poll 3 giây.
    const recent = await prisma.agentRun.findMany({
      where: { startedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
      select: {
        agentId: true,
        inputTokens: true,
        outputTokens: true,
        endedAt: true,
        startedAt: true,
      },
    })

    const metrics: Record<string, { tokensPerMin: number; avgMs: number; runs: number }> = {}
    for (const a of agents) {
      const mine = recent.filter((r) => r.agentId === a.id)
      const done = mine.filter((r) => r.endedAt)
      metrics[a.id] = {
        tokensPerMin: Math.round(mine.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0) / 5),
        avgMs: done.length
          ? Math.round(
              done.reduce((s, r) => s + (r.endedAt!.getTime() - r.startedAt.getTime()), 0) /
                done.length
            )
          : 0,
        runs: mine.length,
      }
    }

    res.json({
      enabled: process.env.NEWSROOM_ENABLED === 'true',
      budget: { used: budgetUsed, limit: DAILY_NEURON_BUDGET() },
      agents,
      metrics,
      drafts,
      channels,
      sources,
      events,
      cursor: events[0]?.id ?? since ?? null,
    })
  })
)

app.get(
  '/api/newsroom/state/draft/:id',
  asyncHandler(async (req, res) => {
    const draft = await prisma.contentDraft.findUnique({
      where: { id: req.params.id },
      include: { revisions: { orderBy: { seq: 'asc' } } },
    })
    if (!draft) return res.status(404).json({ error: 'Không tìm thấy bản nháp' })
    res.json(draft)
  })
)

// --------------------------------------------------------------------------
// Điều khiển - CHỈ ADMIN
//
// KHÔNG có động từ DELETE ở bất kỳ đâu trong tệp này. Đó là tầng chặn thứ nhất
// và rẻ nhất: agent không có route nào để gọi. Xoá nằm ở content-service dưới
// /api/admin, và luôn là xoá mềm. test/noDeleteVerb.test.ts canh điều này.
// --------------------------------------------------------------------------

app.post(
  '/api/newsroom/admin/agent/:slug/suspend',
  asyncHandler(async (req, res) => {
    const suspend = req.body?.suspend !== false
    const agent = await prisma.agentProfile.update({
      where: { slug: req.params.slug },
      data: {
        suspendedAt: suspend ? new Date() : null,
        status: suspend ? 'SUSPENDED' : 'IDLE',
        statusNote: suspend ? 'bị treo bởi quản trị viên' : null,
      },
    })
    await prisma.newsroomEvent.create({
      data: {
        type: suspend ? 'agent.suspended' : 'agent.resumed',
        status: 'DONE',
        actorKind: 'human',
        agentId: agent.id,
        payload: { slug: agent.slug },
      },
    })
    res.json(agent)
  })
)

app.patch(
  '/api/newsroom/admin/channel/:target',
  asyncHandler(async (req, res) => {
    const data: Record<string, unknown> = {}
    if (typeof req.body?.autonomy === 'string') {
      if (!['FULL_AUTO', 'HUMAN_APPROVAL', 'DRAFT_ONLY'].includes(req.body.autonomy)) {
        return res.status(400).json({ error: 'autonomy không hợp lệ' })
      }
      data.autonomy = req.body.autonomy
    }
    if (typeof req.body?.enabled === 'boolean') data.enabled = req.body.enabled
    if (Number.isInteger(req.body?.dailyPostCap)) data.dailyPostCap = req.body.dailyPostCap
    if (typeof req.body?.styleGuide === 'string') data.styleGuide = req.body.styleGuide
    if (!Object.keys(data).length) return res.status(400).json({ error: 'không có gì để sửa' })

    const ch = await prisma.newsroomChannel.update({
      where: { target: req.params.target as never },
      data,
    })
    res.json(ch)
  })
)

/// Người duyệt tay một bản nháp đang chờ (chuyên mục đặt HUMAN_APPROVAL, hoặc
/// đã cạn số vòng sửa). Ghi nhật ký với actorKind="human" để phân biệt rõ.
app.post(
  '/api/newsroom/admin/draft/:id/approve',
  asyncHandler(async (req, res) => {
    const draft = await prisma.contentDraft.findUnique({ where: { id: req.params.id } })
    if (!draft || draft.deletedAt) return res.status(404).json({ error: 'Không tìm thấy bản nháp' })
    if (draft.status === 'PUBLISHED') return res.status(409).json({ error: 'Bản nháp đã đăng' })

    await prisma.newsroomEvent.create({
      data: {
        type: 'publish.requested',
        actorKind: 'human',
        draftId: draft.id,
        payload: { by: 'admin' },
      },
    })
    res.json({ ok: true, queued: true })
  })
)

/// Chủ đề nhập tay - luôn ưu tiên cao nhất, bỏ qua vòng săn tin.
app.post(
  '/api/newsroom/admin/idea',
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title ?? '').trim()
    const target = String(req.body?.target ?? 'BLOG')
    if (title.length < 8) return res.status(400).json({ error: 'tiêu đề quá ngắn' })
    if (!['BLOG', 'DOC', 'PROJECT', 'TRUST'].includes(target)) {
      return res.status(400).json({ error: 'target không hợp lệ' })
    }
    const { fingerprint } = require('./sources') as typeof import('./sources')
    const fp = fingerprint(title)
    if (await prisma.topicIdea.findUnique({ where: { fingerprint: fp } })) {
      return res.status(409).json({ error: 'chủ đề này đã có trong hàng đợi' })
    }
    const idea = await prisma.topicIdea.create({
      data: {
        title,
        rationale: String(req.body?.rationale ?? 'Chủ đề do chủ dự án đặt.').slice(0, 500),
        target: target as never,
        sourceUrls: Array.isArray(req.body?.sourceUrls) ? req.body.sourceUrls.slice(0, 5) : [],
        score: 100,
        fingerprint: fp,
      },
    })
    await prisma.newsroomEvent.create({
      data: {
        type: 'idea.created',
        actorKind: 'human',
        payload: { ideaId: idea.id, title: idea.title },
      },
    })
    res.status(201).json(idea)
  })
)

// Khuôn giống trust-service: khai kiểu ErrorRequestHandler ở biến, không ép
// kiểu tại chỗ. Express nhận diện middleware lỗi bằng SỐ THAM SỐ (phải là 4),
// nên `next` bắt buộc có mặt dù không dùng - bỏ nó đi là handler này im lặng
// biến thành middleware thường và mọi lỗi rơi xuống handler mặc định.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[newsroom] error', errMsg(err), `${req.method} ${req.url}`)
  if (res && !res.headersSent) res.status(500).json({ error: clientError(err) })
}
app.use(errorHandler)

function startServer(): void {
  const port = parseInt(process.env.NEWSROOM_SERVICE_PORT || '4005', 10)
  app.listen(port, () => console.log(`newsroom-service nghe ở :${port}`))
}

if (require.main === module) startServer()

export { app, startServer, AUTH_PREFIXES, TOKEN_PREFIXES }
