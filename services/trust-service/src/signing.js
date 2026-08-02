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

const crypto = require('crypto')

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
function decodePem(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  return /BEGIN/.test(s) ? s : Buffer.from(s, 'base64').toString('utf8')
}

function assertEd25519(key, label) {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`${label} phải là khoá Ed25519, nhận được: ${key.asymmetricKeyType}`)
  }
  return key
}

function loadPrivateKey() {
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
function loadRetiredKeys() {
  const ring = new Map()
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
      // Nhận cả khoá riêng lẫn khoá công khai; khoá đã nghỉ chỉ cần phần công khai.
      let pub
      try {
        pub = crypto.createPublicKey(pem)
      } catch (e) {
        pub = crypto.createPublicKey(crypto.createPrivateKey(pem))
      }
      ring.set(kid, assertEd25519(pub, `khoá đã nghỉ ${kid}`))
    } catch (e) {
      console.warn(`[trust] TRUST_SIGNING_KEYS_RETIRED: bỏ qua khoá ${kid} — ${e.message}`)
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

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/** Ký payload thành JWS compact (EdDSA). */
function sign(payload) {
  const header = { alg: 'EdDSA', typ: 'JWT', kid }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey)
  return `${signingInput}.${b64url(sig)}`
}

/**
 * Xác minh JWS. Trả { valid, payload, reason } — không ném lỗi, để trang xác
 * thực hiển thị được lý do hỏng thay vì trả 500.
 */
function verify(jws, keyForKid) {
  try {
    const parts = String(jws || '').split('.')
    if (parts.length !== 3) return { valid: false, reason: 'Chữ ký sai định dạng' }
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (header.alg !== 'EdDSA')
      return { valid: false, reason: `Thuật toán không được chấp nhận: ${header.alg}` }
    const pub = keyForKid || verifyRing.get(header.kid)
    if (!pub) return { valid: false, reason: `Không có khoá công khai cho kid=${header.kid}` }
    const ok = crypto.verify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`),
      pub,
      Buffer.from(parts[2], 'base64url')
    )
    if (!ok) return { valid: false, reason: 'Chữ ký không khớp' }
    return {
      valid: true,
      payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
      keyId: header.kid,
    }
  } catch (e) {
    return { valid: false, reason: e && e.message ? e.message : 'Không đọc được chữ ký' }
  }
}

/**
 * JWKS công khai — chỉ chứa khoá công khai, an toàn để phát tán. Khoá đang ký
 * đứng đầu để client nào chỉ lấy phần tử thứ nhất vẫn dùng đúng.
 */
function jwks() {
  const toJwk = (pub, keyId) => {
    const jwk = pub.export({ format: 'jwk' })
    return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, use: 'sig', alg: 'EdDSA', kid: keyId }
  }
  const keys = [toJwk(publicKey, kid)]
  for (const [k, pub] of verifyRing) if (k !== kid) keys.push(toJwk(pub, k))
  return { keys }
}

module.exports = {
  sign,
  verify,
  jwks,
  kid,
  usingDevKey,
  verifyKeyIds: () => [...verifyRing.keys()],
}
