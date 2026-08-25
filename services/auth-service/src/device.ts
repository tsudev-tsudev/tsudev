// Nhận diện THIẾT BỊ để quyết định có gửi cảnh báo đăng nhập hay không.
//
// Vì sao tách khỏi `index.ts`: đây là logic thuần, không chạm DB và không chạm
// mạng, nên nó test được trực tiếp bằng bảng ví dụ. Bản trước nằm lẫn trong
// `alertIfNewDevice` và vì thế không có test nào - mà đây đúng là loại mã sai
// một cách IM LẶNG: sai kiểu "cảnh báo quá nhiều" thì không ai báo lỗi, người
// dùng chỉ lặng lẽ học cách bỏ qua thư.
//
// ⚠️ Bản trước định nghĩa "thiết bị lạ" = CHƯA từng thấy đúng địa chỉ IP này.
// Trên mạng di động, IP đổi gần như mỗi lần kết nối, nên định nghĩa đó gửi cảnh
// báo ở gần như MỌI lượt đăng nhập. Hậu quả không phải phiền: nó là mệt mỏi
// cảnh báo, và cái chết ở đây là cảnh báo THẬT chìm lẫn trong hàng chục cảnh
// báo giả. Một cơ chế báo động kêu suốt ngày thì tương đương không có.

/** Một sự kiện cũ, đủ trường để so sánh. Khai lỏng vì nguồn là hàng trong DB. */
export type PastSignal = {
  ip?: string | null
  country?: string | null
  userAgent?: string | null
}

export type CurrentSignal = {
  ip?: string | null
  country?: string | null
  userAgent?: string | null
}

/**
 * Rút gọn User-Agent thành khoá thiết bị THÔ: dòng trình duyệt + dòng hệ điều
 * hành, KHÔNG kèm số phiên bản.
 *
 * Bỏ phiên bản là có chủ đích: Chrome tự cập nhật mỗi vài tuần, và nếu phiên bản
 * nằm trong khoá thì mỗi lần cập nhật lại thành "thiết bị mới". Thứ ta muốn nhận
 * ra là "vẫn máy đó", không phải "vẫn đúng bản dựng đó".
 *
 * Trả `null` khi không đọc được - người gọi PHẢI coi `null` là "không biết" chứ
 * không phải "khác", nếu không thì mọi client không gửi UA đều bị báo động.
 */
export function deviceKey(ua: string | null | undefined): string | null {
  const s = (ua || '').trim()
  if (!s) return null

  // Thứ tự QUAN TRỌNG: chuỗi UA của Edge chứa cả "Chrome", của Chrome chứa cả
  // "Safari". Khớp từ cụ thể nhất tới chung nhất, đảo lại là gán nhầm hàng loạt.
  const browser = /\bEdg[A-Z]?\//.test(s)
    ? 'Edge'
    : /\bOPR\/|\bOpera\b/.test(s)
    ? 'Opera'
    : /\bFirefox\/|\bFxiOS\//.test(s)
    ? 'Firefox'
    : /\bCriOS\/|\bChrome\//.test(s)
    ? 'Chrome'
    : /\bSafari\//.test(s)
    ? 'Safari'
    : 'Khác'

  const os = /\bWindows\b/.test(s)
    ? 'Windows'
    : /\bAndroid\b/.test(s)
    ? 'Android'
    : /\b(iPhone|iPad|iPod)\b/.test(s)
    ? 'iOS'
    : /\bMac OS X\b|\bMacintosh\b/.test(s)
    ? 'macOS'
    : /\bLinux\b|\bX11\b/.test(s)
    ? 'Linux'
    : 'Khác'

  // Cả hai đều không đoán ra được thì chuỗi này không mang tin gì - trả null để
  // người gọi lùi về so theo IP thay vì gom mọi UA lạ vào chung một khoá.
  if (browser === 'Khác' && os === 'Khác') return null
  return `${browser}/${os}`
}

/** Nhãn đọc được cho người, để đưa vào thân thư cảnh báo. */
export function deviceLabel(ua: string | null | undefined): string {
  return deviceKey(ua) ?? 'Thiết bị không xác định'
}

/**
 * Một sự kiện cũ có chứng minh được thiết bị hiện tại là QUEN không.
 *
 * Quen theo HAI đường độc lập, chỉ cần một:
 *
 *  1. **Trùng đúng IP.** Cùng một địa chỉ nghĩa là cùng một đường mạng; mở thêm
 *     một trình duyệt khác trên chính máy đó không đáng báo động.
 *  2. **Trùng khoá thiết bị VÀ trùng quốc gia.** Đây là đường xử lý IP động: máy
 *     vẫn thế, nhà mạng đổi IP. Buộc phải trùng quốc gia vì nếu bỏ điều kiện đó
 *     thì kẻ chiếm tài khoản chỉ cần dùng cùng dòng trình duyệt là im lặng đi
 *     qua - mà "Chrome/Windows" là tổ hợp phổ biến nhất thế giới.
 *
 * `null` ở khoá thiết bị KHÔNG khớp với `null` khác: không đọc được UA thì không
 * kết luận gì, chỉ còn đường (1).
 */
export function matchesKnownDevice(past: PastSignal, cur: CurrentSignal): boolean {
  if (past.ip && cur.ip && past.ip === cur.ip) return true

  const pk = deviceKey(past.userAgent)
  const ck = deviceKey(cur.userAgent)
  if (pk && ck && pk === ck) {
    // `null` quốc gia ở hai bên coi là khớp: lời gọi không đi qua tầng biên
    // (test, kịch bản nội bộ) không có `CF-IPCountry`, và bắt chúng lệch nhau
    // biến mọi lượt đăng nhập nội bộ thành báo động.
    return (past.country ?? null) === (cur.country ?? null)
  }
  return false
}

/**
 * Có nên cảnh báo cho lượt đăng nhập này không.
 *
 * Ba lối thoát sớm, mỗi lối đóng một kiểu nhiễu:
 *  - Không có tín hiệu nào (không IP, không UA) ⇒ không đoán bừa.
 *  - Chưa có sự kiện cũ nào ⇒ đây là lượt đăng nhập ĐẦU TIÊN. Báo "thiết bị lạ"
 *    ngay sau khi vừa đăng ký là nói với người dùng một điều họ đã biết.
 *  - Khớp bất kỳ sự kiện cũ nào ⇒ quen.
 */
export function shouldAlertNewDevice(pastEvents: PastSignal[], cur: CurrentSignal): boolean {
  if (!cur.ip && !cur.userAgent) return false
  if (pastEvents.length === 0) return false
  return !pastEvents.some((e) => matchesKnownDevice(e, cur))
}
