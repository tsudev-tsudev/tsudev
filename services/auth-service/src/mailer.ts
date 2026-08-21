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

export type MailResult = { ok: true } | { ok: false; reason: string }

const from = () => process.env.MAIL_FROM || 'tsudev <no-reply@tsudev.com>'

/**
 * Gửi mail. KHÔNG ném lỗi.
 *
 * Người gọi nằm giữa luồng đăng ký và quên mật khẩu; một lỗi mạng ở đây không
 * được phép làm hỏng thao tác đã ghi vào DB. Trả về kết quả để người gọi ghi
 * log, còn phản hồi cho người dùng thì GIỐNG NHAU dù gửi được hay không -
 * "nếu địa chỉ này tồn tại, chúng tôi đã gửi thư".
 */
export async function sendMail(to: string, subject: string, html: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Không cấu hình = no-op ồn ào ở log, không phải lỗi. Local dev và CI không
    // có khoá, và chúng cũng không nên gửi thư thật cho ai.
    console.warn(`[auth] RESEND_API_KEY chưa đặt - bỏ qua mail "${subject}" gửi tới ${to}`)
    return { ok: false, reason: 'not_configured' }
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from(), to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[auth] Resend trả ${res.status}: ${body.slice(0, 300)}`)
      return { ok: false, reason: `http_${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    console.error('[auth] gửi mail hỏng:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'network' }
  }
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
