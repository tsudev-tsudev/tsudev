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
  require('../../../packages/observability/initSentry').initServer({ service: 'storage-service' })
} catch (e) {
  // ignore
}
import express from 'express'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'

/** Khoá do CHÍNH service này cấp: dấu thời gian + tên đã làm sạch. */
const ISSUED_KEY_RE = /^\d{10,}-[A-Za-z0-9._-]{1,200}$/

const MAX_KEY_LEN = 200

/**
 * Dựng khoá object S3 an toàn từ dữ liệu do người gọi cung cấp.
 *
 * Vì sao cần: `POST /api/presign` trước đây nhận `key` từ thân request và dùng
 * NGUYÊN XI, còn `POST /api/upload` dùng thẳng header `x-filename`. Nghĩa là bất
 * kỳ ai đăng nhập được cũng chọn được khoá tuỳ ý - ghi đè object của người khác,
 * hoặc viết ra ngoài tiền tố mong đợi. Không có gì chặn, và không có gì báo lỗi.
 *
 * Ba việc hàm này làm:
 *  1. Bỏ mọi thành phần đường dẫn (`a/b/../c` → `c`) - khoá luôn phẳng.
 *  2. Ràng bộ ký tự và cắt độ dài.
 *  3. Gắn dấu thời gian ở đầu, nên KHÔNG BAO GIỜ trùng khoá đã có. Chính điều
 *     này loại bỏ khả năng ghi đè, chứ không phải việc lọc ký tự.
 *
 * `allowIssued` dành riêng cho nhánh upload phía server: ở đó khoá đến từ bước
 * presign TRƯỚC ĐÓ của chính service này, và phải giữ nguyên thì tệp mới nằm
 * đúng chỗ đã ký. Chỉ khoá khớp đúng khuôn đã cấp mới được đi qua.
 */
function safeObjectKey(raw: unknown, opts: { allowIssued?: boolean } = {}): string {
  const leaf =
    String(raw ?? '')
      .split(/[\\/]/)
      .pop() ?? ''
  const cleaned = leaf
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/^\.+/, '')
    .slice(0, MAX_KEY_LEN)
  if (opts.allowIssued && ISSUED_KEY_RE.test(cleaned)) return cleaned
  return `${Date.now()}-${cleaned || 'upload'}`
}

/** Thông điệp lỗi từ một giá trị `catch` (luôn là `unknown`). */
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Hình dạng nội bộ của một lớp router Express - chỉ phần thực sự được đọc. */
type RouterLayer = {
  name?: string
  route?: { path?: string; methods?: Record<string, boolean> }
  handle?: { stack?: RouterLayer[] }
}
const errStack = (e: unknown): string => (e instanceof Error ? e.stack || e.message : String(e))

/**
 * Thông điệp lỗi trả cho CLIENT.
 *
 * Ở production luôn là chuỗi chung: `err.message` của Node hay mang theo đường
 * dẫn tệp trên máy chủ, tên bảng, hoặc cả chuỗi kết nối - thứ giúp người dò tìm
 * dựng bản đồ hệ thống. Chi tiết vẫn được ghi đầy đủ vào log phía máy chủ.
 */
const clientError = (e: unknown): string =>
  process.env.NODE_ENV === 'production' ? 'internal error' : errMsg(e) || 'internal error'

/**
 * Tham số truy vấn do người gọi điều khiển hình dạng: `?k=1` cho chuỗi,
 * `?k=1&k=2` cho mảng, `?k[a]=1` cho object. Chỉ chuỗi mới được đi tiếp.
 */
const qStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
// body parsing: use built-in express.json/raw instead of external body-parser
import cors from 'cors'
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3')
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@tsudev/db'
import { createAuthMiddleware, requireRole } from '@tsudev/auth'
import { createRateLimit } from '@tsudev/ratelimit'

const app = express()
const port = process.env.PORT || process.env.PORT_STORAGE_SERVICE || 4002
// Mặc định 0.0.0.0 - đừng đổi: bind loopback bên trong container là tự cắt liên
// lạc giữa các container. Máy dev đặt BIND_HOST=127.0.0.1 qua .env (topology).
const bindHost = process.env.BIND_HOST || '0.0.0.0'

// Basic request logging for troubleshooting
app.use((req, res, next) => {
  console.log(`[storage] ${req.method} ${req.url}`)
  next()
})

// Trước giai đoạn 4 đây là `cors()` mở cho MỌI origin - service duy nhất trình
// duyệt gọi thẳng, và cũng là service ký được URL ghi vào object storage.
// Danh sách lấy từ CORS_ALLOWED_ORIGINS (sinh bởi config/topology.json).
// Rỗng = không cấp header CORS cho ai: đúng cho production, nơi trình duyệt đi
// qua BFF của Next chứ không gọi thẳng. Lời gọi server↔server không có Origin
// nên không bị ảnh hưởng.
const ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      // Trả false (không phải Error) để không biến thành 500: không có header
      // CORS thì trình duyệt tự chặn, còn log vẫn nêu rõ ai bị từ chối.
      console.warn(`[storage] CORS từ chối origin: ${origin}`)
      return cb(null, false)
    },
  })
)
app.use(express.json())

// Header bảo mật cho mọi phản hồi của service. Ba service đều phục vụ cho bên
// thứ ba (huy hiệu SVG, JWKS, trang xác minh), nên `nosniff` ở đây không thừa:
// nó chặn trình duyệt tự diễn giải một phản hồi thành HTML thực thi được.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// Log JSON request bodies for troubleshooting small requests (safe-size only)
app.use((req, res, next) => {
  try {
    const ct = (req.headers['content-type'] || '').toLowerCase()
    if (ct.includes('application/json') && req.method !== 'GET') {
      console.log('[storage] request body:', JSON.stringify(req.body))
    }
  } catch (e) {
    /* body không tuần tự hoá được - chỉ là log gỡ rối, không chặn request */
  }
  next()
})

// Helper to wrap async route handlers and forward errors to express
// Bọc handler async: Promise bị từ chối mà không có .catch sẽ không bao giờ tới
// được error handler của Express - request treo cho tới khi client bỏ cuộc.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)

const S3_ENDPOINT = process.env.S3_ENDPOINT || process.env.S3_URL || 'http://minio:9000'
const S3_PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || null
const S3_BUCKET = process.env.S3_BUCKET || 'tsudev'
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
})

// Client used to generate presigned URLs. If a public endpoint is provided
// use it so the signed URL will be valid for browsers hitting the public host.
const s3Signer = S3_PUBLIC_ENDPOINT
  ? new S3Client({
      endpoint: S3_PUBLIC_ENDPOINT,
      region: 'us-east-1',
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
      forcePathStyle: true,
    })
  : s3

// In test mode, avoid external network/S3 dependency by stubbing presign and upload operations.
const isTest = process.env.NODE_ENV === 'test'
async function generatePresign(cmd: Parameters<typeof getSignedUrl>[1]) {
  if (isTest) return `http://localhost/fake-presign/${Date.now()}`
  return await getSignedUrl(s3Signer, cmd, { expiresIn: 900 })
}

// Xác thực dùng chung. Trước đây mỗi service giữ một bản authMiddleware gần
// trùng nhau, và CLAUDE.md phải cảnh báo "đổi hành vi xác thực phải sửa cả ba".
const auth = createAuthMiddleware('storage')

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
  } catch (err) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
      console.log('Created bucket', S3_BUCKET)
    } catch (createErr) {
      console.warn('Create bucket failed (may already exist):', errMsg(createErr))
    }
  }
  // Attempt to set a permissive CORS policy so browser PUTs to presigned URLs work
  try {
    const cors = {
      CORSRules: [
        {
          AllowedOrigins: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000,
        },
      ],
    }
    await s3.send(new PutBucketCorsCommand({ Bucket: S3_BUCKET, CORSConfiguration: cors }))
    console.log('Applied CORS policy to bucket', S3_BUCKET)
  } catch (corsErr) {
    console.warn('Failed to apply CORS policy:', errMsg(corsErr))
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'storage-service' }))

// Ba service backend nằm trên URL Render CÔNG KHAI - không giấu sau mạng nội bộ
// được, vì frontend-main chạy trên Cloudflare Workers, ngoài mạng Render. Cổng
// chặn này là lớp bù: chỉ ai biết INTERNAL_API_TOKEN mới gọi được /api.
//
// TỰ NGUYỆN: biến không đặt thì middleware là no-op, nên local dev và CI không
// đổi hành vi. Đặt nó ở Render (và cùng giá trị cho biến của frontend) là bật.
// /health đứng ngoài để health check của Render vẫn chạy.
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || ''

// Giới hạn tần suất cho lưu lượng TRỰC TIẾP (không mang internal token tin cậy).
// Presign là đích lạm dụng đắt nhất của service này (ký URL ghi vào object
// storage). Lưu lượng qua BFF mang token đúng được MIỄN TRỪ - BFF không chuyển
// IP client xuống nên giới hạn không miễn trừ sẽ gộp cả site vào một xô (xem
// @tsudev/ratelimit). Ngưỡng chặt hơn content, chỉnh được qua env.
const directLimit = createRateLimit({
  name: 'storage-direct',
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_DIRECT_MAX) || 120,
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

app.get(
  '/api/files',
  asyncHandler(async (req, res) => {
    // Prefer the DB catalog (works even when object storage is offline in local dev).
    const rows = await prisma.fileObject.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    res.json(
      rows.map((r) => ({
        key: r.key,
        fileName: r.fileName,
        size: r.size,
        contentType: r.contentType,
        createdAt: r.createdAt,
      }))
    )
  })
)

// Convenience GET presign for quick testing (query params) to avoid
// PowerShell/curl quoting issues when sending JSON bodies.
app.get(
  '/api/presign',
  auth,
  requireRole('MEMBER'),
  asyncHandler(async (req, res) => {
    const contentType = qStr(req.query.contentType) || 'application/octet-stream'
    const objectKey = safeObjectKey(qStr(req.query.fileName) || qStr(req.query.key))
    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    })
    const url = await generatePresign(cmd)
    console.log('[storage] generated presign (GET)', objectKey)
    console.log('[storage] presign URL (GET):', url)
    res.json({ url, key: objectKey })
  })
)

app.post(
  '/api/presign',
  auth,
  requireRole('MEMBER'),
  asyncHandler(async (req, res) => {
    const { fileName, contentType } = req.body || {}
    // `key` do client gửi bị BỎ QUA có chủ đích: khoá là do service cấp. Nhận
    // khoá của client ở đây chính là lỗ ghi đè nói trong safeObjectKey().
    const objectKey = safeObjectKey(fileName)
    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType || 'application/octet-stream',
    })
    const url = await generatePresign(cmd)
    console.log('[storage] presign URL (POST):', url)
    res.json({ url, key: objectKey })
  })
)

// Server-side upload fallback: accept raw binary bodies and upload to S3
app.post(
  '/api/upload',
  auth,
  requireRole('MEMBER'),
  express.raw({ type: '*/*', limit: '100mb' }),
  asyncHandler(async (req, res) => {
    // `fileName` trở thành KHOÁ OBJECT trên S3, và nó nhận từ hai nguồn do người
    // gọi điều khiển: header `x-filename` (có thể là mảng khi gửi trùng tên) và
    // query `?key=` (có thể là mảng hoặc object). Quy về đúng một chuỗi ở đây.
    //
    // Lưu ý phạm vi: đây mới chỉ là chuẩn hoá KIỂU. Việc làm sạch nội dung khoá
    // (chặn '../', ký tự điều khiển, khoá rỗng) vẫn chưa có và thuộc pha siết
    // bảo mật - ghi ra để nó không bị tưởng là đã xong.
    const headerName = req.headers['x-filename']
    const fromHeader = Array.isArray(headerName) ? headerName[0] : headerName
    const keyQuery = qStr(req.query?.key)
    // allowIssued: khoá ở đây đến từ bước presign trước đó của chính service này
    // (đường dự phòng khi PUT trực tiếp lên S3 thất bại), nên phải giữ nguyên.
    const fileName = safeObjectKey(fromHeader || keyQuery, { allowIssued: true })
    const contentType = req.headers['content-type'] || 'application/octet-stream'
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'Empty body' })
    }
    let storageWarning = null
    if (!isTest) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: fileName,
            Body: req.body,
            ContentType: contentType,
          })
        )
      } catch (e) {
        // Degrade gracefully when object storage (MinIO/R2) is unavailable in local dev:
        // still catalog the upload so the UI + /api/files reflect it.
        storageWarning = 'object-storage-unavailable'
        console.warn('[storage] S3 put failed, cataloging metadata only:', errMsg(e))
      }
    }
    const size = req.body.length
    await prisma.fileObject
      .upsert({
        where: { key: fileName },
        update: { size, contentType, fileName },
        create: { key: fileName, fileName, contentType, size },
      })
      .catch((e: unknown) => console.warn('[storage] catalog write failed:', errMsg(e)))
    res.json({ key: fileName, size, storageWarning })
  })
)

// Global express error handler to avoid crashes with undefined res
// Express chỉ nhận diện đây là middleware xử lý lỗi khi hàm khai đủ 4 tham số;
// bỏ `next` cho hết lint thì toàn bộ xử lý lỗi im lặng ngừng hoạt động.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  try {
    console.error('[storage] Express error:', err && (err.stack || err.message || err))
    try {
      require('../../../packages/observability/notify').alert({
        service: 'storage-service',
        level: 'error',
        message: errMsg(err),
        error: err,
        context: `${req.method} ${req.url}`,
      })
    } catch (e) {
      /* observability không bắt buộc; lỗi gốc đã ghi log ở trên */
    }
  } catch (e) {
    console.error('[storage] Error logging failed', e)
  }
  try {
    if (res && !res.headersSent) return res.status(500).json({ error: clientError(err) })
  } catch (e) {
    console.error('[storage] Error sending error response', e)
  }
  next(err)
}
app.use(errorHandler)

// Register process-level handlers only if available to avoid crashes in
// unusual runtime environments where `process.on` may be absent or replaced.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('uncaughtException', (err) => {
    console.error('[storage] uncaughtException', errStack(err))
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[storage] unhandledRejection', errStack(reason))
  })
} else {
  console.warn('[storage] process.on is not available; skipping global error handlers')
}

/** Chuẩn bị trước khi phục vụ. Chạy ở CẢ hai chế độ: tiến trình riêng và nhúng
 *  trong services/backend-bundle. Bỏ qua ở chế độ gộp là bucket không được tạo
 *  và mọi lần upload đầu tiên hỏng. */
async function init() {
  await ensureBucket()
}

async function startServer() {
  await init()
  app.listen(Number(port), bindHost, () => {
    console.log(`storage-service listening on ${port}`)
    try {
      // Enumerate registered routes for quick verification
      const routes: string[] = []
      if (app && app._router && app._router.stack) {
        // `_router` là nội bộ của Express, không có trong kiểu công khai. Mô tả
        // đúng phần hình dạng được đọc tới thay vì `any` - nếu Express đổi cấu
        // trúc, chỗ hỏng hiện ra ở đây chứ không im lặng trả danh sách rỗng.
        const stack =
          (app as unknown as { _router?: { stack: RouterLayer[] } })._router?.stack ?? []
        stack.forEach((layer: RouterLayer) => {
          if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods || {})
              .map((m) => m.toUpperCase())
              .join(',')
            routes.push(`${methods} ${layer.route.path}`)
          } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
            layer.handle.stack.forEach((rl: RouterLayer) => {
              if (rl.route && rl.route.path) {
                const methods = Object.keys(rl.route.methods || {})
                  .map((m) => m.toUpperCase())
                  .join(',')
                routes.push(`${methods} ${rl.route.path}`)
              }
            })
          }
        })
      }
      console.log('[storage] registered routes:\n' + routes.join('\n'))
    } catch (e) {
      console.log('[storage] failed to list routes', e)
    }
  })
}

// Only start the server when not running tests; export the app for unit tests.
// EMBEDDED=1 do services/backend-bundle đặt trước khi require file này: ở chế
// độ gộp chỉ tiến trình cha mở cổng, và chính nó gọi init(). Mở cổng riêng ở
// đây là tranh cổng với cha.
if (process.env.NODE_ENV !== 'test' && !process.env.EMBEDDED) {
  startServer().catch((err) => {
    console.error('[storage] failed to start', err && (err.stack || err))
  })
}

export { app, startServer, init }
