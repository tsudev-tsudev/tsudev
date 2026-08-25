// Đường gửi thư giao dịch: bản chữ thuần và nhận diện thiết bị.
//
// Hai mảng này trước đây KHÔNG có test nào, và cả hai sai một cách im lặng:
//   - Thiếu `text` thì thư vẫn gửi được, chỉ là bị chấm điểm rác cao hơn và
//     trình đọc màn hình không đọc được. Không ai báo lỗi.
//   - "Thiết bị lạ" định nghĩa quá hẹp thì hệ thống gửi cảnh báo ở gần như mọi
//     lượt đăng nhập. Cũng không ai báo lỗi - người dùng chỉ ngừng đọc thư.
//
// Test ở đây là logic THUẦN, không chạm DB và không chạm mạng: đó là lý do
// `device.ts` được tách ra khỏi `index.ts`.
process.env.NODE_ENV = 'test'

export {}

const { htmlToText } = require('../src/mailer')
const {
  deviceKey,
  deviceLabel,
  matchesKnownDevice,
  shouldAlertNewDevice,
} = require('../src/device')

const UA_CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const UA_CHROME_WIN_MOI = UA_CHROME_WIN.replace('140.0.0.0', '141.0.0.0')
const UA_EDGE_WIN = `${UA_CHROME_WIN} Edg/140.0.0.0`
const UA_SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

describe('bản chữ thuần của thư', () => {
  it('giữ ĐỊA CHỈ liên kết, không chỉ giữ nhãn', () => {
    // Đây là bất biến quan trọng nhất: thư xác minh tồn tại để mang một đường
    // link. Bản chữ mất link là bản chữ vô dụng.
    const text = htmlToText(
      '<p><a href="https://tsudev.com/verify?token=abc">Xác minh email</a></p>'
    )
    expect(text).toContain('https://tsudev.com/verify?token=abc')
    expect(text).toContain('Xác minh email')
  })

  it('không để sót thẻ HTML nào', () => {
    const text = htmlToText('<p>Chào <strong>Tinh</strong>,</p><p>Xin chào.</p>')
    expect(text).not.toMatch(/<[^>]+>/)
    expect(text).toContain('Chào Tinh,')
  })

  it('giải mã thực thể HTML đã thoát', () => {
    // `esc()` thoát tên hiển thị trước khi nhúng; bản chữ phải trả chúng về
    // nguyên trạng, nếu không người dùng đọc thấy "Tinh &amp; Co".
    expect(htmlToText('<p>Tinh &amp; Co &lt;3&gt;</p>')).toBe('Tinh & Co <3>')
  })

  it('tách đoạn thành dòng, không dính liền nhau', () => {
    expect(htmlToText('<p>Một</p><p>Hai</p>')).toBe('Một\n\nHai')
  })
})

describe('khoá thiết bị', () => {
  it('bỏ qua số phiên bản - trình duyệt tự cập nhật không thành thiết bị mới', () => {
    expect(deviceKey(UA_CHROME_WIN)).toBe(deviceKey(UA_CHROME_WIN_MOI))
  })

  it('Edge KHÔNG bị nhận nhầm thành Chrome dù UA chứa cả hai', () => {
    expect(deviceKey(UA_EDGE_WIN)).toBe('Edge/Windows')
    expect(deviceKey(UA_CHROME_WIN)).toBe('Chrome/Windows')
  })

  it('nhận ra Safari trên iOS', () => {
    expect(deviceKey(UA_SAFARI_IOS)).toBe('Safari/iOS')
  })

  it('UA rỗng hoặc vô nghĩa ⇒ null, KHÔNG phải một khoá gom chung', () => {
    expect(deviceKey('')).toBeNull()
    expect(deviceKey(null)).toBeNull()
    expect(deviceKey('curl/8.5.0')).toBeNull()
    expect(deviceLabel(null)).toBe('Thiết bị không xác định')
  })
})

describe('quyết định cảnh báo đăng nhập', () => {
  const cur = { ip: '1.2.3.4', country: 'VN', userAgent: UA_CHROME_WIN }

  it('trùng đúng IP ⇒ quen, dù trình duyệt khác', () => {
    expect(
      matchesKnownDevice({ ip: '1.2.3.4', country: 'VN', userAgent: UA_SAFARI_IOS }, cur)
    ).toBe(true)
  })

  it('IP đổi nhưng cùng máy cùng nước ⇒ quen (đây là mạng di động)', () => {
    // Chính ca này là lý do đợt sửa tồn tại: bản cũ so đúng IP nên mỗi lần 4G
    // cấp IP mới là một thư cảnh báo.
    const past = [{ ip: '5.6.7.8', country: 'VN', userAgent: UA_CHROME_WIN_MOI }]
    expect(shouldAlertNewDevice(past, cur)).toBe(false)
  })

  it('cùng dòng trình duyệt nhưng KHÁC quốc gia ⇒ vẫn cảnh báo', () => {
    // Bỏ điều kiện quốc gia thì kẻ chiếm tài khoản chỉ cần dùng Chrome/Windows -
    // tổ hợp phổ biến nhất thế giới - là đi qua trong im lặng.
    const past = [{ ip: '5.6.7.8', country: 'VN', userAgent: UA_CHROME_WIN }]
    expect(shouldAlertNewDevice(past, { ...cur, country: 'RU' })).toBe(true)
  })

  it('thiết bị khác hẳn ⇒ cảnh báo', () => {
    const past = [{ ip: '5.6.7.8', country: 'VN', userAgent: UA_SAFARI_IOS }]
    expect(shouldAlertNewDevice(past, cur)).toBe(true)
  })

  it('lượt đăng nhập ĐẦU TIÊN không cảnh báo', () => {
    expect(shouldAlertNewDevice([], cur)).toBe(false)
  })

  it('không có tín hiệu nào ⇒ không đoán bừa', () => {
    const past = [{ ip: '5.6.7.8', country: 'VN', userAgent: UA_SAFARI_IOS }]
    expect(shouldAlertNewDevice(past, { ip: null, country: null, userAgent: null })).toBe(false)
  })

  it('UA không đọc được ở hai bên KHÔNG tự khớp nhau', () => {
    // `null` nghĩa là "không biết". Cho hai cái "không biết" khớp nhau là mở một
    // cửa im lặng cho mọi client không gửi UA.
    const past = [{ ip: '5.6.7.8', country: 'VN', userAgent: 'curl/8.5.0' }]
    expect(
      shouldAlertNewDevice(past, { ip: '9.9.9.9', country: 'VN', userAgent: 'wget/1.21' })
    ).toBe(true)
  })
})
