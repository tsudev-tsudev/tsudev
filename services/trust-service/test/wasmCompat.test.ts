/**
 * Tương thích ngược giữa bản ký cũ (node:crypto/OpenSSL) và bản mới (Rust/WASM).
 *
 * Đây là tiêu chí nghiệm thu của việc chuyển sang WASM, và nó không phải hình
 * thức: chứng chỉ con dấu sống hàng năm. Nếu bản mới không xác minh nổi chữ ký
 * bản cũ đã tạo, thì mọi chứng chỉ đã cấp đồng loạt trở thành "không hợp lệ"
 * trên trang tra cứu công khai - mà không có gì báo lỗi ở phía máy chủ.
 */
const crypto = require('crypto')
const {
  publicKeyFromPrivatePem,
  signWithPrivatePem,
  verifyWithPublicKey,
} = require('@tsudev/trust-crypto')

function genPem() {
  const { privateKey } = crypto.generateKeyPairSync('ed25519')
  return privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
}

describe('WASM ↔ node:crypto: cùng một Ed25519', () => {
  test('chữ ký hai bên GIỐNG NHAU từng byte', () => {
    // Ed25519 là tất định (RFC 8032): cùng khoá + cùng thông điệp ⇒ cùng chữ ký.
    // Vì thế bằng chứng tương thích ở đây mạnh hơn "cả hai đều xác minh được".
    const pem = genPem()
    const msg = Buffer.from('TSU-CV-2026-000001')
    const fromWasm = Buffer.from(signWithPrivatePem(pem, msg))
    const fromNode = crypto.sign(null, msg, crypto.createPrivateKey(pem))
    expect(fromWasm.equals(fromNode)).toBe(true)
  })

  test('node:crypto ký → WASM xác minh được', () => {
    const pem = genPem()
    const msg = Buffer.from('chứng chỉ cấp bằng bản cũ')
    const sig = crypto.sign(null, msg, crypto.createPrivateKey(pem))
    const pub = publicKeyFromPrivatePem(pem)
    expect(verifyWithPublicKey(pub, msg, sig)).toBe(true)
  })

  test('WASM ký → node:crypto xác minh được', () => {
    const pem = genPem()
    const msg = Buffer.from('chứng chỉ cấp bằng bản mới')
    const sig = Buffer.from(signWithPrivatePem(pem, msg))
    const pub = crypto.createPublicKey(crypto.createPrivateKey(pem))
    expect(crypto.verify(null, msg, pub, sig)).toBe(true)
  })

  test('khoá công khai rút ra khớp nhau', () => {
    const pem = genPem()
    const fromWasm = Buffer.from(publicKeyFromPrivatePem(pem))
    const jwk = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ format: 'jwk' })
    expect(fromWasm.toString('base64url')).toBe(jwk.x)
  })

  test('chữ ký của khoá KHÁC bị từ chối, không phải ném lỗi', () => {
    const msg = Buffer.from('x')
    const sig = crypto.sign(null, msg, crypto.createPrivateKey(genPem()))
    const otherPub = publicKeyFromPrivatePem(genPem())
    expect(verifyWithPublicKey(otherPub, msg, sig)).toBe(false)
  })

  test('đầu vào hỏng thì NÉM LỖI, phân biệt được với "chữ ký sai"', () => {
    const pub = publicKeyFromPrivatePem(genPem())
    expect(() => verifyWithPublicKey(pub, Buffer.from('x'), Buffer.from('quá ngắn'))).toThrow(
      /64 byte/
    )
  })

  test('PEM không phải Ed25519 bị từ chối thay vì ký bừa', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rsaPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
    expect(() => signWithPrivatePem(rsaPem, Buffer.from('x'))).toThrow(/Ed25519/)
  })
})

export {}
