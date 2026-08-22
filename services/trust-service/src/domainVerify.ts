'use strict'
/**
 * Xác minh quyền kiểm soát domain - ba cách, khách chọn một:
 *
 *   DNS_TXT   bản ghi TXT tại _tsudev-trust.<hostname> chứa
 *             tsudev-trust-verification=<token>
 *   META_TAG  trang chủ có <meta name="tsudev-trust-verification" content="<token>">
 *   FILE      tải được https://<hostname>/.well-known/tsudev-trust-<token>.txt
 *
 * DNS_TXT là bằng chứng mạnh nhất (chứng minh quyền ở tầng DNS); hai cách còn
 * lại chỉ chứng minh quyền ghi nội dung lên web root.
 */

import { promises as dns, lookup as dnsLookupCb } from 'dns'
import type { LookupAddress } from 'dns'
import https from 'https'
import net from 'net'
import type { LookupFunction } from 'net'

/** Kết quả một lần kiểm tra. Luôn có cả hai trường - không nhánh nào trả rỗng. */
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
const MAX_REDIRECTS = 3

/** Chỉ chấp nhận hostname hợp lệ, không cổng, không đường dẫn, không IP trần. */
function isValidHostname(h: unknown): boolean {
  if (typeof h !== 'string') return false
  const s = h.trim().toLowerCase()
  if (!s || s.length > 253) return false
  if (net.isIP(s)) return false
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(s)
}

/** Dải IP nội bộ - chặn để service không bị dùng làm bàn đạp quét mạng nội bộ. */
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
 * Đây là chốt PRE-FLIGHT cho thông điệp lỗi rõ ràng ở host ban đầu. Chốt CHÍNH
 * chống SSRF nằm ở `guardedLookup`: nó chạy ở MỖI lần connect (kể cả từng chặng
 * redirect) và GHIM vào đúng IP đã kiểm, nên đóng cả khe TOCTOU (DNS rebinding)
 * lẫn SSRF-qua-redirect. Giữ hàm này vì nó bắt lỗi sớm với tên host khách nhập.
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
      throw new Error(`Tên miền trỏ vào địa chỉ nội bộ (${a.address}) - không chấp nhận`)
    }
  }
}

/**
 * Lookup CÓ KIỂM: phân giải hostname, TỪ CHỐI nếu bất kỳ địa chỉ nào là nội bộ,
 * rồi ghim vào chính địa chỉ đã kiểm. `net`/`https` gọi lookup ở MỖI lần connect,
 * nên đặt chốt ở đây khoá được cả TOCTOU (địa chỉ đem nối = địa chỉ vừa kiểm, một
 * nhịp) lẫn SSRF-qua-redirect (mỗi chặng phân giải lại đều đi qua đây).
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  const family = options && typeof options === 'object' ? options.family || 0 : 0
  dnsLookupCb(hostname, { all: true, family }, (err, addrs) => {
    if (err) return callback(err, '', 0)
    if (!addrs.length) return callback(new Error('Tên miền không có bản ghi địa chỉ'), '', 0)
    for (const a of addrs) {
      if (isPrivateAddress(a.address)) {
        return callback(
          new Error(`Tên miền trỏ vào địa chỉ nội bộ (${a.address}) - không chấp nhận`),
          '',
          0
        )
      }
    }
    const first = addrs[0]
    if (!first) return callback(new Error('Tên miền không có bản ghi địa chỉ'), '', 0)
    callback(null, first.address, first.family)
  })
}

/** Một lượt GET đơn (không tự theo redirect), có timeout và trần dung lượng. */
function getOnce(target: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }
    const req = https.get(
      target,
      {
        lookup: guardedLookup,
        timeout: FETCH_TIMEOUT_MS,
        headers: { 'User-Agent': 'tsudev-trust-verifier/1.0 (+https://tsudev.com/trust)' },
      },
      (res) => {
        const status = res.statusCode || 0
        const location = res.headers.location
        if (status >= 300 && status < 400 && location) {
          res.resume() // rút cạn để socket được tái dùng/đóng gọn
          return done(() => resolve({ status, location, body: '' }))
        }
        let received = 0
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => {
          received += c.length
          if (received > MAX_BODY_BYTES) {
            res.destroy()
            done(() => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }))
            return
          }
          chunks.push(c)
        })
        res.on('end', () =>
          done(() => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }))
        )
      }
    )
    req.on('timeout', () => req.destroy(new Error('Hết thời gian chờ khi tải trang')))
    req.on('error', (e) => done(() => reject(e)))
  })
}

/**
 * GET an toàn: chỉ https, tự theo tối đa MAX_REDIRECTS chặng, mỗi chặng phải lại
 * là https và đi qua `guardedLookup`. Redirect sang http (hạ cấp) bị từ chối.
 */
async function safeGet(url: string): Promise<{ status: number; body: string }> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(current)
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = new URL(res.location, current)
      if (next.protocol !== 'https:') {
        throw new Error(`Redirect sang giao thức không phải https: ${next.protocol}`)
      }
      current = next.toString()
      continue
    }
    return { status: res.status, body: res.body }
  }
  throw new Error('Quá nhiều lần chuyển hướng')
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

export {
  verifyDomain,
  instructionsFor,
  isValidHostname,
  isPrivateAddress,
  guardedLookup,
  safeGet,
  TOKEN_PREFIX,
  DNS_LABEL,
}
