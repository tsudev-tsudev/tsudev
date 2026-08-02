'use strict'
/**
 * Giám sát định kỳ các tên miền đang mang dấu.
 *
 * Con dấu không phải thứ cấp một lần rồi thôi: chủ site có thể gỡ bản ghi xác
 * minh, bán tên miền, hoặc để nó hết hạn. Huy hiệu vẫn hiện trên trang họ, và
 * người dùng vẫn tin — nên hệ thống phải tự phát hiện và tự hạ dấu.
 *
 * Ba quyết định đáng ghi lại:
 *
 * 1. MỘT LẦN HỎNG KHÔNG HẠ DẤU. DNS chập chờn, site bảo trì, mạng của chính
 *    tsudev lỗi — đều làm kiểm tra trượt mà chủ site không có lỗi gì. Chỉ đình
 *    chỉ sau TRUST_RECHECK_GRACE_FAILURES lần trượt LIÊN TIẾP (mặc định 3).
 *
 * 2. TỰ ĐÌNH CHỈ, KHÔNG TỰ THU HỒI. Đình chỉ đảo ngược được; thu hồi thì không.
 *    Máy chỉ được làm việc đảo ngược được, thu hồi luôn là quyết định của người.
 *
 * 3. CHỈ TỰ KHÔI PHỤC THỨ CHÍNH MÌNH ĐÃ ĐÌNH CHỈ. Kiểm duyệt viên đình chỉ vì
 *    lý do nội dung thì domain vẫn xác minh tốt — nếu máy thấy "kiểm tra đạt"
 *    rồi bật lại thì nó vừa lật quyết định của con người. Nguồn phân biệt là
 *    nhật ký kiểm toán: nó bất biến và đã ghi sẵn ai là người ra tay.
 */

const { prisma } = require('@tsudev/db')
const { verifyDomain } = require('./domainVerify')

let notify = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}

/** Diễn viên hệ thống trong nhật ký kiểm toán. actorId là chuỗi tự do, không phải khoá ngoại. */
const SYSTEM_ACTOR = { id: 'system', displayName: 'Hệ thống giám sát', username: 'system' }

const num = (v, dflt) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : dflt
}

const config = () => ({
  enabled: String(process.env.TRUST_RECHECK_ENABLED || 'true') !== 'false',
  intervalMin: num(process.env.TRUST_RECHECK_INTERVAL_MIN, 360), // 6 giờ
  staleAfterMin: num(process.env.TRUST_RECHECK_STALE_MIN, 1440), // kiểm lại sau 24 giờ
  batch: Math.min(200, num(process.env.TRUST_RECHECK_BATCH, 25)),
  graceFailures: num(process.env.TRUST_RECHECK_GRACE_FAILURES, 3),
})

/**
 * Chứng chỉ cần kiểm lại: đang ACTIVE hoặc SUSPENDED (để còn khôi phục được),
 * chưa hết hạn, và lần kiểm gần nhất đã cũ. Chưa từng kiểm thì ưu tiên trước.
 */
async function selectDue(now, { batch, staleAfterMin }) {
  const cutoff = new Date(now.getTime() - staleAfterMin * 60000)
  return prisma.trustCertificate.findMany({
    where: {
      status: { in: ['ACTIVE', 'SUSPENDED'] },
      expiresAt: { gt: now },
      OR: [{ lastCheckAt: null }, { lastCheckAt: { lt: cutoff } }],
    },
    include: { domain: true, org: true, program: true },
    orderBy: { lastCheckAt: { sort: 'asc', nulls: 'first' } },
    take: batch,
  })
}

/** Đếm số lần trượt liên tiếp tính từ lần kiểm mới nhất, tối đa `limit` bản ghi. */
async function consecutiveFailures(certificateId, limit) {
  const checks = await prisma.trustCheck.findMany({
    where: { certificateId },
    orderBy: { ranAt: 'desc' },
    take: limit,
    select: { passed: true },
  })
  let n = 0
  for (const c of checks) {
    if (c.passed) break
    n++
  }
  return n
}

/**
 * Lần đình chỉ hiện hành có phải do hệ thống không. Đọc hành động đình chỉ/khôi
 * phục gần nhất trong nhật ký — nếu người làm thì máy không được lật lại.
 */
async function suspendedBySystem(certificateId) {
  const last = await prisma.trustAuditLog.findFirst({
    where: {
      targetType: 'TrustCertificate',
      targetId: certificateId,
      action: { in: ['CERTIFICATE_SUSPEND', 'CERTIFICATE_RESUME'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { action: true, actorId: true },
  })
  return !!last && last.action === 'CERTIFICATE_SUSPEND' && last.actorId === SYSTEM_ACTOR.id
}

function audit(action, cert, note) {
  return prisma.trustAuditLog.create({
    data: {
      actorId: SYSTEM_ACTOR.id,
      actorName: SYSTEM_ACTOR.displayName,
      action,
      targetType: 'TrustCertificate',
      targetId: cert.id,
      targetLabel: cert.serial,
      note: note || null,
    },
  })
}

/** Kiểm một chứng chỉ và áp dụng hệ quả. Trả bản ghi kết quả để gộp báo cáo. */
async function recheckOne(cert, cfg) {
  const domain = cert.domain
  const result = await verifyDomain(domain.hostname, domain.method, domain.token)
  const now = new Date()

  // Ghi kết quả trước, hệ quả sau: kể cả nếu bước dưới vỡ thì bằng chứng đã nằm
  // trong DB, lần chạy sau tính lại được.
  await prisma.$transaction([
    prisma.trustCheck.create({
      data: {
        certificateId: cert.id,
        passed: result.ok,
        details: { detail: result.detail, method: domain.method },
      },
    }),
    prisma.trustCertificate.update({
      where: { id: cert.id },
      data: { lastCheckAt: now, lastCheckPassed: result.ok },
    }),
    // Đồng bộ trạng thái tên miền để cổng khách hàng hiển thị đúng lý do.
    prisma.trustDomain.update({
      where: { id: domain.id },
      data: {
        status: result.ok ? 'VERIFIED' : 'FAILED',
        verifiedAt: result.ok ? now : domain.verifiedAt,
        lastCheckedAt: now,
        lastError: result.ok ? null : result.detail,
      },
    }),
  ])

  const row = {
    serial: cert.serial,
    hostname: domain.hostname,
    passed: result.ok,
    detail: result.detail,
    action: 'none',
  }

  if (!result.ok) {
    if (cert.status !== 'ACTIVE') return row
    const streak = await consecutiveFailures(cert.id, cfg.graceFailures)
    if (streak < cfg.graceFailures) {
      row.action = 'grace'
      row.streak = streak
      return row
    }
    await prisma.trustCertificate.update({ where: { id: cert.id }, data: { status: 'SUSPENDED' } })
    await audit(
      'CERTIFICATE_SUSPEND',
      cert,
      `Tự đình chỉ: xác minh tên miền trượt ${streak} lần liên tiếp — ${result.detail}`
    )
    row.action = 'suspended'
    row.streak = streak
    await notify.alert({
      service: 'trust-service',
      level: 'warning',
      message: `Đình chỉ ${cert.serial} (${domain.hostname}): xác minh trượt ${streak} lần liên tiếp`,
      context: result.detail,
    })
    return row
  }

  if (cert.status === 'SUSPENDED' && (await suspendedBySystem(cert.id))) {
    await prisma.trustCertificate.update({ where: { id: cert.id }, data: { status: 'ACTIVE' } })
    await audit('CERTIFICATE_RESUME', cert, 'Tự khôi phục: tên miền đã xác minh lại thành công')
    row.action = 'resumed'
  }
  return row
}

/**
 * Một vòng giám sát. Lỗi của một chứng chỉ không được làm hỏng cả vòng — một
 * domain chết không thể chặn việc kiểm những domain còn lại.
 */
async function runRecheckCycle(opts = {}) {
  const cfg = { ...config(), ...opts }
  const now = opts.now || new Date()
  const certs = opts.certificates || (await selectDue(now, cfg))
  const results = []
  for (const cert of certs) {
    try {
      results.push(await recheckOne(cert, cfg))
    } catch (e) {
      console.error(`[trust] recheck ${cert.serial} lỗi:`, e && (e.stack || e.message))
      results.push({
        serial: cert.serial,
        hostname: cert.domain && cert.domain.hostname,
        passed: null,
        detail: e && e.message,
        action: 'error',
      })
    }
  }
  const tally = (a) => results.filter((r) => r.action === a).length
  return {
    checked: results.length,
    passed: results.filter((r) => r.passed === true).length,
    failed: results.filter((r) => r.passed === false).length,
    suspended: tally('suspended'),
    resumed: tally('resumed'),
    errors: tally('error'),
    results,
  }
}

let timer = null

/**
 * Bộ hẹn giờ trong tiến trình. Đủ cho một service chạy một bản; nếu sau này
 * chạy nhiều bản thì phải khoá phân tán (hoặc tắt biến môi trường và gọi
 * /api/trust/admin/recheck từ cron bên ngoài) — nếu không mọi bản sẽ cùng kiểm
 * một tập chứng chỉ.
 */
function startScheduler() {
  const cfg = config()
  if (!cfg.enabled) {
    console.log('[trust] giám sát tên miền: TẮT (TRUST_RECHECK_ENABLED=false)')
    return null
  }
  if (timer) return timer
  const periodMs = cfg.intervalMin * 60000
  const tick = async () => {
    try {
      const s = await runRecheckCycle()
      if (s.checked)
        console.log(
          `[trust] giám sát: kiểm ${s.checked}, đạt ${s.passed}, trượt ${s.failed}, đình chỉ ${s.suspended}, khôi phục ${s.resumed}`
        )
    } catch (e) {
      console.error('[trust] vòng giám sát lỗi:', e && (e.stack || e.message))
    }
  }
  // Trễ một phút trước vòng đầu: lúc mới khởi động, DB và mạng chưa chắc sẵn sàng.
  timer = setInterval(tick, periodMs)
  if (timer.unref) timer.unref() // đừng giữ tiến trình sống chỉ vì bộ hẹn giờ
  const kickoff = setTimeout(tick, 60000)
  if (kickoff.unref) kickoff.unref()
  console.log(
    `[trust] giám sát tên miền: mỗi ${cfg.intervalMin} phút, mỗi lượt tối đa ${cfg.batch} chứng chỉ, ân hạn ${cfg.graceFailures} lần trượt`
  )
  return timer
}

function stopScheduler() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = {
  runRecheckCycle,
  startScheduler,
  stopScheduler,
  config,
  SYSTEM_ACTOR,
  consecutiveFailures,
  suspendedBySystem,
}
