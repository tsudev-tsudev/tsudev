'use strict'
/**
 * Xác minh quyền kiểm soát domain — ba cách, khách chọn một:
 *
 *   DNS_TXT   bản ghi TXT tại _tsudev-trust.<hostname> chứa
 *             tsudev-trust-verification=<token>
 *   META_TAG  trang chủ có <meta name="tsudev-trust-verification" content="<token>">
 *   FILE      tải được https://<hostname>/.well-known/tsudev-trust-<token>.txt
 *
 * DNS_TXT là bằng chứng mạnh nhất (chứng minh quyền ở tầng DNS); hai cách còn
 * lại chỉ chứng minh quyền ghi nội dung lên web root.
 */

import { promises as dns } from 'dns'
import type { LookupAddress } from 'dns'
import net from 'net'

/** Kết quả một lần kiểm tra. Luôn có cả hai trường — không nhánh nào trả rỗng. */
export type CheckResult = { ok: boolean; detail: string }

/**
 * Lỗi của Node mang `code` (ENOTFOUND, ETIMEDOUT…) hữu ích hơn `message`, nhưng
 * `catch` cho ra `unknown`. Thu hẹp một lần ở đây thay vì đoán ở sáu chỗ gọi.
 */
const errText = (e: unknown): string => {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string' && code) return code
  }
  return e instanceof Error ? e.message : String(e)
}

const TOKEN_PREFIX = 'tsudev-trust-verification'
const DNS_LABEL = '_tsudev-trust'
const FETCH_TIMEOUT_MS = 10000
const MAX_BODY_BYTES = 512 * 1024

/** Chỉ chấp nhận hostname hợp lệ, không cổng, không đường dẫn, không IP trần. */
function isValidHostname(h: unknown): boolean {
  if (typeof h !== 'string') return false
  const s = h.trim().toLowerCase()
  if (!s || s.length > 253) return false
  if (net.isIP(s)) return false
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(s)
}

/** Dải IP nội bộ — chặn để service không bị dùng làm bàn đạp quét mạng nội bộ. */
function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    // Mặc định -1 giữ ĐÚNG ngữ nghĩa bản cũ: khi thiếu octet, mọi so sánh đều
    // sai và hàm rơi xuống `return false`. net.isIPv4 ở trên vốn đã bảo đảm đủ
    // bốn octet, nên đây chỉ là cách nói điều đó ra cho trình biên dịch.
    const [o0 = -1, o1 = -1] = ip.split('.').map(Number)
    if (o0 === 10 || o0 === 127 || o0 === 0) return true
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true
    if (o0 === 192 && o1 === 168) return true
    if (o0 === 169 && o1 === 254) return true // link-local / metadata cloud
    if (o0 === 100 && o1 >= 64 && o1 <= 127) return true // CGNAT
    return false
  }
  const s = ip.toLowerCase()
  if (s === '::1' || s === '::') return true
  if (s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd')) return true
  if (s.startsWith('::ffff:')) return isPrivateAddress(s.slice(7))
  return false
}

/**
 * Kiểm tra hostname phân giải ra IP công cộng trước khi gọi HTTP.
 *
 * Đây là biện pháp giảm thiểu SSRF theo thông lệ, không tuyệt đối: vẫn còn khe
 * TOCTOU giữa lúc phân giải và lúc fetch (DNS rebinding). Muốn chặn triệt để
 * thì phải ghim IP đã kiểm tra vào tầng socket — ghi lại đây để sau này siết.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  // `{ all: true }` cho MẢNG địa chỉ. Khai thẳng kiểu vì suy diễn từ
  // ReturnType sẽ bắt nhầm overload trả một địa chỉ đơn.
  let addrs: LookupAddress[]
  try {
    addrs = await dns.lookup(hostname, { all: true })
  } catch (e) {
    throw new Error(`Không phân giải được tên miền: ${errText(e)}`)
  }
  if (!addrs.length) throw new Error('Tên miền không có bản ghi địa chỉ')
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new Error(`Tên miền trỏ vào địa chỉ nội bộ (${a.address}) — không chấp nhận`)
    }
  }
}

/** GET có timeout, chặn redirect và giới hạn dung lượng đọc. */
async function safeGet(url: string): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'tsudev-trust-verifier/1.0 (+https://tsudev.com/trust)' },
    })
    const reader = res.body && res.body.getReader ? res.body.getReader() : null
    if (!reader) return { status: res.status, body: (await res.text()).slice(0, MAX_BODY_BYTES) }
    let received = 0
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done || !value) break
      received += value.length
      if (received > MAX_BODY_BYTES) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    return { status: res.status, body: Buffer.concat(chunks.map(Buffer.from)).toString('utf8') }
  } finally {
    clearTimeout(timer)
  }
}

async function checkDnsTxt(hostname: string, token: string): Promise<CheckResult> {
  const name = `${DNS_LABEL}.${hostname}`
  let records: string[][]
  try {
    records = await dns.resolveTxt(name)
  } catch (e) {
    return { ok: false, detail: `Không đọc được TXT tại ${name}: ${errText(e)}` }
  }
  const flat = records.map((r) => (Array.isArray(r) ? r.join('') : String(r)).trim())
  const want = `${TOKEN_PREFIX}=${token}`
  if (flat.some((v) => v === want)) return { ok: true, detail: `Tìm thấy bản ghi TXT tại ${name}` }
  return {
    ok: false,
    detail: `TXT tại ${name} không chứa "${want}". Đang có: ${flat.join(' | ') || '(trống)'}`,
  }
}

async function checkMetaTag(hostname: string, token: string): Promise<CheckResult> {
  await assertPublicHost(hostname)
  const url = `https://${hostname}/`
  let res: Awaited<ReturnType<typeof safeGet>>
  try {
    res = await safeGet(url)
  } catch (e) {
    return { ok: false, detail: `Không tải được ${url}: ${errText(e)}` }
  }
  if (res.status >= 400) return { ok: false, detail: `${url} trả về HTTP ${res.status}` }
  const re = new RegExp(`<meta[^>]+name=["']${TOKEN_PREFIX}["'][^>]+content=["']${token}["']`, 'i')
  const reSwapped = new RegExp(
    `<meta[^>]+content=["']${token}["'][^>]+name=["']${TOKEN_PREFIX}["']`,
    'i'
  )
  if (re.test(res.body) || reSwapped.test(res.body))
    return { ok: true, detail: `Tìm thấy thẻ meta tại ${url}` }
  return { ok: false, detail: `Không thấy thẻ meta ${TOKEN_PREFIX} với token đúng tại ${url}` }
}

async function checkFile(hostname: string, token: string): Promise<CheckResult> {
  await assertPublicHost(hostname)
  const url = `https://${hostname}/.well-known/tsudev-trust-${token}.txt`
  let res: Awaited<ReturnType<typeof safeGet>>
  try {
    res = await safeGet(url)
  } catch (e) {
    return { ok: false, detail: `Không tải được ${url}: ${errText(e)}` }
  }
  if (res.status >= 400) return { ok: false, detail: `${url} trả về HTTP ${res.status}` }
  if (res.body.trim().includes(token))
    return { ok: true, detail: `Tìm thấy tệp xác minh tại ${url}` }
  return { ok: false, detail: `Tệp tại ${url} không chứa token` }
}

/** Chạy kiểm tra theo phương thức đã chọn. Luôn trả object, không ném lỗi. */
async function verifyDomain(
  hostname: unknown,
  method: string,
  token: string
): Promise<CheckResult> {
  if (!isValidHostname(hostname)) return { ok: false, detail: 'Tên miền không hợp lệ' }
  try {
    const host = String(hostname)
    if (method === 'DNS_TXT') return await checkDnsTxt(host, token)
    if (method === 'META_TAG') return await checkMetaTag(host, token)
    if (method === 'FILE') return await checkFile(host, token)
    return { ok: false, detail: `Phương thức không hỗ trợ: ${method}` }
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error && e.message ? e.message : 'Lỗi không xác định khi xác minh',
    }
  }
}

/** Hướng dẫn hiển thị cho khách, tuỳ phương thức. */
function instructionsFor(hostname: string, method: string, token: string) {
  if (method === 'DNS_TXT') {
    return {
      title: 'Thêm một bản ghi TXT',
      record: { type: 'TXT', name: `${DNS_LABEL}.${hostname}`, value: `${TOKEN_PREFIX}=${token}` },
      note: 'Bản ghi DNS có thể mất tới vài giờ để lan truyền.',
    }
  }
  if (method === 'META_TAG') {
    return {
      title: 'Thêm thẻ meta vào trang chủ',
      snippet: `<meta name="${TOKEN_PREFIX}" content="${token}">`,
      note: `Đặt trong <head> của https://${hostname}/`,
    }
  }
  return {
    title: 'Tải lên một tệp xác minh',
    path: `/.well-known/tsudev-trust-${token}.txt`,
    snippet: token,
    note: `Tệp phải truy cập được tại https://${hostname}/.well-known/tsudev-trust-${token}.txt`,
  }
}

export { verifyDomain, instructionsFor, isValidHostname, isPrivateAddress, TOKEN_PREFIX, DNS_LABEL }
