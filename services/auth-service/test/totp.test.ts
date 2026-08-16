process.env.NODE_ENV = 'test'
process.env.TOTP_ENCRYPTION_KEY = 'khoa-ma-hoa-totp-du-dai-cho-test-0123456789'

import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  otpauthUri,
  verifyTotp,
} from '../src/totp'

// Vector kiểm thử của RFC 6238, phụ lục B. Bí mật là ASCII "12345678901234567890"
// mã hoá base32 — nếu bản cài đặt lệch dù chỉ một bit thì các mã dưới đây khác
// ngay, nên đây là thứ chứng minh nó THẬT SỰ là TOTP chứ không phải một hàm
// sinh số ổn định trông giống TOTP.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('TOTP theo RFC 6238', () => {
  test.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('t=%i cho mã %s', (unix, expected) => {
    expect(verifyTotp(RFC_SECRET, expected, unix * 1000)).toBe(true)
  })

  test('mã của bước thời gian khác bị từ chối', () => {
    // 287082 đúng ở t=59; ở t=2000000000 thì cách xa hàng triệu bước.
    expect(verifyTotp(RFC_SECRET, '287082', 2000000000 * 1000)).toBe(false)
  })

  // Cửa sổ ±1 bước: đồng hồ điện thoại lệch vài giây là chuyện thường, và người
  // dùng gõ xong mã thì nó vừa đổi.
  test('chấp nhận lệch một bước, từ chối lệch hai bước', () => {
    const base = 1111111111 * 1000
    expect(verifyTotp(RFC_SECRET, '050471', base + 30_000)).toBe(true)
    expect(verifyTotp(RFC_SECRET, '050471', base - 30_000)).toBe(true)
    expect(verifyTotp(RFC_SECRET, '050471', base + 90_000)).toBe(false)
  })

  test('đầu vào rác không làm ném lỗi', () => {
    expect(verifyTotp(RFC_SECRET, '')).toBe(false)
    expect(verifyTotp(RFC_SECRET, 'abcdef')).toBe(false)
    expect(verifyTotp('không-phải-base32', '123456')).toBe(false)
  })

  test('bí mật sinh ra dùng được và mỗi lần một khác', () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a).not.toEqual(b)
    expect(a).toMatch(/^[A-Z2-7]{32}$/)
  })

  test('otpauth URI mang đủ tham số ứng dụng xác thực cần', () => {
    const uri = otpauthUri('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'alice@tsudev.com')
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
    expect(uri).toContain('issuer=tsudev')
  })
})

describe('mã hoá bí mật khi lưu', () => {
  // Bí mật TOTP KHÔNG băm được — kiểm mã cần chính giá trị đó. Nên nó phải nằm
  // trong DB dưới dạng mã hoá, với khoá ở ngoài DB.
  test('mã hoá rồi giải ra đúng giá trị gốc', () => {
    const s = generateSecret()
    const enc = encryptSecret(s)
    expect(enc).not.toContain(s)
    expect(decryptSecret(enc)).toBe(s)
  })

  test('hai lần mã hoá cùng bí mật cho hai bản mã khác nhau', () => {
    const s = generateSecret()
    expect(encryptSecret(s)).not.toEqual(encryptSecret(s))
  })

  // AES-GCM phát hiện sửa đổi. Không có tính chất này thì ai ghi được vào DB sẽ
  // lật được từng bit của bí mật mà không ai biết.
  test('bản mã bị sửa thì giải ra null, không phải rác', () => {
    const enc = encryptSecret(generateSecret())
    const parts = enc.split('.')
    const data = Buffer.from(parts[2] as string, 'base64')
    data[0] = (data[0] as number) ^ 0xff
    expect(decryptSecret([parts[0], parts[1], data.toString('base64')].join('.'))).toBeNull()
  })

  test('giải bằng khoá khác trả null', () => {
    const enc = encryptSecret(generateSecret())
    const saved = process.env.TOTP_ENCRYPTION_KEY
    process.env.TOTP_ENCRYPTION_KEY = 'mot-khoa-hoan-toan-khac-nhung-van-du-dai-32'
    expect(decryptSecret(enc)).toBeNull()
    process.env.TOTP_ENCRYPTION_KEY = saved
  })
})

describe('mã dự phòng', () => {
  test('sinh 10 mã, tất cả khác nhau', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    codes.forEach((c) => expect(c).toMatch(/^[A-Z2-7]{10}$/))
  })
})
