process.env.NODE_ENV = 'test'

import {
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LEN,
  COMMON_FOR_TEST,
} from '../src/password'

describe('chính sách mật khẩu', () => {
  test('từ chối mật khẩu ngắn hơn mức tối thiểu', () => {
    expect(checkPasswordPolicy('a'.repeat(MIN_PASSWORD_LEN - 1))).toBe('too_short')
    expect(checkPasswordPolicy('a'.repeat(MIN_PASSWORD_LEN))).toBeNull()
  })

  // Chặn độ dài trên KHÔNG phải để làm khó người dùng: Argon2id tốn bộ nhớ theo
  // thiết kế, nên một chuỗi vài megabyte biến mỗi lần thử đăng nhập thành một
  // đợt từ chối dịch vụ tự gây ra.
  test('từ chối mật khẩu dài bất thường', () => {
    expect(checkPasswordPolicy('a'.repeat(5000))).toBe('too_long')
  })

  test('từ chối mật khẩu trong danh sách chặn, không phân biệt hoa thường', () => {
    expect(checkPasswordPolicy('administrator')).toBe('too_common')
    expect(checkPasswordPolicy('ADMINISTRATOR')).toBe('too_common')
    expect(checkPasswordPolicy('AdMiNiStRaToR')).toBe('too_common')
  })

  // Mục ngắn hơn MIN_PASSWORD_LEN thì `too_short` bắt trước, nên nó là một dòng
  // chết trông giống một lớp phòng thủ. Test này canh chính điều đó.
  test('mọi mục trong danh sách chặn đều thực sự với tới được', () => {
    for (const pw of COMMON_FOR_TEST) {
      expect(pw.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LEN)
      expect(checkPasswordPolicy(pw)).toBe('too_common')
    }
  })
})

describe('băm mật khẩu', () => {
  // Argon2id có muối ngẫu nhiên: hai lần băm cùng một mật khẩu PHẢI khác nhau.
  // Nếu giống nhau thì bảng cầu vồng lại dùng được, và hai người đặt trùng mật
  // khẩu sẽ nhìn thấy được điều đó từ chính bản sao DB.
  test('cùng mật khẩu cho hai hash khác nhau, cả hai đều kiểm đúng', async () => {
    const pw = 'mot-mat-khau-du-dai-2026'
    const a = await hashPassword(pw)
    const b = await hashPassword(pw)
    expect(a).not.toEqual(b)
    expect(await verifyPassword(a, pw)).toBe(true)
    expect(await verifyPassword(b, pw)).toBe(true)
  }, 20000)

  test('mật khẩu sai bị từ chối', async () => {
    const h = await hashPassword('mot-mat-khau-du-dai-2026')
    expect(await verifyPassword(h, 'mot-mat-khau-du-dai-2027')).toBe(false)
  }, 20000)

  // verifyPassword KHÔNG ĐƯỢC ném ra ngoài: hash hỏng hay khác định dạng làm
  // đường đăng nhập trả 500 thay vì 401, và chênh lệch đó tự nó là kênh phụ cho
  // biết bản ghi nào tồn tại.
  test('hash hỏng trả false chứ không ném lỗi', async () => {
    await expect(verifyPassword('không-phải-hash', 'gì-cũng-được')).resolves.toBe(false)
    await expect(verifyPassword('', 'gì-cũng-được')).resolves.toBe(false)
  })

  // bcrypt cắt cụt im lặng ở 72 byte. Argon2id thì không - test này là lưới an
  // toàn cho việc ai đó đổi thuật toán về sau.
  test('không cắt cụt ở 72 byte', async () => {
    const base = 'x'.repeat(72)
    const h = await hashPassword(base + 'ĐUÔI-KHÁC-NHAU-A')
    expect(await verifyPassword(h, base + 'ĐUÔI-KHÁC-NHAU-B')).toBe(false)
  }, 20000)
})
