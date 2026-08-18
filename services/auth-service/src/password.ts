import { randomBytes } from 'crypto'

import { hash, verify, Algorithm } from '@node-rs/argon2'

/**
 * Băm và kiểm mật khẩu.
 *
 * Argon2id chứ không phải bcrypt: bcrypt cắt cụt ở 72 byte trong im lặng (mật
 * khẩu dài hơn thì phần đuôi KHÔNG được tính vào), và không có tham số bộ nhớ
 * nên phần cứng chuyên dụng rút ngắn khoảng cách nhanh hơn nhiều.
 *
 * Tham số theo khuyến nghị OWASP cho Argon2id: 19 MiB, 2 vòng, song song 1.
 * Đây là mức chạy được trên instance 512MB của Render mà vẫn tốn kém cho kẻ dò.
 */
const OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

/**
 * Độ dài tối đa. KHÔNG phải để làm khó người dùng - là để một chuỗi 10MB không
 * biến mỗi lần thử đăng nhập thành một đợt từ chối dịch vụ tự gây ra.
 */
export const MAX_PASSWORD_LEN = 200
export const MIN_PASSWORD_LEN = 12

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common'

/**
 * Danh sách chặn ngắn, có chủ đích.
 *
 * Đây không phải bộ lọc mật khẩu yếu đầy đủ - thứ đó cần k-anonymity với
 * HaveIBeenPwned, và một lệnh gọi mạng ở giữa luồng đăng ký là một điểm hỏng
 * mới. Danh sách này chỉ chặn phần đuôi dài nhất của phân phối thực tế.
 */
//
// MỌI mục PHẢI dài ít nhất MIN_PASSWORD_LEN ký tự. Ngắn hơn thì `too_short`
// bắt trước và mục đó không bao giờ với tới được - một dòng chết trông như
// một lớp phòng thủ. ('password' và 'password123' từng nằm ở đây đúng như vậy.)
const COMMON = new Set([
  '123456789012',
  'qwertyuiop12',
  'administrator',
  'iloveyou1234',
  'letmein12345',
  'welcome12345',
  'changeme1234',
  'passw0rd1234',
])

/** Xuất ra CHỈ để test canh được bất biến "mọi mục đều với tới được". */
export const COMMON_FOR_TEST: readonly string[] = [...COMMON]

/** Trả về vấn đề đầu tiên tìm thấy, hoặc null nếu mật khẩu dùng được. */
export function checkPasswordPolicy(pw: string): PasswordProblem | null {
  if (pw.length < MIN_PASSWORD_LEN) return 'too_short'
  if (pw.length > MAX_PASSWORD_LEN) return 'too_long'
  if (COMMON.has(pw.toLowerCase())) return 'too_common'
  return null
}

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, OPTS)
}

/**
 * Kiểm mật khẩu. KHÔNG BAO GIỜ ném ra ngoài.
 *
 * Hash hỏng hoặc khác định dạng làm `verify` ném lỗi. Để lỗi đó nổi lên thì
 * đường đăng nhập trả 500 thay vì 401, và chênh lệch đó tự nó là một kênh phụ
 * cho biết tài khoản nào tồn tại.
 */
export async function verifyPassword(hashStr: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashStr, pw, OPTS)
  } catch {
    return false
  }
}

/**
 * Đốt thời gian khi tài khoản KHÔNG tồn tại.
 *
 * Thiếu bước này, "không có user" trả lời trong 1ms còn "sai mật khẩu" mất
 * ~50ms - đủ để liệt kê xem địa chỉ email nào đã đăng ký.
 *
 * Hash được TÍNH lúc chạy từ một giá trị ngẫu nhiên, không phải hằng dán vào mã
 * nguồn: một chuỗi hằng chép sai định dạng sẽ làm `verify` ném lỗi lúc phân
 * tích rồi trả về gần như tức thì - tức là im lặng không đốt thời gian gì cả,
 * đúng thứ hàm này tồn tại để làm.
 */
let dummyHash: Promise<string> | null = null

export async function burnTiming(pw: string): Promise<void> {
  if (!dummyHash) dummyHash = hashPassword(randomBytes(32).toString('hex'))
  await verifyPassword(await dummyHash, pw)
}
