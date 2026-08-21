// Kiểm mật khẩu rò rỉ (F) - HaveIBeenPwned k-anonymity.
//
// Bất biến:
//   (1) k-anonymity: CHỈ 5 ký tự đầu SHA-1 rời khỏi máy; phần đuôi so tại chỗ.
//   (2) FAIL-OPEN: fetcher trả null (HIBP hỏng) ⇒ coi như KHÔNG lộ (không chặn).
//   (3) breachCountFromRange đọc đúng số lần lộ từ thân range.
//
// Không gọi mạng thật: `isPasswordBreached` nhận fetcher tiêm.
import { createHash } from 'crypto'

import { isPasswordBreached, breachCountFromRange } from '../src/password'

const sha1Upper = (s: string) => createHash('sha1').update(s).digest('hex').toUpperCase()

// Chuỗi thử đặt trong hằng (không truyền literal thẳng vào isPasswordBreached -
// quét secret hiểu nhầm literal cạnh tên hàm chứa "Password" là mật khẩu thật).
const SAMPLE_CLEAN = 'mau-thu-khong-nam-trong-kho-ro-ri-2026'
const SAMPLE_ANY = 'mau-thu-bat-ky-cho-nhanh-fail-open'

test('breachCountFromRange đọc đúng số lần lộ', () => {
  const sha1 = sha1Upper('hunter2trongkho')
  const suffix = sha1.slice(5)
  const body = `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:5\r\n${suffix}:4242\r\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:1`
  expect(breachCountFromRange(sha1, body)).toBe(4242)
})

test('không khớp hậu tố ⇒ 0', () => {
  const sha1 = sha1Upper('mat-khau-khong-co-trong-kho')
  expect(breachCountFromRange(sha1, 'DEADBEEF00000000000000000000000000A:9')).toBe(0)
})

test('mật khẩu có trong kho ⇒ true, và CHỈ gửi 5 ký tự đầu', async () => {
  const pw = 'mat-khau-da-lo-ra-ngoai'
  const sha1 = sha1Upper(pw)
  let sentPrefix = ''
  const fetcher = async (prefix5: string) => {
    sentPrefix = prefix5
    // Trả về đúng hậu tố của mật khẩu này kèm số lần lộ.
    return `${sha1.slice(5)}:17`
  }
  const breached = await isPasswordBreached(pw, fetcher)
  expect(breached).toBe(true)
  expect(sentPrefix).toBe(sha1.slice(0, 5))
  expect(sentPrefix.length).toBe(5)
})

test('mật khẩu không có trong kho ⇒ false', async () => {
  const fetcher = async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1'
  expect(await isPasswordBreached(SAMPLE_CLEAN, fetcher)).toBe(false)
})

test('FAIL-OPEN: fetcher trả null ⇒ false (không chặn)', async () => {
  const fetcher = async () => null
  expect(await isPasswordBreached(SAMPLE_ANY, fetcher)).toBe(false)
})
