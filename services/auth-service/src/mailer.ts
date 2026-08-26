/**
 * Gửi email giao dịch qua Resend.
 *
 * Gọi thẳng API HTTP, không dùng SDK: đây là một lệnh POST duy nhất, và mỗi phụ
 * thuộc thêm vào đường xác thực là một mặt tiếp xúc chuỗi cung ứng nữa.
 *
 * SMTP KHÔNG dùng được cho luồng này - `apps/frontend-main` chạy trên Cloudflare
 * Workers, nơi không mở được socket TCP tuỳ ý. Đó là lý do chọn một nhà cung cấp
 * có API HTTP chứ không phải sở thích.
 */

const API = 'https://api.resend.com/emails'

type Notifier = { alert: (payload: Record<string, unknown>) => Promise<void> }
let notify: Notifier = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}

export type MailResult = { ok: true } | { ok: false; reason: string }

// Cảnh báo "chưa cấu hình" chỉ phát MỘT lần cho mỗi tiến trình. Nó là tình trạng
// tĩnh chứ không phải sự cố lặp lại: bắn ở mỗi lá thư sẽ dội hàng trăm cảnh báo
// giống hệt nhau và chôn mất cảnh báo thật nằm giữa chúng.
let warnedMissingKey = false

/**
 * Đổi thân HTML thành bản chữ thuần.
 *
 * SINH RA từ chính HTML thay vì bắt mỗi khuôn thư viết hai bản: hai bản viết tay
 * sẽ lệch nhau, và bản lệch là bản không ai đọc lại - người sửa nội dung chỉ sửa
 * cái mình nhìn thấy.
 *
 * Vì sao cần bản chữ: thư chỉ-có-HTML bị nhiều bộ lọc chấm điểm rác cao hơn, và
 * trình đọc màn hình cùng đồng hồ thông minh hiển thị phần `text` chứ không phải
 * `html`. Địa chỉ liên kết được giữ lại trong ngoặc - bỏ đi thì bản chữ mất đúng
 * thứ mà thư xác minh tồn tại để mang.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label)
        .replace(/<[^>]+>/g, '')
        .trim()
      return text && text !== href ? `${text} (${href})` : String(href)
    })
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const from = () => process.env.MAIL_FROM || 'tsudev <no-reply@tsudev.com>'

/**
 * Gửi mail. KHÔNG ném lỗi.
 *
 * Người gọi nằm giữa luồng đăng ký và quên mật khẩu; một lỗi mạng ở đây không
 * được phép làm hỏng thao tác đã ghi vào DB. Trả về kết quả để người gọi ghi
 * log, còn phản hồi cho người dùng thì GIỐNG NHAU dù gửi được hay không -
 * "nếu địa chỉ này tồn tại, chúng tôi đã gửi thư".
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  kind = 'unknown'
): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Không cấu hình = no-op ồn ào ở log, không phải lỗi. Local dev và CI không
    // có khoá, và chúng cũng không nên gửi thư thật cho ai.
    console.warn(`[auth] RESEND_API_KEY chưa đặt - bỏ qua mail "${subject}" gửi tới ${to}`)
    if (!warnedMissingKey && process.env.NODE_ENV === 'production') {
      // Chỉ ồn ào ở production. Thiếu khoá ở đó nghĩa là MỌI thư giao dịch -
      // xác minh email, đặt lại mật khẩu, cảnh báo đăng nhập - đang biến mất
      // trong im lặng, và không người dùng nào báo được chuyện đó: họ chỉ thấy
      // "thư không tới", một triệu chứng trông y hệt thư vào hộp rác.
      warnedMissingKey = true
      void notify
        .alert({
          service: 'auth-service',
          level: 'error',
          message: 'RESEND_API_KEY chưa đặt - mọi thư giao dịch đang bị bỏ qua',
          context: `mail:${kind}`,
        })
        .catch(() => {})
    }
    return { ok: false, reason: 'not_configured' }
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // `text` đi kèm `html` chứ không thay thế: Resend gửi thư nhiều phần và
      // bên nhận tự chọn phần đọc được.
      body: JSON.stringify({ from: from(), to, subject, html, text: htmlToText(html) }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[auth] Resend trả ${res.status}: ${body.slice(0, 300)}`)
      void reportFailure(kind, subject, `http_${res.status}`, body.slice(0, 300))
      return { ok: false, reason: `http_${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[auth] gửi mail hỏng:', detail)
    void reportFailure(kind, subject, 'network', detail)
    return { ok: false, reason: 'network' }
  }
}

/**
 * Đẩy một lần gửi HỎNG ra kênh cảnh báo.
 *
 * KHÔNG kèm địa chỉ người nhận: cảnh báo đi tới Telegram và email vận hành, nên
 * đưa địa chỉ vào đó là mang dữ liệu cá nhân sang một hệ thống thứ ba chỉ để
 * chẩn đoán. `kind` đủ để biết đường nào hỏng, và log máy chủ giữ phần còn lại.
 */
async function reportFailure(
  kind: string,
  subject: string,
  reason: string,
  detail: string
): Promise<void> {
  await notify
    .alert({
      service: 'auth-service',
      level: 'error',
      message: `Gửi thư hỏng (${reason}): ${subject}`,
      context: `mail:${kind}`,
      error: detail,
    })
    .catch(() => {})
}

/**
 * Thoát HTML cho giá trị nhúng vào thân thư.
 *
 * Tên hiển thị do người dùng đặt và đi thẳng vào HTML. Không thoát ở đây thì
 * một cái tên chứa thẻ script trở thành XSS trong hộp thư của NGƯỜI KHÁC - một
 * vùng ta không kiểm soát và không vá được.
 */
export const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ((
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<
          string,
          string
        >
      )[c] as string)
  )

export function verifyEmailHtml(displayName: string, link: string): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>Xác minh địa chỉ email cho tài khoản tsudev của bạn:</p>
<p><a href="${esc(link)}">Xác minh email</a></p>
<p>Liên kết có hiệu lực trong 24 giờ. Nếu bạn không tạo tài khoản nào, hãy bỏ qua thư này.</p>`
}

/**
 * Thư mang MÃ SỐ để người dùng gõ lại ở /settings/profile.
 *
 * Cố ý KHÔNG kèm liên kết bấm-một-phát. Người nhận thư này vừa tự bấm nút trên
 * trang hồ sơ của họ, nên họ đang mở sẵn trang cần gõ mã; thêm một liên kết là
 * thêm một đường vào tài khoản nằm trong hộp thư, và đường nào cũng có thể bị
 * đọc lén. Mã gõ tay thì vô dụng với người không đang mở đúng trang đó.
 */
export function verifyCodeHtml(displayName: string, code: string, minutes: number): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>Mã xác minh tài khoản tsudev của bạn:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:0.18em;font-family:monospace">${esc(
    code
  )}</p>
<p>Nhập mã này ở trang Hồ sơ trong vòng ${minutes} phút. Mã chỉ dùng được một lần.</p>
<p>Nếu bạn không yêu cầu xác minh, hãy bỏ qua thư này - tài khoản không thay đổi gì. Không ai được hỏi bạn mã này; đừng chuyển nó cho bất kỳ ai.</p>`
}

export function resetPasswordHtml(displayName: string, link: string): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>Có yêu cầu đặt lại mật khẩu cho tài khoản tsudev của bạn:</p>
<p><a href="${esc(link)}">Đặt lại mật khẩu</a></p>
<p>Liên kết có hiệu lực trong 1 giờ và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua thư này - mật khẩu hiện tại không thay đổi.</p>`
}

/** Gửi tới địa chỉ MỚI - xác nhận quyền kiểm soát trước khi thay email. */
export function changeEmailHtml(displayName: string, newEmail: string, link: string): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>Có yêu cầu đổi email của tài khoản tsudev sang địa chỉ này (${esc(
    newEmail
  )}). Xác nhận để hoàn tất:</p>
<p><a href="${esc(link)}">Xác nhận đổi email</a></p>
<p>Liên kết có hiệu lực trong 1 giờ và chỉ dùng được một lần. Email của tài khoản chỉ đổi SAU khi bạn xác nhận qua liên kết này. Nếu bạn không yêu cầu, hãy bỏ qua thư này.</p>`
}

/** Gửi tới địa chỉ CŨ sau khi đổi thành công - để chủ tài khoản biết nếu bị chiếm. */
export function emailChangedNoticeHtml(displayName: string, newEmail: string): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>Email của tài khoản tsudev vừa được đổi sang <strong>${esc(
    newEmail
  )}</strong>. Mọi phiên đăng nhập cũ đã bị đăng xuất.</p>
<p>Nếu KHÔNG phải bạn thực hiện, hãy dùng chức năng quên mật khẩu để lấy lại quyền kiểm soát ngay và liên hệ quản trị.</p>`
}

/**
 * Thư cảnh báo một sự kiện bảo mật (đổi mật khẩu, tắt 2FA, đăng nhập thiết bị lạ...).
 *
 * Luôn kèm lời "nếu không phải bạn" với đường khôi phục: mục đích của thư này là
 * để chủ tài khoản THẬT phát hiện kẻ chiếm, nên nó phải nói rõ phải làm gì.
 * `context` là mô tả thiết bị/thời điểm nếu có.
 */
export function securityAlertHtml(displayName: string, title: string, context?: string): string {
  return `<p>Chào ${esc(displayName)},</p>
<p>${esc(title)} trên tài khoản tsudev của bạn.</p>
${context ? `<p style="color:#555">${esc(context)}</p>` : ''}
<p>Nếu KHÔNG phải bạn thực hiện, tài khoản của bạn có thể đã bị xâm nhập: hãy <a href="https://tsudev.com/forgot-password">đặt lại mật khẩu</a> ngay (thao tác này đăng xuất mọi thiết bị) và kiểm tra mục Bảo mật.</p>`
}
