'use strict'
/**
 * Khoá ký của cơ quan cấp dấu.
 *
 * Chứng chỉ được ký bằng Ed25519 và phát hành dưới dạng JWS compact, kèm `kid`.
 * Khoá công khai công bố ở /.well-known/tsudev-trust-jwks.json để bên thứ ba tự
 * xác minh offline — không cần tin vào API của tsudev.
 *
 * Khoá riêng nạp từ biến môi trường TRUST_SIGNING_KEY: nội dung là PEM PKCS#8
 * ĐÃ base64 hoá, vì PEM nhiều dòng rất dễ hỏng khi đi qua .env / CI secret.
 *
 *   node services/trust-service/scripts/genkey.js
 *
 * Lộ khoá này đồng nghĩa giả được mọi chứng chỉ, nên production BẮT BUỘC phải
 * có biến môi trường; service từ chối khởi động nếu thiếu.
 *
 * XOAY KHOÁ. Chứng chỉ sống hàng năm, còn khoá thì phải thay được — kể cả khẩn
 * cấp khi nghi lộ. Vì vậy service giữ một VÒNG KHOÁ: một khoá đang ký, cộng các
 * khoá đã nghỉ chỉ dùng để xác minh, khai báo ở TRUST_SIGNING_KEYS_RETIRED dạng
 *
 *   kid:<base64 PEM>,kid2:<base64 PEM>
 *
 * PEM ở đây nên là khoá CÔNG KHAI (khoá riêng cũng nhận, service tự rút phần
 * công khai) — đã nghỉ thì không có lý do gì còn giữ khoá riêng trên máy chủ.
 * Cả vòng khoá được công bố trong JWKS, nên chứng chỉ cấp trước lúc xoay vẫn
 * xác minh được, kể cả bởi bên thứ ba không gọi API tsudev.
 */

import crypto from 'crypto'

/**
 * Kết quả xác minh — union phân biệt được theo `valid`.
 *
 * Đây không phải trang trí: nó khiến việc đọc `payload` mà chưa kiểm `valid`
 * trở thành LỖI BIÊN DỊCH. Trước đây hàm trả một object phẳng, nên một nhánh
 * quên kiểm `valid` vẫn chạy và coi payload của chữ ký hỏng là hợp lệ — không
 * có gì báo lỗi. Hình dạng này cũng chính là hợp đồng cho bản Rust/WASM.
 */
export type VerifyResult =
  | { valid: true; payload: unknown; keyId: string }
  | { valid: false; reason: string }

type LoadedKey = { key: crypto.KeyObject; kid: string; dev: boolean }

// Khoá dev cố định, sinh từ seed công khai bên dưới. Cố định (thay vì sinh ngẫu
// nhiên mỗi lần chạy) để chứng chỉ cấp trước khi restart vẫn xác minh được.
// Không bao giờ dùng ngoài môi trường phát triển.
const DEV_SEED = Buffer.from('tsudev-trust-dev-key-do-not-use!', 'utf8') // đúng 32 byte
const DEV_KID = 'dev-insecure'

function devPrivateKey() {
  // Ed25519 PKCS#8 = tiền tố DER cố định + 32 byte seed.
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  return crypto.createPrivateKey({
    key: Buffer.concat([prefix, DEV_SEED]),
    format: 'der',
    type: 'pkcs8',
  })
}

/** Chấp nhận PEM thô hoặc PEM đã base64 hoá — .env nào cũng chở được một dòng. */
function decodePem(raw: string | undefined | null): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  return /BEGIN/.test(s) ? s : Buffer.from(s, 'base64').toString('utf8')
}

function assertEd25519(key: crypto.KeyObject, label: string): crypto.KeyObject {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`${label} phải là khoá Ed25519, nhận được: ${key.asymmetricKeyType}`)
  }
  return key
}

function loadPrivateKey(): LoadedKey {
  const pem = decodePem(process.env.TRUST_SIGNING_KEY)
  if (pem) {
    const key = assertEd25519(crypto.createPrivateKey(pem), 'TRUST_SIGNING_KEY')
    return { key, kid: process.env.TRUST_SIGNING_KEY_ID || 'default', dev: false }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Thiếu TRUST_SIGNING_KEY — không thể cấp chứng chỉ ở môi trường production.')
  }
  console.warn(
    '[trust] CẢNH BÁO: chưa đặt TRUST_SIGNING_KEY, đang dùng khoá dev công khai.\n' +
      '        Chứng chỉ ký bằng khoá này KHÔNG có giá trị. Sinh khoá thật:\n' +
      '        node services/trust-service/scripts/genkey.js'
  )
  return { key: devPrivateKey(), kid: DEV_KID, dev: true }
}

/**
 * Các khoá chỉ dùng để xác minh. Một mục hỏng không được phép làm chết service:
 * hậu quả của việc bỏ qua nó chỉ là vài chứng chỉ cũ báo "không có khoá", còn
 * hậu quả của việc ném lỗi là toàn bộ hệ thống cấp dấu ngừng chạy.
 */
function loadRetiredKeys(): Map<string, crypto.KeyObject> {
  const ring = new Map<string, crypto.KeyObject>()
  const raw = String(process.env.TRUST_SIGNING_KEYS_RETIRED || '').trim()
  for (const entry of raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const sep = entry.indexOf(':')
    if (sep < 1) {
      console.warn(
        `[trust] TRUST_SIGNING_KEYS_RETIRED: bỏ qua mục sai định dạng (cần "kid:<base64 PEM>")`
      )
      continue
    }
    const kid = entry.slice(0, sep).trim()
    try {
      const pem = decodePem(entry.slice(sep + 1))
      // Bản cũ để `null` chảy thẳng vào createPublicKey và dựa vào việc nó ném
      // lỗi. Vẫn rơi vào đúng nhánh catch bên dưới, nhưng nói rõ lý do hơn.
      if (!pem) throw new Error('phần PEM rỗng')
      // Nhận cả khoá riêng lẫn khoá công khai; khoá đã nghỉ chỉ cần phần công khai.
      let pub: crypto.KeyObject
      try {
        pub = crypto.createPublicKey(pem)
      } catch (e) {
        pub = crypto.createPublicKey(crypto.createPrivateKey(pem))
      }
      ring.set(kid, assertEd25519(pub, `khoá đã nghỉ ${kid}`))
    } catch (e) {
      console.warn(
        `[trust] TRUST_SIGNING_KEYS_RETIRED: bỏ qua khoá ${kid} — ${
          e instanceof Error ? e.message : String(e)
        }`
      )
    }
  }
  return ring
}

const { key: privateKey, kid, dev: usingDevKey } = loadPrivateKey()
const publicKey = crypto.createPublicKey(privateKey)

// Vòng khoá xác minh: khoá đang ký + các khoá đã nghỉ.
const verifyRing = loadRetiredKeys()
verifyRing.set(kid, publicKey)

// Ở dev, chứng chỉ cũ trong DB thường được ký bằng khoá dev. Giữ nó trong vòng
// xác minh để trang xác thực không báo hỏng oan sau khi lập trình viên đặt khoá
// thật. Production không bao giờ nạp khoá này.
if (!verifyRing.has(DEV_KID) && process.env.NODE_ENV !== 'production') {
  verifyRing.set(DEV_KID, crypto.createPublicKey(devPrivateKey()))
}

const b64url = (buf: Buffer | string): string => Buffer.from(buf).toString('base64url')

/** Ký payload thành JWS compact (EdDSA). */
function sign(payload: unknown): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey)
  return `${signingInput}.${b64url(sig)}`
}

/**
 * Xác minh JWS. Trả { valid, payload, reason } — không ném lỗi, để trang xác
 * thực hiển thị được lý do hỏng thay vì trả 500.
 */
function verify(jws: string | null | undefined, keyForKid?: crypto.KeyObject): VerifyResult {
  try {
    // Kiểm CÓ MẶT (`=== undefined`), không kiểm truthy.
    //
    // Khác biệt này quan trọng: một JWS tấn công kiểu đổi thuật toán thường có
    // phần chữ ký RỖNG ("header.payload."). Loại nó ở đây vì "sai định dạng" sẽ
    // che mất lý do thật, và lý do thật — thuật toán không được chấp nhận — mới
    // là thứ trang xác minh cần nói ra. Kiểm alg phải được chạy TRƯỚC.
    const parts = String(jws || '').split('.')
    const headerB64 = parts[0]
    const payloadB64 = parts[1]
    const sigB64 = parts[2]
    if (
      parts.length !== 3 ||
      headerB64 === undefined ||
      payloadB64 === undefined ||
      sigB64 === undefined
    ) {
      return { valid: false, reason: 'Chữ ký sai định dạng' }
    }
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string
      kid?: string
    }
    if (header.alg !== 'EdDSA')
      return { valid: false, reason: `Thuật toán không được chấp nhận: ${header.alg}` }
    const pub = keyForKid || (header.kid ? verifyRing.get(header.kid) : undefined)
    if (!pub) return { valid: false, reason: `Không có khoá công khai cho kid=${header.kid}` }
    const ok = crypto.verify(
      null,
      Buffer.from(`${headerB64}.${payloadB64}`),
      pub,
      Buffer.from(sigB64, 'base64url')
    )
    if (!ok) return { valid: false, reason: 'Chữ ký không khớp' }
    return {
      valid: true,
      payload: JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')),
      keyId: header.kid ?? '',
    }
  } catch (e) {
    return {
      valid: false,
      reason: e instanceof Error && e.message ? e.message : 'Không đọc được chữ ký',
    }
  }
}

/**
 * JWKS công khai — chỉ chứa khoá công khai, an toàn để phát tán. Khoá đang ký
 * đứng đầu để client nào chỉ lấy phần tử thứ nhất vẫn dùng đúng.
 */
function jwks(): { keys: Array<Record<string, unknown>> } {
  const toJwk = (pub: crypto.KeyObject, keyId: string) => {
    const jwk = pub.export({ format: 'jwk' })
    return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, use: 'sig', alg: 'EdDSA', kid: keyId }
  }
  const keys = [toJwk(publicKey, kid)]
  for (const [k, pub] of verifyRing) if (k !== kid) keys.push(toJwk(pub, k))
  return { keys }
}

const verifyKeyIds = (): string[] => [...verifyRing.keys()]

export { sign, verify, jwks, kid, usingDevKey, verifyKeyIds }
