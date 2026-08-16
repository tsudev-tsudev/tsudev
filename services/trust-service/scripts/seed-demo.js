#!/usr/bin/env node
'use strict'
/**
 * Dữ liệu trình diễn cho hệ Con dấu tín nhiệm.
 *
 *   node services/trust-service/scripts/seed-demo.js          # thêm nếu chưa có
 *   node services/trust-service/scripts/seed-demo.js --reset  # xoá sạch rồi tạo lại
 *
 * CỐ Ý TÁCH KHỎI packages/db/prisma/seed.js. Seed chính thức chỉ chứa dữ liệu
 * tham chiếu (bốn chương trình cấp dấu) — thứ mà mọi môi trường, kể cả
 * production, đều cần. Còn tổ chức và chứng chỉ ở đây là hàng giả để xem giao
 * diện; nếu nhét vào seed chính thì một ngày nào đó chúng sẽ mọc lên trong
 * production và thư mục công khai sẽ liệt kê những website không tồn tại.
 *
 * Chứng chỉ ở đây được ký bằng ĐÚNG khoá của service, nên trang xác thực kiểm
 * chữ ký thật chứ không phải kiểm một chuỗi bịa.
 */

require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') })
}

const crypto = require('crypto')
const { prisma } = require('@tsudev/db')
// dist/ chứ không phải src/: service đã sang TypeScript và chạy từ bản biên
// dịch (xem "main" trong package.json). Script này là .js thuần nên require
// thẳng src/*.ts sẽ MODULE_NOT_FOUND — cần `npm run build:services` trước.
const signing = require('../dist/signing')
const { nextSerial, buildPayload } = require('../dist/certificates')

const reset = process.argv.includes('--reset')

const ORGS = [
  {
    name: 'Học viện Mã Nguồn Mở',
    legalName: 'Công ty CP Học viện Mã Nguồn Mở',
    country: 'VN',
    contactEmail: 'lienhe@manguonmo.vn',
    websiteUrl: 'https://manguonmo.vn',
    hostname: 'manguonmo.vn',
    method: 'DNS_TXT',
    program: 'copyright-verified',
    basis: 'EVIDENCE_REVIEWED',
    scope: 'Toàn bộ bài giảng và mã nguồn ví dụ đăng tại manguonmo.vn',
  },
  {
    name: 'PrivacyFirst',
    legalName: 'Công ty TNHH PrivacyFirst Việt Nam',
    country: 'VN',
    contactEmail: 'dpo@privacyfirst.vn',
    websiteUrl: 'https://privacyfirst.vn',
    hostname: 'privacyfirst.vn',
    method: 'META_TAG',
    program: 'data-protection',
    basis: 'AUDITED',
    scope: 'Hoạt động xử lý dữ liệu cá nhân của người dùng cuối trên privacyfirst.vn',
  },
  {
    name: 'DevSecure',
    legalName: 'DevSecure Technologies JSC',
    country: 'VN',
    contactEmail: 'security@devsecure.io',
    websiteUrl: 'https://devsecure.io',
    hostname: 'devsecure.io',
    method: 'FILE',
    program: 'security-compliant',
    basis: 'AUDITED',
    scope: 'Hạ tầng API công khai api.devsecure.io và cổng quản trị',
  },
]

async function wipe() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('--reset không được phép chạy ở production')
  // Thứ tự theo chiều khoá ngoại: chứng chỉ trỏ tới đơn, đơn trỏ tới tên miền.
  await prisma.trustCertificate.deleteMany({})
  await prisma.sealEvidence.deleteMany({})
  await prisma.sealApplication.deleteMany({})
  await prisma.trustDomain.deleteMany({})
  await prisma.trustOrganization.deleteMany({})
  await prisma.trustAuditLog.deleteMany({})
  console.log('Đã xoá toàn bộ dữ liệu Con dấu (tổ chức, tên miền, đơn, chứng chỉ, nhật ký).')
}

async function issuerUser() {
  const u = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'MODERATOR'] } } })
  if (u) return u
  return prisma.user.upsert({
    where: { username: 'tsudev' },
    update: {},
    create: {
      username: 'tsudev',
      email: 'tsudev@tsudev.local',
      displayName: 'tsudev',
      role: 'ADMIN',
    },
  })
}

async function createOne(spec, issuer, now) {
  const existing = await prisma.trustDomain.findUnique({ where: { hostname: spec.hostname } })
  if (existing) {
    console.log(`  bỏ qua ${spec.hostname} — đã có`)
    return null
  }

  const program = await prisma.sealProgram.findUnique({ where: { slug: spec.program } })
  if (!program) throw new Error(`Thiếu chương trình ${spec.program} — chạy npm run db:seed trước`)

  const org = await prisma.trustOrganization.create({
    data: {
      ownerUserId: issuer.id,
      ownerName: issuer.displayName || issuer.username,
      name: spec.name,
      legalName: spec.legalName,
      country: spec.country,
      contactEmail: spec.contactEmail,
      websiteUrl: spec.websiteUrl,
    },
  })
  const domain = await prisma.trustDomain.create({
    data: {
      orgId: org.id,
      hostname: spec.hostname,
      method: spec.method,
      token: crypto.randomBytes(16).toString('hex'),
      status: 'VERIFIED',
      verifiedAt: now,
      lastCheckedAt: now,
    },
  })
  const application = await prisma.sealApplication.create({
    data: {
      orgId: org.id,
      domainId: domain.id,
      programId: program.id,
      applicantId: issuer.id,
      status: 'APPROVED',
      scope: spec.scope,
      submittedAt: now,
      decidedAt: now,
      reviewerId: issuer.id,
      reviewerName: issuer.displayName || issuer.username,
      feeCharged: program.feeCredits || 0,
    },
  })

  const expiresAt = new Date(now.getTime() + (program.validityDays || 365) * 86400000)
  const serial = await nextSerial(prisma, program.slug, now.getFullYear())
  const payload = buildPayload({
    serial,
    program,
    hostname: spec.hostname,
    orgName: spec.name,
    scope: spec.scope,
    basis: spec.basis,
    issuedAt: now,
    expiresAt,
  })
  await prisma.trustCertificate.create({
    data: {
      serial,
      applicationId: application.id,
      orgId: org.id,
      domainId: domain.id,
      programId: program.id,
      status: 'ACTIVE',
      basis: spec.basis,
      scope: spec.scope,
      issuedAt: now,
      expiresAt,
      payload,
      signature: signing.sign(payload),
      signingKeyId: signing.kid,
      issuedById: issuer.id,
      issuedByName: issuer.displayName || issuer.username,
      // Đánh dấu đã kiểm để bộ giám sát không lập tức đi hỏi DNS của tên miền bịa.
      lastCheckAt: now,
      lastCheckPassed: true,
    },
  })
  console.log(`  ${serial}  ${spec.hostname}  (${program.name})`)
  return serial
}

async function main() {
  if (reset) await wipe()
  const issuer = await issuerUser()
  const now = new Date()
  console.log('Tạo dữ liệu trình diễn:')
  for (const spec of ORGS) await createOne(spec, issuer, now)
  console.log(
    `\nKý bằng khoá: ${signing.kid}${signing.usingDevKey ? ' (DEV — không có giá trị)' : ''}`
  )
  console.log('Xem thư mục công khai tại /trust/directory')
}

main()
  .catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
