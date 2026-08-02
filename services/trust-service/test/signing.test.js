'use strict'
/**
 * Vòng khoá phải chịu được việc xoay khoá: chứng chỉ ký bằng khoá cũ vẫn xác
 * minh được sau khi khoá mới lên thay. Đây là thứ hỏng âm thầm — không ai phát
 * hiện cho tới ngày xoay khoá thật, lúc đó mọi chứng chỉ đã cấp cùng chết.
 *
 * signing.js đọc biến môi trường ngay khi nạp module, nên mỗi kịch bản phải
 * jest.resetModules() rồi require lại.
 */

const crypto = require('crypto')

function genKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  return {
    privB64: Buffer.from(privateKey.export({ format: 'pem', type: 'pkcs8' })).toString('base64'),
    pubB64: Buffer.from(publicKey.export({ format: 'pem', type: 'spki' })).toString('base64'),
  }
}

function loadSigning(env) {
  jest.resetModules()
  for (const k of ['TRUST_SIGNING_KEY', 'TRUST_SIGNING_KEY_ID', 'TRUST_SIGNING_KEYS_RETIRED'])
    delete process.env[k]
  Object.assign(process.env, env)
  return require('../src/signing')
}

const KEY_A = genKey()
const KEY_B = genKey()

afterAll(() => {
  for (const k of ['TRUST_SIGNING_KEY', 'TRUST_SIGNING_KEY_ID', 'TRUST_SIGNING_KEYS_RETIRED'])
    delete process.env[k]
})

describe('vòng khoá ký', () => {
  test('ký rồi tự xác minh được', () => {
    const s = loadSigning({ TRUST_SIGNING_KEY: KEY_A.privB64, TRUST_SIGNING_KEY_ID: 'key-a' })
    const jws = s.sign({ serial: 'TSU-CV-2026-000001' })
    const r = s.verify(jws)
    expect(r.valid).toBe(true)
    expect(r.payload.serial).toBe('TSU-CV-2026-000001')
    expect(r.keyId).toBe('key-a')
  })

  test('sau khi xoay khoá, chứng chỉ ký bằng khoá cũ VẪN xác minh được', () => {
    const before = loadSigning({ TRUST_SIGNING_KEY: KEY_A.privB64, TRUST_SIGNING_KEY_ID: 'key-a' })
    const oldJws = before.sign({ serial: 'TSU-CV-2026-000001' })

    const after = loadSigning({
      TRUST_SIGNING_KEY: KEY_B.privB64,
      TRUST_SIGNING_KEY_ID: 'key-b',
      TRUST_SIGNING_KEYS_RETIRED: `key-a:${KEY_A.pubB64}`,
    })
    expect(after.kid).toBe('key-b')
    expect(after.verify(oldJws).valid).toBe(true)
    expect(after.verify(after.sign({ serial: 'TSU-CV-2026-000002' })).valid).toBe(true)
  })

  test('quên khai khoá cũ thì chứng chỉ cũ báo thiếu khoá, không báo hợp lệ', () => {
    const before = loadSigning({ TRUST_SIGNING_KEY: KEY_A.privB64, TRUST_SIGNING_KEY_ID: 'key-a' })
    const oldJws = before.sign({ serial: 'TSU-CV-2026-000001' })
    const after = loadSigning({ TRUST_SIGNING_KEY: KEY_B.privB64, TRUST_SIGNING_KEY_ID: 'key-b' })
    const r = after.verify(oldJws)
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/key-a/)
  })

  test('JWKS công bố cả khoá đang ký lẫn khoá đã nghỉ, khoá đang ký đứng đầu', () => {
    const s = loadSigning({
      TRUST_SIGNING_KEY: KEY_B.privB64,
      TRUST_SIGNING_KEY_ID: 'key-b',
      TRUST_SIGNING_KEYS_RETIRED: `key-a:${KEY_A.pubB64}`,
    })
    const kids = s.jwks().keys.map((k) => k.kid)
    expect(kids[0]).toBe('key-b')
    expect(kids).toContain('key-a')
    // Không được rò khoá riêng ra JWKS.
    for (const k of s.jwks().keys) expect(k.d).toBeUndefined()
  })

  test('mục khai sai trong TRUST_SIGNING_KEYS_RETIRED bị bỏ qua, service vẫn chạy', () => {
    const s = loadSigning({
      TRUST_SIGNING_KEY: KEY_B.privB64,
      TRUST_SIGNING_KEY_ID: 'key-b',
      TRUST_SIGNING_KEYS_RETIRED: `hongbet,key-a:${KEY_A.pubB64},key-x:khong-phai-pem`,
    })
    expect(s.verifyKeyIds()).toContain('key-a')
    expect(s.verifyKeyIds()).not.toContain('key-x')
    expect(s.verify(s.sign({ ok: 1 })).valid).toBe(true)
  })

  test('chữ ký bị sửa thì không hợp lệ', () => {
    const s = loadSigning({ TRUST_SIGNING_KEY: KEY_A.privB64, TRUST_SIGNING_KEY_ID: 'key-a' })
    const parts = s.sign({ serial: 'TSU-CV-2026-000001' }).split('.')
    const forged = Buffer.from(JSON.stringify({ serial: 'TSU-CV-2026-999999' })).toString(
      'base64url'
    )
    expect(s.verify(`${parts[0]}.${forged}.${parts[2]}`).valid).toBe(false)
  })

  test('từ chối alg khác EdDSA — chặn kiểu tấn công đổi thuật toán', () => {
    const s = loadSigning({ TRUST_SIGNING_KEY: KEY_A.privB64, TRUST_SIGNING_KEY_ID: 'key-a' })
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'key-a' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ serial: 'x' })).toString('base64url')
    const r = s.verify(`${header}.${body}.`)
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/không được chấp nhận/i)
  })

  test('khoá không phải Ed25519 bị từ chối ngay lúc nạp', () => {
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const b64 = Buffer.from(rsa.privateKey.export({ format: 'pem', type: 'pkcs8' })).toString(
      'base64'
    )
    expect(() => loadSigning({ TRUST_SIGNING_KEY: b64 })).toThrow(/Ed25519/)
  })

  test('production thiếu khoá thì service chết hẳn, không âm thầm dùng khoá dev', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => loadSigning({})).toThrow(/TRUST_SIGNING_KEY/)
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})
