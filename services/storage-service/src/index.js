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
  require('../../../packages/observability/initSentry').initServer({ service: 'storage-service' })
} catch (e) {
  // ignore
}
const express = require('express')
// body parsing: use built-in express.json/raw instead of external body-parser
const cors = require('cors')
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { prisma } = require('@tsudev/db')

const app = express()
const port = process.env.PORT || process.env.PORT_STORAGE_SERVICE || 4002

// Basic request logging for troubleshooting
app.use((req, res, next) => {
  console.log(`[storage] ${req.method} ${req.url}`)
  next()
})

app.use(cors())
app.use(express.json())

// Log JSON request bodies for troubleshooting small requests (safe-size only)
app.use((req, res, next) => {
  try {
    const ct = (req.headers['content-type'] || '').toLowerCase()
    if (ct.includes('application/json') && req.method !== 'GET') {
      console.log('[storage] request body:', JSON.stringify(req.body))
    }
  } catch (e) {
    /* body không tuần tự hoá được — chỉ là log gỡ rối, không chặn request */
  }
  next()
})

// Helper to wrap async route handlers and forward errors to express
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

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
async function generatePresign(cmd) {
  if (isTest) return `http://localhost/fake-presign/${Date.now()}`
  return await getSignedUrl(s3Signer, cmd, { expiresIn: 900 })
}

// Auth middleware (Keycloak JWKS verifier)
let auth
try {
  auth = require('./authMiddleware')
} catch (e) {
  // If middleware is missing, fall back to a permissive no-op (useful for quick local dev)
  auth = (req, res, next) => next()
}

// helper to get role-enforcement middleware from the auth module (fallback to noop)
const requireRole = (role) =>
  auth && auth.requireRole ? auth.requireRole(role) : (req, res, next) => next()

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
  } catch (err) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
      console.log('Created bucket', S3_BUCKET)
    } catch (createErr) {
      console.warn('Create bucket failed (may already exist):', createErr.message || createErr)
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
    console.warn(
      'Failed to apply CORS policy:',
      corsErr && corsErr.message ? corsErr.message : corsErr
    )
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'storage-service' }))

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
  requireRole(process.env.STORAGE_PRESIGN_ROLE || 'storage:presign'),
  asyncHandler(async (req, res) => {
    const fileName = req.query.fileName || req.query.key || `upload-${Date.now()}`
    const contentType = req.query.contentType || 'application/octet-stream'
    const objectKey = `${Date.now()}-${(fileName || 'upload')
      .toString()
      .replace(/[^a-zA-Z0-9._-]/g, '-')}`
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
  requireRole(process.env.STORAGE_PRESIGN_ROLE || 'storage:presign'),
  asyncHandler(async (req, res) => {
    const { key, fileName, contentType } = req.body || {}
    const objectKey =
      key || `${Date.now()}-${(fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '-')}`
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
  requireRole(process.env.STORAGE_UPLOAD_ROLE || 'storage:upload'),
  express.raw({ type: '*/*', limit: '100mb' }),
  asyncHandler(async (req, res) => {
    const keyQuery = (req.query && req.query.key) || null
    const fileName = req.headers['x-filename'] || keyQuery || `upload-${Date.now()}`
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
        console.warn(
          '[storage] S3 put failed, cataloging metadata only:',
          e && e.message ? e.message : e
        )
      }
    }
    const size = req.body.length
    await prisma.fileObject
      .upsert({
        where: { key: fileName },
        update: { size, contentType, fileName },
        create: { key: fileName, fileName, contentType, size },
      })
      .catch((e) => console.warn('[storage] catalog write failed:', e && e.message))
    res.json({ key: fileName, size, storageWarning })
  })
)

// Global express error handler to avoid crashes with undefined res
// Express chỉ nhận diện đây là middleware xử lý lỗi khi hàm khai đủ 4 tham số;
// bỏ `next` cho hết lint thì toàn bộ xử lý lỗi im lặng ngừng hoạt động.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
  try {
    console.error('[storage] Express error:', err && (err.stack || err.message || err))
    try {
      require('../../../packages/observability/notify').alert({
        service: 'storage-service',
        level: 'error',
        message: err && err.message,
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
    if (res && !res.headersSent)
      return res.status(500).json({ error: err && err.message ? err.message : 'internal error' })
  } catch (e) {
    console.error('[storage] Error sending error response', e)
  }
  next(err)
})

// Register process-level handlers only if available to avoid crashes in
// unusual runtime environments where `process.on` may be absent or replaced.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('uncaughtException', (err) => {
    console.error('[storage] uncaughtException', err && (err.stack || err.message || err))
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[storage] unhandledRejection', reason && (reason.stack || reason))
  })
} else {
  console.warn('[storage] process.on is not available; skipping global error handlers')
}

async function startServer() {
  await ensureBucket()
  app.listen(port, () => {
    console.log(`storage-service listening on ${port}`)
    try {
      // Enumerate registered routes for quick verification
      const routes = []
      if (app && app._router && app._router.stack) {
        app._router.stack.forEach((layer) => {
          if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods || {})
              .map((m) => m.toUpperCase())
              .join(',')
            routes.push(`${methods} ${layer.route.path}`)
          } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
            layer.handle.stack.forEach((rl) => {
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

// Only start the server when not running tests; export the app for unit tests
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[storage] failed to start', err && (err.stack || err))
  })
}

module.exports = { app, startServer }
