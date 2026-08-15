'use strict'
/** Sinh serial và cấp chứng chỉ. Tách khỏi index.js để test được độc lập. */

const { prisma } = require('@tsudev/db')
const signing = require('./signing')

const ISSUER = process.env.TRUST_ISSUER || 'https://tsudev.com'
const PAYLOAD_VERSION = 1

/** Mã chương trình 2 ký tự, lấy chữ cái đầu của hai từ trong slug: copyright-verified -> CV. */
function programCode(slug) {
  const parts = String(slug || '')
    .split('-')
    .filter(Boolean)
  const code = (parts[0] || 'x').charAt(0) + (parts[1] || parts[0] || 'x').charAt(0)
  return code.toUpperCase()
}

/**
 * Serial dạng TSU-CV-2026-000001.
 *
 * Số thứ tự đếm theo năm và theo chương trình. Có vòng lặp thử lại vì hai đơn
 * duyệt đồng thời có thể cùng ra một số — cột serial là unique nên lần thứ hai
 * sẽ vỡ và cần cấp lại số.
 */
async function nextSerial(tx, programSlug, year) {
  const code = programCode(programSlug)
  const prefix = `TSU-${code}-${year}-`
  const last = await tx.trustCertificate.findFirst({
    where: { serial: { startsWith: prefix } },
    orderBy: { serial: 'desc' },
    select: { serial: true },
  })
  const n = last ? parseInt(last.serial.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(n).padStart(6, '0')}`
}

/** Nội dung được ký. Cố ý phẳng và tự mô tả để bên thứ ba đọc được mà không cần API tsudev. */
function buildPayload({ serial, program, hostname, orgName, scope, basis, issuedAt, expiresAt }) {
  return {
    ver: PAYLOAD_VERSION,
    iss: ISSUER,
    sub: hostname,
    serial,
    program: { slug: program.slug, name: program.name },
    organization: orgName,
    scope,
    basis,
    iat: Math.floor(issuedAt.getTime() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
    verify: `${ISSUER}/trust/verify/${serial}`,
  }
}

/**
 * Cấp chứng chỉ cho một đơn đã duyệt. Chạy trong transaction: hoặc có cả chứng
 * chỉ lẫn đơn ở trạng thái APPROVED, hoặc không có gì.
 */
async function issueCertificate({
  application,
  program,
  domain,
  org,
  issuer,
  basis,
  scope,
  validityDays,
}) {
  const issuedAt = new Date()
  const days = validityDays || program.validityDays || 365
  const expiresAt = new Date(issuedAt.getTime() + days * 86400000)
  const finalScope = (scope || application.scope || `${program.name} cho ${domain.hostname}`).trim()

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const serial = await nextSerial(tx, program.slug, issuedAt.getFullYear())
        const payload = buildPayload({
          serial,
          program,
          hostname: domain.hostname,
          orgName: org.name,
          scope: finalScope,
          basis,
          issuedAt,
          expiresAt,
        })
        const signature = signing.sign(payload)

        const cert = await tx.trustCertificate.create({
          data: {
            serial,
            applicationId: application.id,
            orgId: org.id,
            domainId: domain.id,
            programId: program.id,
            status: 'ACTIVE',
            basis,
            scope: finalScope,
            issuedAt,
            expiresAt,
            payload,
            signature,
            signingKeyId: signing.kid,
            issuedById: issuer.id,
            issuedByName: issuer.displayName || issuer.username,
          },
        })
        await tx.sealApplication.update({
          where: { id: application.id },
          data: {
            status: 'APPROVED',
            decidedAt: issuedAt,
            reviewerId: issuer.id,
            reviewerName: issuer.displayName || issuer.username,
          },
        })
        return cert
      })
    } catch (e) {
      const conflict = e && e.code === 'P2002'
      if (!conflict || attempt === 4) throw e
    }
  }
  throw new Error('Không cấp được serial sau nhiều lần thử')
}

/** Trạng thái hiệu lực tại thời điểm hỏi — hết hạn được suy ra, không cần cron. */
function effectiveStatus(cert, now = new Date()) {
  if (!cert) return 'UNKNOWN'
  if (cert.status === 'REVOKED') return 'REVOKED'
  if (cert.status === 'SUSPENDED') return 'SUSPENDED'
  if (cert.expiresAt && cert.expiresAt.getTime() < now.getTime()) return 'EXPIRED'
  return cert.status
}

module.exports = {
  issueCertificate,
  effectiveStatus,
  nextSerial,
  programCode,
  buildPayload,
  ISSUER,
}
