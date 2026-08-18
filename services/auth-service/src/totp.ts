import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'crypto'

/**
 * TOTP (RFC 6238) và mã dự phòng.
 *
 * TỰ CÀI, KHÔNG DÙNG THƯ VIỆN. Thuật toán là HMAC-SHA1 trên một bộ đếm 8 byte
 * cộng phép rút gọn động - khoảng ba mươi dòng, và `crypto` của Node đã lo phần
 * mật mã thật sự. Cùng lý do với ba phụ thuộc của packages/trust-crypto: mỗi
 * gói thêm vào đường xác thực là một mặt tiếp xúc chuỗi cung ứng nữa, đổi lấy
 * việc tiết kiệm ba mươi dòng.
 */

const DIGITS = 6
const PERIOD_S = 30

/**
 * Cửa sổ chấp nhận: ±1 bước (tổng 90 giây).
 *
 * Cần vì đồng hồ điện thoại lệch, và vì người dùng gõ xong mã thì nó vừa đổi.
 * Rộng hơn nữa thì mỗi mã sống lâu hơn, tức là cửa sổ dùng lại mã bắt được
 * cũng rộng hơn - 1 là mức mà cả RFC lẫn thực tế đều dừng lại.
 */
const WINDOW = 1

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateSecret(): string {
  const buf = randomBytes(20)
  let bits = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = ''
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx < 0) throw new Error('base32 không hợp lệ')
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', key).update(buf).digest()
  // Rút gọn động: 4 bit cuối chọn điểm bắt đầu, rồi lấy 31 bit từ đó.
  const offset = (mac[mac.length - 1] as number) & 0x0f
  const code =
    (((mac[offset] as number) & 0x7f) << 24) |
    ((mac[offset + 1] as number) << 16) |
    ((mac[offset + 2] as number) << 8) |
    (mac[offset + 3] as number)
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

/**
 * Sinh mã TOTP cho một thời điểm.
 *
 * Xuất ra để test dùng được. Bản test trước tự dò cạn từ 000000 cho tới khi
 * `verifyTotp` chịu - tới một triệu lần HMAC, đủ chậm để vượt quá timeout của
 * jest VÀ đủ chậm để trôi qua ranh giới cửa sổ 30 giây giữa chừng, khiến kết
 * quả phụ thuộc vào lúc chạy.
 */
export function totpCode(secretB32: string, now = Date.now()): string {
  return hotp(base32Decode(secretB32), Math.floor(now / 1000 / PERIOD_S))
}

/**
 * Kiểm mã TOTP.
 *
 * So sánh theo THỜI GIAN HẰNG với từng mã ứng viên. So bằng `===` rò rỉ số ký
 * tự khớp đầu tiên qua thời gian trả lời - với không gian chỉ một triệu giá
 * trị, đó là một rò rỉ có ý nghĩa.
 */
export function verifyTotp(secretB32: string, code: string, now = Date.now()): boolean {
  const digits = String(code || '').replace(/\D/g, '')
  if (digits.length !== DIGITS) return false
  let key: Buffer
  try {
    key = base32Decode(secretB32)
  } catch {
    return false
  }
  const counter = Math.floor(now / 1000 / PERIOD_S)
  let ok = false
  for (let d = -WINDOW; d <= WINDOW; d++) {
    // KHÔNG thoát sớm khi khớp: thoát sớm biến vòng lặp này thành một kênh phụ
    // cho biết mã lệch bao nhiêu bước so với hiện tại.
    if (timingSafeStringEqual(hotp(key, counter + d), digits)) ok = true
  }
  return ok
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** URI cho ứng dụng xác thực quét mã QR. */
export function otpauthUri(secretB32: string, account: string, issuer = 'tsudev'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_S),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Mã hoá bí mật khi lưu
//
// Bí mật TOTP KHÔNG băm được - kiểm mã cần chính giá trị đó. Nên nó phải được
// MÃ HOÁ, và khoá nằm ngoài DB. Một bản sao DB bị rò mà không kèm khoá ứng dụng
// thì không sinh được mã của ai cả.
// ---------------------------------------------------------------------------

const ALGO = 'aes-256-gcm'

function encKey(): Buffer {
  const s = process.env.TOTP_ENCRYPTION_KEY || ''
  if (s.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY thiếu hoặc ngắn hơn 32 ký tự')
  }
  // scrypt để một chuỗi người đặt trở thành khoá 32 byte đúng chuẩn. Muối cố
  // định là chấp nhận được ở đây: đầu vào đã là bí mật entropy cao, không phải
  // mật khẩu người nhớ, nên không có gì để dò bằng bảng cầu vồng.
  return scryptSync(s, 'tsudev-totp-v1', 32)
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, encKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  // iv.tag.ciphertext - GCM cần cả ba để giải và để phát hiện sửa đổi.
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join('.')
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = stored.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = createDecipheriv(ALGO, encKey(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // Khoá sai hoặc dữ liệu bị sửa - GCM phát hiện được, và cả hai đều là
    // "không dùng được", không phải "sập".
    return null
  }
}

/** Mã dự phòng: 10 mã, mỗi mã 10 ký tự base32. Chỉ hiện MỘT LẦN lúc sinh. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(7)
    let bits = ''
    for (const b of raw) bits += b.toString(2).padStart(8, '0')
    let out = ''
    for (let i = 0; i + 5 <= bits.length && out.length < 10; i += 5) {
      out += B32[parseInt(bits.slice(i, i + 5), 2)]
    }
    return out
  })
}
