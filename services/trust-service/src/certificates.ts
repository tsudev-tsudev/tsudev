'use strict'
/** Sinh serial và cấp chứng chỉ. Tách khỏi index.js để test được độc lập. */

import { prisma } from '@tsudev/db'
import type {
  AssessmentBasis,
  Prisma,
  SealApplication,
  SealProgram,
  TrustCertificate,
  TrustDomain,
  TrustOrganization,
  User,
} from '@prisma/client'
import * as signing from './signing'

// Dùng Pick<> thay vì cả model: nơi gọi thường truyền vào bản ghi đã `select`
// một phần. Khai đúng những trường THỰC SỰ đọc tới thì vừa không đòi hỏi thừa,
// vừa là tài liệu sống về ràng buộc dữ liệu của việc cấp chứng chỉ.
type IssueArgs = {
  application: Pick<SealApplication, 'id' | 'scope'>
  program: Pick<SealProgram, 'id' | 'slug' | 'name' | 'validityDays'>
  domain: Pick<TrustDomain, 'id' | 'hostname'>
  org: Pick<TrustOrganization, 'id' | 'name'>
  issuer: Pick<User, 'id' | 'displayName' | 'username'>
  // Enum của Prisma, KHÔNG phải string tự do. Bản JS nhận mọi chuỗi và chỉ vỡ ở
  // tầng DB lúc chạy; ràng đúng enum ở đây đẩy việc kiểm hợp lệ ngược lên chỗ
  // nhận dữ liệu người dùng, nơi có thể trả 400 tử tế thay vì 500.
  basis?: AssessmentBasis | null
  scope?: string | null
  validityDays?: number | null
}

type PayloadArgs = {
  serial: string
  program: Pick<SealProgram, 'slug' | 'name'>
  hostname: string
  orgName: string
  scope: string
  basis?: AssessmentBasis | null
  issuedAt: Date
  expiresAt: Date
}

const ISSUER = process.env.TRUST_ISSUER || 'https://tsudev.com'
const PAYLOAD_VERSION = 1

/** Mã chương trình 2 ký tự, lấy chữ cái đầu của hai từ trong slug: copyright-verified -> CV. */
function programCode(slug: unknown): string {
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
 * duyệt đồng thời có thể cùng ra một số - cột serial là unique nên lần thứ hai
 * sẽ vỡ và cần cấp lại số.
 */
async function nextSerial(
  tx: Prisma.TransactionClient,
  programSlug: string,
  year: number
): Promise<string> {
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
function buildPayload({
  serial,
  program,
  hostname,
  orgName,
  scope,
  basis,
  issuedAt,
  expiresAt,
}: PayloadArgs) {
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
}: IssueArgs): Promise<TrustCertificate> {
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
            // Cột `basis` không nhận null (có default ở schema). Nơi gọi vẫn có
            // thể chuyển null, nên quy về undefined để Prisma dùng default.
            basis: basis ?? undefined,
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
      // P2002 = vi phạm ràng buộc unique, tức là hai đơn cùng giành một serial.
      // Chỉ lỗi ĐÓ mới đáng thử lại; mọi lỗi khác phải nổi lên ngay thay vì bị
      // vòng lặp nuốt mất.
      const conflict =
        typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'
      if (!conflict || attempt === 4) throw e
    }
  }
  throw new Error('Không cấp được serial sau nhiều lần thử')
}

/** Trạng thái hiệu lực tại thời điểm hỏi - hết hạn được suy ra, không cần cron. */
function effectiveStatus(
  cert: Pick<TrustCertificate, 'status' | 'expiresAt'> | null | undefined,
  now: Date = new Date()
): string {
  if (!cert) return 'UNKNOWN'
  if (cert.status === 'REVOKED') return 'REVOKED'
  if (cert.status === 'SUSPENDED') return 'SUSPENDED'
  if (cert.expiresAt && cert.expiresAt.getTime() < now.getTime()) return 'EXPIRED'
  return cert.status
}

export { issueCertificate, effectiveStatus, nextSerial, programCode, buildPayload, ISSUER }
