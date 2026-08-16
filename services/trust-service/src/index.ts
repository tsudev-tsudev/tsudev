'use strict'
require('source-map-support').install()
require('dotenv').config()
// npm workspace đặt cwd ở thư mục service, nơi không có .env — nạp thêm .env ở
// gốc repo để service chạy được cả khi khởi động ngoài `npm run dev:local`.
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}
try {
  require('../../../packages/observability/initSentry').initServer({ service: 'trust-service' })
} catch (e) {
  // ignore
}

import express from 'express'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import type { Prisma, User } from '@prisma/client'

type Notifier = { alert: (payload: Record<string, unknown>) => Promise<void> }

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const errStack = (e: unknown): string => (e instanceof Error ? e.stack || e.message : String(e))

/** Tham số truy vấn có thể là mảng hoặc object lồng — chỉ nhận chuỗi. */
const qStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * Chứng chỉ KÈM quan hệ. `GetPayload` suy ra kiểu từ chính mệnh đề `include`,
 * nên nếu sau này bỏ một quan hệ khỏi truy vấn thì mọi nơi đọc quan hệ đó thành
 * lỗi biên dịch — thay vì `undefined` lặng lẽ chảy ra JSON trả về.
 */
type CertWithRelations = Prisma.TrustCertificateGetPayload<{
  include: { domain: true; program: true }
}> & {
  /**
   * CÓ ở các endpoint công khai (verify, directory), KHÔNG CÓ khi chứng chỉ được
   * nạp lồng dưới một org — ở đó truy vấn chỉ include domain + program, vì tổ
   * chức đã là ngữ cảnh của chính trang đó.
   *
   * Vì thế `certCard` trả `organization: undefined` ở hồ sơ tổ chức. Đó là hành
   * vi sẵn có (mã cũ đã có sẵn nhánh `c.org ? … : undefined`); khai optional ở
   * đây chỉ làm nó hiện ra thay vì nằm im.
   */
  org?: Prisma.TrustOrganizationGetPayload<object> | null
}

/** Một mục trong `SealProgram.evidenceSpec` (cột Json, không có kiểu từ Prisma). */
type EvidenceSpecItem = { kind: string; label?: string; required?: boolean }
const qInt = (v: unknown, dflt: number): number => {
  const n = parseInt(qStr(v) ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : dflt
}
import { prisma } from '@tsudev/db'
import { createAuthMiddleware } from '@tsudev/auth'
import { hasAtLeastRole } from '@tsudev/types'
import crypto from 'crypto'

import * as signing from './signing'
import { renderBadge } from './badge'
import { instructionsFor, isValidHostname, verifyDomain } from './domainVerify'
import { ISSUER, effectiveStatus, issueCertificate } from './certificates'
import { config as recheckConfig, runRecheckCycle, startScheduler } from './recheck'

let notify: Notifier = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}

const app = express()
app.use(express.json({ limit: '1mb' }))
const port = process.env.PORT || process.env.PORT_TRUST_SERVICE || 4003
// Mặc định 0.0.0.0 — đừng đổi: bind loopback bên trong container là tự cắt liên
// lạc giữa các container. Máy dev đặt BIND_HOST=127.0.0.1 qua .env (topology).
const bindHost = process.env.BIND_HOST || '0.0.0.0'

// Xác thực dùng chung. Trước đây mỗi service giữ một bản authMiddleware gần
// trùng nhau, và CLAUDE.md phải cảnh báo "đổi hành vi xác thực phải sửa cả ba".
const auth = createAuthMiddleware('trust')

// Khác content-service (gắn auth cho cả /api): ở đây auth chỉ gắn cho các nhánh
// cần danh tính. Huy hiệu, trang xác thực, thư mục và danh sách chương trình
// BẮT BUỘC công khai — huy hiệu được trình duyệt của khách truy cập site bên
// thứ ba tải về, không hề có token nào đi kèm.
/**
 * Nhánh BẮT BUỘC có danh tính. Xuất ra để test kiểm được độ phủ.
 *
 * trust-service gắn auth theo NHÁNH chứ không cho cả `/api` như hai service kia,
 * vì huy hiệu SVG, trang xác minh, thư mục và JWKS phải công khai — chúng được
 * trình duyệt của khách trên site BÊN THỨ BA tải về, không hề có token nào.
 *
 * Cái giá của lựa chọn đó: mặc định là công khai. Thêm một nhánh riêng tư mà
 * quên khai ở đây thì nó lặng lẽ mở, và không có gì báo lỗi. Test
 * `authCoverage.test.ts` khoá chuyện đó lại.
 */
const AUTH_PREFIXES = [
  '/api/trust/orgs',
  '/api/trust/domains',
  '/api/trust/applications',
  '/api/trust/certificates',
  '/api/trust/admin',
]

for (const p of AUTH_PREFIXES) {
  app.use(p, auth)
}

// Bọc handler async: Promise bị từ chối mà không có .catch sẽ không bao giờ tới
// được error handler của Express — request treo cho tới khi client bỏ cuộc.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)

// --- Helpers ---------------------------------------------------------------

async function currentUser(req: Request): Promise<User | null> {
  const p = req.user
  const username = p?.preferred_username || p?.sub
  if (!username) return null
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, email: `${username}@tsudev.local`, displayName: username, role: 'MEMBER' },
  })
}

async function requireMember(req: Request, res: Response): Promise<User | null> {
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Bạn cần đăng nhập' })
    return null
  }
  return user
}

async function requireReviewer(req: Request, res: Response): Promise<User | null> {
  const user = await requireMember(req, res)
  if (!user) return null
  if (!hasAtLeastRole(user.role, 'MODERATOR')) {
    res.status(403).json({ error: 'Yêu cầu quyền kiểm duyệt viên trở lên' })
    return null
  }
  return user
}

function audit(
  actor: Pick<User, 'id' | 'displayName' | 'username'>,
  action: string,
  targetType: string,
  targetId: string,
  targetLabel: string,
  // Tuỳ chọn: nhiều nơi gọi chỉ ghi hành động, không kèm ghi chú.
  note?: string | null
) {
  return prisma.trustAuditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.displayName || actor.username,
      action,
      targetType,
      targetId,
      targetLabel: targetLabel || null,
      note: note || null,
    },
  })
}

/**
 * Các host của chính tsudev. Trang xác thực, cổng khách hàng và trang quản trị
 * đều hiển thị huy hiệu xem trước; nếu không miễn trừ thì chúng gửi Referer của
 * tsudev và bị chính cơ chế ràng buộc tên miền chấm là "sai tên miền".
 *
 * Miễn trừ này KHÔNG mở đường lách: kẻ nhúng huy hiệu trên site của họ vẫn gửi
 * Referer của site đó. Cố ý không dùng tham số kiểu ?preview=1 — thứ đó ai cũng
 * thêm được và sẽ vô hiệu hoá ràng buộc.
 */
const OWN_HOSTS = new Set(['localhost', '127.0.0.1'])
try {
  OWN_HOSTS.add(new URL(ISSUER).hostname.toLowerCase())
} catch (e) {
  /* ISSUER không phải URL tuyệt đối */
}

const certCard = (c: CertWithRelations) => ({
  serial: c.serial,
  status: effectiveStatus(c),
  storedStatus: c.status,
  basis: c.basis,
  scope: c.scope,
  hostname: c.domain ? c.domain.hostname : undefined,
  organization: c.org ? c.org.name : undefined,
  // Khoá để mở hồ sơ uy tín công khai của tổ chức. Không phải dữ liệu nhạy cảm:
  // hồ sơ đó công khai, và id đã là địa chỉ của nó.
  organizationId: c.org ? c.org.id : undefined,
  program: c.program
    ? { slug: c.program.slug, name: c.program.name, badgeVariant: c.program.badgeVariant }
    : undefined,
  issuedAt: c.issuedAt,
  expiresAt: c.expiresAt,
  revokedAt: c.revokedAt,
  revokeReason: c.revokeReason,
  verifyUrl: `${ISSUER}/trust/verify/${c.serial}`,
})

// --- Công khai --------------------------------------------------------------

app.get('/health', (req, res) =>
  res.json({
    ok: true,
    service: 'trust-service',
    signingKey: signing.kid,
    devKey: signing.usingDevKey,
    verifyKeys: signing.verifyKeyIds(),
    recheck: recheckConfig(),
  })
)

// Khoá công khai để bên thứ ba tự xác minh chữ ký, không cần tin API tsudev.
app.get('/.well-known/tsudev-trust-jwks.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  res.json(signing.jwks())
})

app.get(
  '/api/trust/programs',
  asyncHandler(async (req, res) => {
    const programs = await prisma.sealProgram.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    res.json(
      programs.map((p) => ({
        slug: p.slug,
        name: p.name,
        summary: p.summary,
        criteria: p.criteria,
        evidenceSpec: p.evidenceSpec,
        validityDays: p.validityDays,
        feeCredits: p.feeCredits,
        badgeVariant: p.badgeVariant,
      }))
    )
  })
)

app.get(
  '/api/trust/programs/:slug',
  asyncHandler(async (req, res) => {
    const p = await prisma.sealProgram.findUnique({ where: { slug: req.params.slug } })
    if (!p || !p.active) return res.status(404).json({ error: 'Không tìm thấy chương trình' })
    const issued = await prisma.trustCertificate.count({
      where: { programId: p.id, status: 'ACTIVE' },
    })
    res.json({
      slug: p.slug,
      name: p.name,
      summary: p.summary,
      criteria: p.criteria,
      evidenceSpec: p.evidenceSpec,
      validityDays: p.validityDays,
      feeCredits: p.feeCredits,
      badgeVariant: p.badgeVariant,
      issuedCount: issued,
    })
  })
)

/** Trang xác thực đọc endpoint này. Công khai, không cần đăng nhập. */
app.get(
  '/api/trust/verify/:serial',
  asyncHandler(async (req, res) => {
    const cert = await prisma.trustCertificate.findUnique({
      where: { serial: req.params.serial },
      include: { domain: true, org: true, program: true },
    })
    if (!cert)
      return res.status(404).json({ error: 'Không tìm thấy chứng chỉ', serial: req.params.serial })
    const sig = signing.verify(cert.signature)
    res.set('Cache-Control', 'public, max-age=60')
    res.json({
      ...certCard(cert),
      issuedBy: cert.issuedByName,
      signature: {
        valid: sig.valid,
        // `reason` CHỈ tồn tại ở nhánh thất bại của VerifyResult. Bản cũ đọc
        // thẳng nên khi chữ ký hợp lệ nó trả undefined — vô hại, nhưng cùng lối
        // truy cập đó ở nhánh khác lại là đọc payload chưa xác minh.
        reason: sig.valid ? null : sig.reason,
        keyId: cert.signingKeyId,
        jws: cert.signature,
      },
      payload: cert.payload,
      lastCheckAt: cert.lastCheckAt,
      lastCheckPassed: cert.lastCheckPassed,
    })
  })
)

/** Thư mục công khai các site đang có dấu — vừa minh bạch vừa tốt cho SEO. */
app.get(
  '/api/trust/directory',
  asyncHandler(async (req, res) => {
    const where: Prisma.TrustCertificateWhereInput = {
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    }
    const programSlug = qStr(req.query.program)
    if (programSlug) {
      const p = await prisma.sealProgram.findUnique({ where: { slug: programSlug } })
      if (p) where.programId = p.id
    }
    const certs = await prisma.trustCertificate.findMany({
      where,
      include: { domain: true, org: true, program: true },
      orderBy: { issuedAt: 'desc' },
      take: Math.min(100, qInt(req.query.limit, 50)),
    })
    res.json(certs.map(certCard))
  })
)

/**
 * Hồ sơ uy tín của một tổ chức — CÔNG KHAI.
 *
 * "Uy tín" ở tsudev không còn là điểm số cộng dồn theo hoạt động (cơ chế cũ của
 * diễn đàn, đã bỏ cùng ReputationEvent). Nó được DẪN RA từ dữ liệu cấp dấu đã
 * có: chứng chỉ còn hiệu lực, chứng chỉ bị thu hồi, thâm niên, và tỉ lệ vượt
 * qua các lần giám sát tên miền định kỳ.
 *
 * Cố ý KHÔNG quy về một con số duy nhất. Một điểm "87/100" trông có thẩm quyền
 * hơn nhiều so với thứ nó thật sự đo được, và người đọc không kiểm chứng được
 * cách tính. Bốn chỉ số thô, mỗi cái truy về được nguồn, trung thực hơn.
 *
 * Chỉ lộ thứ đã công khai ở nơi khác (danh bạ, trang xác thực). KHÔNG có
 * contactEmail, ownerUserId hay đơn đang chờ duyệt.
 */
app.get(
  '/api/trust/profile/:orgId',
  asyncHandler(async (req, res) => {
    const org = await prisma.trustOrganization.findUnique({
      where: { id: String(req.params.orgId) },
      include: {
        domains: { where: { status: 'VERIFIED' }, orderBy: { verifiedAt: 'asc' } },
        certificates: {
          include: { domain: true, program: true },
          orderBy: { issuedAt: 'desc' },
        },
      },
    })
    if (!org || org.status !== 'ACTIVE')
      return res.status(404).json({ error: 'Không tìm thấy tổ chức' })

    const certs = org.certificates.map((c) => ({ card: certCard(c), row: c }))
    const active = certs.filter((c) => c.card.status === 'ACTIVE')
    const revoked = certs.filter((c) => c.card.status === 'REVOKED')

    // Thâm niên tính từ chứng chỉ ĐẦU TIÊN được cấp, không phải từ ngày tạo hồ
    // sơ: tạo hồ sơ rồi bỏ đó không phải là thâm niên.
    const firstIssued = certs.length ? certs[certs.length - 1]?.row.issuedAt ?? null : null

    const checks = await prisma.trustCheck.findMany({
      where: { certificateId: { in: certs.map((c) => c.row.id) } },
      orderBy: { ranAt: 'desc' },
      take: 200,
    })
    const passed = checks.filter((c) => c.passed).length

    res.json({
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      country: org.country,
      websiteUrl: org.websiteUrl,
      createdAt: org.createdAt,
      reputation: {
        activeCertificates: active.length,
        revokedCertificates: revoked.length,
        verifiedDomains: org.domains.length,
        firstIssuedAt: firstIssued,
        // null chứ không phải 100 khi chưa có lần kiểm nào — "chưa đo" và "hoàn
        // hảo" là hai chuyện khác nhau, và trang phải nói được sự khác nhau đó.
        checksTotal: checks.length,
        checksPassed: passed,
        checkPassRate: checks.length ? Math.round((passed / checks.length) * 100) : null,
        lastCheckedAt: checks[0]?.ranAt ?? null,
      },
      domains: org.domains.map((d) => ({ hostname: d.hostname, verifiedAt: d.verifiedAt })),
      certificates: active.map((c) => c.card),
      history: certs
        .filter((c) => c.card.status !== 'ACTIVE')
        .map((c) => c.card)
        .slice(0, 20),
    })
  })
)

/**
 * Endpoint huy hiệu. Trả SVG phản ánh trạng thái TẠI THỜI ĐIỂM REQUEST.
 *
 * Luôn trả 200 kèm ảnh (kể cả khi serial không tồn tại): nếu trả 404 thì thẻ
 * <img> trên site khách chỉ hiện ảnh vỡ, chủ site không biết vì sao.
 *
 * Ràng buộc tên miền dựa vào Referer. Trình duyệt có thể lược bỏ header này nên
 * KHÔNG coi việc thiếu Referer là vi phạm — chỉ chặn khi có Referer và sai tên
 * miền. Đây là rào cản, không phải cơ chế bảo mật: nguồn chân lý là trang xác
 * thực mà huy hiệu trỏ tới.
 */
app.get(
  '/api/trust/seal/:file',
  asyncHandler(async (req, res) => {
    const serial = String(req.params.file || '').replace(/\.svg$/i, '')
    const cert = await prisma.trustCertificate.findUnique({
      where: { serial },
      include: { domain: true, program: true },
    })

    let state = 'UNKNOWN'
    let variant = 'default'
    let programName = ''
    if (cert) {
      state = effectiveStatus(cert)
      variant = cert.program ? cert.program.badgeVariant : 'default'
      programName = cert.program ? cert.program.name : ''
      const ref = req.get('referer') || req.get('origin')
      if (ref) {
        let refHost = null
        try {
          refHost = new URL(ref).hostname.toLowerCase()
        } catch (e) {
          refHost = null
        }
        const certHost = cert.domain.hostname.toLowerCase()
        const allowed =
          !!refHost &&
          (refHost === certHost || refHost.endsWith(`.${certHost}`) || OWN_HOSTS.has(refHost))
        if (refHost && !allowed) state = 'DOMAIN_MISMATCH'
      }
    }

    res.set('Content-Type', 'image/svg+xml; charset=utf-8')
    // Cache ngắn để việc thu hồi lan tới site khách trong vòng ~5 phút.
    res.set('Cache-Control', 'public, max-age=300, must-revalidate')
    res.set('X-Trust-Seal-Status', state)
    res.send(renderBadge({ state, variant, programName, serial: cert ? cert.serial : serial }))
  })
)

// --- Khách hàng: tổ chức & tên miền -----------------------------------------

app.post(
  '/api/trust/orgs',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const b = req.body || {}
    const name = String(b.name || '').trim()
    const contactEmail = String(b.contactEmail || '').trim()
    if (name.length < 2) return res.status(400).json({ error: 'Tên tổ chức quá ngắn' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail))
      return res.status(400).json({ error: 'Email liên hệ không hợp lệ' })
    const org = await prisma.trustOrganization.create({
      data: {
        ownerUserId: user.id,
        ownerName: user.displayName || user.username,
        name,
        legalName: String(b.legalName || '').trim() || null,
        country: String(b.country || '').trim() || null,
        contactEmail,
        websiteUrl: String(b.websiteUrl || '').trim() || null,
      },
    })
    await audit(user, 'ORG_CREATE', 'TrustOrganization', org.id, org.name)
    res.status(201).json(org)
  })
)

app.get(
  '/api/trust/orgs',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const orgs = await prisma.trustOrganization.findMany({
      where: { ownerUserId: user.id },
      include: {
        domains: true,
        certificates: { include: { program: true, domain: true, org: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(
      orgs.map((o) => ({
        id: o.id,
        name: o.name,
        legalName: o.legalName,
        contactEmail: o.contactEmail,
        status: o.status,
        domains: o.domains.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          method: d.method,
          status: d.status,
          verifiedAt: d.verifiedAt,
          lastError: d.lastError,
        })),
        certificates: o.certificates.map(certCard),
      }))
    )
  })
)

app.post(
  '/api/trust/orgs/:id/domains',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const org = await prisma.trustOrganization.findUnique({ where: { id: req.params.id } })
    if (!org) return res.status(404).json({ error: 'Không tìm thấy tổ chức' })
    if (org.ownerUserId !== user.id)
      return res.status(403).json({ error: 'Không có quyền với tổ chức này' })

    const hostname = String((req.body && req.body.hostname) || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
    if (!isValidHostname(hostname)) return res.status(400).json({ error: 'Tên miền không hợp lệ' })
    const method = ['DNS_TXT', 'META_TAG', 'FILE'].includes(req.body && req.body.method)
      ? req.body.method
      : 'DNS_TXT'

    const existing = await prisma.trustDomain.findUnique({ where: { hostname } })
    if (existing)
      return res.status(409).json({ error: 'Tên miền này đã được đăng ký trong hệ thống' })

    const token = crypto.randomBytes(16).toString('hex')
    const domain = await prisma.trustDomain.create({
      data: { orgId: org.id, hostname, method, token },
    })
    await audit(user, 'DOMAIN_ADD', 'TrustDomain', domain.id, hostname)
    res.status(201).json({
      id: domain.id,
      hostname,
      method,
      status: domain.status,
      token,
      instructions: instructionsFor(hostname, method, token),
    })
  })
)

app.get(
  '/api/trust/domains/:id',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const d = await prisma.trustDomain.findUnique({
      where: { id: req.params.id },
      include: { org: true },
    })
    if (!d) return res.status(404).json({ error: 'Không tìm thấy tên miền' })
    if (d.org.ownerUserId !== user.id && !hasAtLeastRole(user.role, 'MODERATOR'))
      return res.status(403).json({ error: 'Không có quyền' })
    res.json({
      id: d.id,
      hostname: d.hostname,
      method: d.method,
      status: d.status,
      verifiedAt: d.verifiedAt,
      lastCheckedAt: d.lastCheckedAt,
      lastError: d.lastError,
      instructions: instructionsFor(d.hostname, d.method, d.token),
    })
  })
)

/** Chạy kiểm tra ngay theo yêu cầu của khách. */
app.post(
  '/api/trust/domains/:id/verify',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const d = await prisma.trustDomain.findUnique({
      where: { id: req.params.id },
      include: { org: true },
    })
    if (!d) return res.status(404).json({ error: 'Không tìm thấy tên miền' })
    if (d.org.ownerUserId !== user.id && !hasAtLeastRole(user.role, 'MODERATOR'))
      return res.status(403).json({ error: 'Không có quyền' })

    const result = await verifyDomain(d.hostname, d.method, d.token)
    const updated = await prisma.trustDomain.update({
      where: { id: d.id },
      data: {
        status: result.ok ? 'VERIFIED' : 'FAILED',
        verifiedAt: result.ok ? new Date() : d.verifiedAt,
        lastCheckedAt: new Date(),
        lastError: result.ok ? null : result.detail,
      },
    })
    await audit(
      user,
      result.ok ? 'DOMAIN_VERIFIED' : 'DOMAIN_VERIFY_FAILED',
      'TrustDomain',
      d.id,
      d.hostname,
      result.detail
    )
    res.json({ ok: result.ok, status: updated.status, detail: result.detail })
  })
)

// --- Khách hàng: đơn xin cấp dấu --------------------------------------------

app.post(
  '/api/trust/applications',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const b = req.body || {}
    const domain = await prisma.trustDomain.findUnique({
      where: { id: String(b.domainId || '') },
      include: { org: true },
    })
    if (!domain) return res.status(404).json({ error: 'Không tìm thấy tên miền' })
    if (domain.org.ownerUserId !== user.id)
      return res.status(403).json({ error: 'Không có quyền với tên miền này' })
    if (domain.status !== 'VERIFIED')
      return res.status(400).json({ error: 'Tên miền chưa được xác minh sở hữu' })

    const program = await prisma.sealProgram.findUnique({
      where: { slug: String(b.programSlug || '') },
    })
    if (!program || !program.active)
      return res.status(404).json({ error: 'Không tìm thấy chương trình' })

    const dup = await prisma.sealApplication.findFirst({
      where: {
        domainId: domain.id,
        programId: program.id,
        status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'] },
      },
    })
    if (dup)
      return res.status(409).json({
        error: 'Đã có đơn đang xử lý cho tên miền và chương trình này',
        applicationId: dup.id,
      })

    const appRec = await prisma.sealApplication.create({
      data: {
        orgId: domain.orgId,
        domainId: domain.id,
        programId: program.id,
        applicantId: user.id,
        status: 'DRAFT',
        scope: String(b.scope || '').trim() || null,
        answers: b.answers || undefined,
      },
    })
    await audit(
      user,
      'APPLICATION_CREATE',
      'SealApplication',
      appRec.id,
      `${program.slug} @ ${domain.hostname}`
    )
    res.status(201).json({ id: appRec.id, status: appRec.status, feeCredits: program.feeCredits })
  })
)

app.post(
  '/api/trust/applications/:id/evidence',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { org: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    if (a.org.ownerUserId !== user.id) return res.status(403).json({ error: 'Không có quyền' })
    if (!['DRAFT', 'NEEDS_INFO'].includes(a.status))
      return res.status(400).json({ error: 'Đơn không ở trạng thái cho phép bổ sung' })
    const b = req.body || {}
    const ev = await prisma.sealEvidence.create({
      data: {
        applicationId: a.id,
        kind: String(b.kind || 'note'),
        label: String(b.label || '').trim() || null,
        url: String(b.url || '').trim() || null,
        fileObjectId: String(b.fileObjectId || '').trim() || null,
        note: String(b.note || '').trim() || null,
      },
    })
    res.status(201).json(ev)
  })
)

/** Nộp đơn — trừ credits ở đây, trong cùng transaction với việc đổi trạng thái. */
app.post(
  '/api/trust/applications/:id/submit',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { org: true, program: true, domain: true, evidence: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    if (a.org.ownerUserId !== user.id) return res.status(403).json({ error: 'Không có quyền' })
    if (!['DRAFT', 'NEEDS_INFO'].includes(a.status))
      return res.status(400).json({ error: 'Đơn đã được nộp' })
    if (a.domain.status !== 'VERIFIED')
      return res.status(400).json({ error: 'Tên miền chưa được xác minh sở hữu' })

    // `evidenceSpec` là cột Json, nên Prisma khai nó là JsonValue — có thể là
    // số, chuỗi, object… Kiểm là mảng TRƯỚC khi coi như mảng, thay vì tin vào
    // `|| []` (chỉ đỡ được null/undefined, không đỡ được `evidenceSpec: 5`).
    const spec: EvidenceSpecItem[] = Array.isArray(a.program.evidenceSpec)
      ? (a.program.evidenceSpec as unknown as EvidenceSpecItem[])
      : []
    const required = spec.filter((e) => e && e.required)
    const provided = new Set(a.evidence.map((e) => e.kind))
    const missing = required.filter((e) => !provided.has(e.kind))
    if (missing.length) {
      return res.status(400).json({
        error: 'Thiếu bằng chứng bắt buộc',
        missing: missing.map((m) => ({ kind: m.kind, label: m.label })),
      })
    }

    // Chỉ thu phí ở lần nộp đầu; nộp lại sau NEEDS_INFO không tính tiền tiếp.
    const fee = a.feeCharged > 0 ? 0 : a.program.feeCredits || 0
    if (fee > 0) {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { credits: true },
      })
      if (!fresh || fresh.credits < fee)
        return res.status(400).json({ error: `Không đủ tín dụng — cần ${fee}` })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (fee > 0)
        await tx.user.update({ where: { id: user.id }, data: { credits: { decrement: fee } } })
      return tx.sealApplication.update({
        where: { id: a.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), feeCharged: { increment: fee } },
      })
    })
    await audit(
      user,
      'APPLICATION_SUBMIT',
      'SealApplication',
      a.id,
      `${a.program.slug} @ ${a.domain.hostname}`,
      fee ? `Thu ${fee} credits` : 'Nộp lại, không thu phí'
    )
    res.json({ status: updated.status, feeCharged: fee })
  })
)

app.get(
  '/api/trust/applications',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const list = await prisma.sealApplication.findMany({
      where: { applicantId: user.id },
      include: { program: true, domain: true, certificate: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(
      list.map((a) => ({
        id: a.id,
        status: a.status,
        scope: a.scope,
        reviewNote: a.reviewNote,
        program: { slug: a.program.slug, name: a.program.name },
        hostname: a.domain.hostname,
        feeCharged: a.feeCharged,
        submittedAt: a.submittedAt,
        decidedAt: a.decidedAt,
        createdAt: a.createdAt,
        serial: a.certificate ? a.certificate.serial : null,
      }))
    )
  })
)

app.get(
  '/api/trust/applications/:id',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { program: true, domain: true, org: true, evidence: true, certificate: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    const isReviewer = hasAtLeastRole(user.role, 'MODERATOR')
    if (a.org.ownerUserId !== user.id && !isReviewer)
      return res.status(403).json({ error: 'Không có quyền' })
    res.json({
      id: a.id,
      status: a.status,
      scope: a.scope,
      answers: a.answers,
      reviewNote: a.reviewNote,
      program: {
        slug: a.program.slug,
        name: a.program.name,
        criteria: a.program.criteria,
        evidenceSpec: a.program.evidenceSpec,
        validityDays: a.program.validityDays,
      },
      organization: { id: a.org.id, name: a.org.name, contactEmail: a.org.contactEmail },
      domain: {
        id: a.domain.id,
        hostname: a.domain.hostname,
        status: a.domain.status,
        verifiedAt: a.domain.verifiedAt,
      },
      evidence: a.evidence,
      feeCharged: a.feeCharged,
      submittedAt: a.submittedAt,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
      certificate: a.certificate
        ? { serial: a.certificate.serial, status: effectiveStatus(a.certificate) }
        : null,
    })
  })
)

/** Mã nhúng huy hiệu cho một chứng chỉ của chính mình. */
app.get(
  '/api/trust/certificates/:serial/embed',
  asyncHandler(async (req, res) => {
    const user = await requireMember(req, res)
    if (!user) return
    const c = await prisma.trustCertificate.findUnique({
      where: { serial: req.params.serial },
      include: { org: true, domain: true, program: true },
    })
    if (!c) return res.status(404).json({ error: 'Không tìm thấy chứng chỉ' })
    if (c.org.ownerUserId !== user.id && !hasAtLeastRole(user.role, 'MODERATOR'))
      return res.status(403).json({ error: 'Không có quyền' })
    const sealUrl = `${ISSUER}/api/trust/seal/${c.serial}.svg`
    const verifyUrl = `${ISSUER}/trust/verify/${c.serial}`
    res.json({
      serial: c.serial,
      sealUrl,
      verifyUrl,
      html: `<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">\n  <img src="${sealUrl}" alt="Con dấu tín nhiệm tsudev — ${c.program.name}" width="188" height="62" loading="lazy">\n</a>`,
      note: 'Huy hiệu được tsudev phục vụ tại thời điểm hiển thị. Không tự lưu ảnh về host riêng — làm vậy huy hiệu sẽ không phản ánh được khi chứng chỉ bị thu hồi.',
    })
  })
)

// --- Nội bộ: duyệt & cấp ----------------------------------------------------

app.get(
  '/api/trust/admin/summary',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    const now = new Date()
    const [pending, needsInfo, active, expiringSoon, revoked, orgs] = await Promise.all([
      prisma.sealApplication.count({ where: { status: { in: ['SUBMITTED', 'IN_REVIEW'] } } }),
      prisma.sealApplication.count({ where: { status: 'NEEDS_INFO' } }),
      prisma.trustCertificate.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
      prisma.trustCertificate.count({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now, lt: new Date(now.getTime() + 30 * 86400000) },
        },
      }),
      prisma.trustCertificate.count({ where: { status: 'REVOKED' } }),
      prisma.trustOrganization.count(),
    ])
    res.json({ pending, needsInfo, active, expiringSoon, revoked, orgs })
  })
)

app.get(
  '/api/trust/admin/applications',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    const status = qStr(req.query.status) || ''
    const where: Prisma.SealApplicationWhereInput = status
      ? { status: status as Prisma.SealApplicationWhereInput['status'] }
      : { status: { in: ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'] } }
    const list = await prisma.sealApplication.findMany({
      where,
      include: { program: true, domain: true, org: true, evidence: true },
      orderBy: { submittedAt: 'asc' },
    })
    res.json(
      list.map((a) => ({
        id: a.id,
        status: a.status,
        scope: a.scope,
        program: { slug: a.program.slug, name: a.program.name },
        hostname: a.domain.hostname,
        domainStatus: a.domain.status,
        organization: a.org.name,
        contactEmail: a.org.contactEmail,
        evidenceCount: a.evidence.length,
        feeCharged: a.feeCharged,
        submittedAt: a.submittedAt,
        createdAt: a.createdAt,
      }))
    )
  })
)

app.post(
  '/api/trust/admin/applications/:id/approve',
  asyncHandler(async (req, res) => {
    const reviewer = await requireReviewer(req, res)
    if (!reviewer) return
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { program: true, domain: true, org: true, certificate: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    if (a.certificate)
      return res
        .status(409)
        .json({ error: 'Đơn này đã được cấp chứng chỉ', serial: a.certificate.serial })
    if (!['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'].includes(a.status))
      return res.status(400).json({ error: `Không duyệt được đơn ở trạng thái ${a.status}` })
    if (a.domain.status !== 'VERIFIED')
      return res.status(400).json({ error: 'Tên miền chưa xác minh — không thể cấp dấu' })

    const basis = ['SELF_DECLARED', 'EVIDENCE_REVIEWED', 'AUDITED'].includes(
      req.body && req.body.basis
    )
      ? req.body.basis
      : null
    if (!basis)
      return res.status(400).json({
        error: 'Phải nêu cơ sở đánh giá (basis): SELF_DECLARED | EVIDENCE_REVIEWED | AUDITED',
      })

    const cert = await issueCertificate({
      application: a,
      program: a.program,
      domain: a.domain,
      org: a.org,
      issuer: reviewer,
      basis,
      scope: (req.body && req.body.scope) || a.scope,
      validityDays: parseInt(req.body && req.body.validityDays) || a.program.validityDays,
    })
    await audit(
      reviewer,
      'CERTIFICATE_ISSUE',
      'TrustCertificate',
      cert.id,
      cert.serial,
      `${a.program.slug} @ ${a.domain.hostname} — cơ sở: ${basis}`
    )
    res.status(201).json(certCard({ ...cert, domain: a.domain, org: a.org, program: a.program }))
  })
)

app.post(
  '/api/trust/admin/applications/:id/reject',
  asyncHandler(async (req, res) => {
    const reviewer = await requireReviewer(req, res)
    if (!reviewer) return
    const note = String((req.body && req.body.note) || '').trim()
    if (!note) return res.status(400).json({ error: 'Phải nêu lý do từ chối' })
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { domain: true, program: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    await prisma.sealApplication.update({
      where: { id: a.id },
      data: {
        status: 'REJECTED',
        reviewNote: note,
        decidedAt: new Date(),
        reviewerId: reviewer.id,
        reviewerName: reviewer.displayName || reviewer.username,
      },
    })
    await audit(
      reviewer,
      'APPLICATION_REJECT',
      'SealApplication',
      a.id,
      `${a.program.slug} @ ${a.domain.hostname}`,
      note
    )
    res.json({ status: 'REJECTED' })
  })
)

app.post(
  '/api/trust/admin/applications/:id/request-info',
  asyncHandler(async (req, res) => {
    const reviewer = await requireReviewer(req, res)
    if (!reviewer) return
    const note = String((req.body && req.body.note) || '').trim()
    if (!note) return res.status(400).json({ error: 'Phải nêu cần bổ sung gì' })
    const a = await prisma.sealApplication.findUnique({
      where: { id: req.params.id },
      include: { domain: true, program: true },
    })
    if (!a) return res.status(404).json({ error: 'Không tìm thấy đơn' })
    await prisma.sealApplication.update({
      where: { id: a.id },
      data: {
        status: 'NEEDS_INFO',
        reviewNote: note,
        reviewerId: reviewer.id,
        reviewerName: reviewer.displayName || reviewer.username,
      },
    })
    await audit(
      reviewer,
      'APPLICATION_REQUEST_INFO',
      'SealApplication',
      a.id,
      `${a.program.slug} @ ${a.domain.hostname}`,
      note
    )
    res.json({ status: 'NEEDS_INFO' })
  })
)

app.post(
  '/api/trust/admin/certificates/:serial/revoke',
  asyncHandler(async (req, res) => {
    const reviewer = await requireReviewer(req, res)
    if (!reviewer) return
    const reason = String((req.body && req.body.reason) || '').trim()
    if (!reason) return res.status(400).json({ error: 'Phải nêu lý do thu hồi' })
    const c = await prisma.trustCertificate.findUnique({ where: { serial: req.params.serial } })
    if (!c) return res.status(404).json({ error: 'Không tìm thấy chứng chỉ' })
    await prisma.trustCertificate.update({
      where: { id: c.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
    })
    await audit(reviewer, 'CERTIFICATE_REVOKE', 'TrustCertificate', c.id, c.serial, reason)
    res.json({ serial: c.serial, status: 'REVOKED' })
  })
)

app.post(
  '/api/trust/admin/certificates/:serial/suspend',
  asyncHandler(async (req, res) => {
    const reviewer = await requireReviewer(req, res)
    if (!reviewer) return
    const reason = String((req.body && req.body.reason) || '').trim()
    const c = await prisma.trustCertificate.findUnique({ where: { serial: req.params.serial } })
    if (!c) return res.status(404).json({ error: 'Không tìm thấy chứng chỉ' })
    const next = c.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
    await prisma.trustCertificate.update({ where: { id: c.id }, data: { status: next } })
    await audit(
      reviewer,
      next === 'SUSPENDED' ? 'CERTIFICATE_SUSPEND' : 'CERTIFICATE_RESUME',
      'TrustCertificate',
      c.id,
      c.serial,
      reason || null
    )
    res.json({ serial: c.serial, status: next })
  })
)

app.get(
  '/api/trust/admin/certificates',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    const certs = await prisma.trustCertificate.findMany({
      include: { domain: true, org: true, program: true },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    })
    res.json(certs.map(certCard))
  })
)

app.get(
  '/api/trust/admin/audit',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    const logs = await prisma.trustAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    res.json(logs)
  })
)

/**
 * Chạy một vòng giám sát ngay. Cùng đường code với bộ hẹn giờ tự động, kể cả
 * phần ân hạn và tự đình chỉ — nút bấm thủ công không được có luật riêng, nếu
 * không kiểm duyệt viên sẽ thấy kết quả khác với thứ hệ thống tự làm ban đêm.
 *
 * `all=true` bỏ qua điều kiện "đã cũ" để kiểm duyệt viên soát lại toàn bộ.
 */
app.post(
  '/api/trust/admin/recheck',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    const b = req.body || {}
    const opts: { batch: number; staleAfterMin?: number } = {
      batch: Math.min(200, qInt(b.limit, 25)),
    }
    if (b.all) opts.staleAfterMin = 0
    const summary = await runRecheckCycle(opts)
    await audit(
      user,
      'RECHECK_RUN',
      'TrustCertificate',
      'batch',
      `${summary.checked} chứng chỉ`,
      `đạt ${summary.passed}, trượt ${summary.failed}, đình chỉ ${summary.suspended}, khôi phục ${summary.resumed}`
    )
    res.json(summary)
  })
)

/** Cấu hình giám sát đang hiệu lực — để trang quản trị nói được chu kỳ thật. */
app.get(
  '/api/trust/admin/recheck/config',
  asyncHandler(async (req, res) => {
    const user = await requireReviewer(req, res)
    if (!user) return
    res.json(recheckConfig())
  })
)

// --- Hạ tầng ---------------------------------------------------------------

// Express chỉ nhận diện đây là middleware xử lý lỗi khi hàm khai đủ 4 tham số;
// bỏ `next` cho hết lint thì toàn bộ xử lý lỗi im lặng ngừng hoạt động.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[trust] error', errStack(err))
  notify.alert({
    service: 'trust-service',
    level: 'error',
    message: errMsg(err),
    error: err,
    context: `${req.method} ${req.url}`,
  })
  if (res && !res.headersSent) res.status(500).json({ error: errMsg(err) || 'internal error' })
}
app.use(errorHandler)

/** Chuẩn bị trước khi phục vụ. Chạy ở CẢ hai chế độ: tiến trình riêng và nhúng
 *  trong services/backend-bundle. Bộ giám sát định kỳ phải sống ở cả hai —
 *  quên gọi init() ở chế độ gộp thì chứng chỉ hết hạn không ai kiểm lại, và
 *  không có gì báo lỗi. */
async function init() {
  startScheduler()
}

async function startServer() {
  app.listen(Number(port), bindHost, () =>
    console.log(
      `trust-service listening on ${bindHost}:${port} (signing key: ${signing.kid}${
        signing.usingDevKey ? ', DEV — không dùng cho production' : ''
      })`
    )
  )
  await init()
}

// EMBEDDED=1 do services/backend-bundle đặt trước khi require file này: ở chế
// độ gộp chỉ tiến trình cha mở cổng, và chính nó gọi init(). Mở cổng riêng ở
// đây là tranh cổng với cha.
if (process.env.NODE_ENV !== 'test' && !process.env.EMBEDDED) startServer().catch(() => {})

export { app, startServer, init, AUTH_PREFIXES }
