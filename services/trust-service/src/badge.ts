'use strict'
/**
 * Render huy hiệu dạng SVG.
 *
 * Huy hiệu do tsudev phục vụ tại thời điểm request (không phải ảnh tĩnh khách
 * tự host) nên trạng thái luôn phản ánh thực tế: thu hồi một chứng chỉ là huy
 * hiệu trên site khách đổi ngay trong vòng một chu kỳ cache.
 *
 * Lưu ý về mức độ bảo đảm: không cơ chế nhúng nào ngăn được việc ai đó chụp ảnh
 * huy hiệu rồi tự host. Nguồn chân lý là trang xác thực mà huy hiệu trỏ tới —
 * đó mới là thứ chống giả mạo, không phải bản thân tấm ảnh.
 */

const PALETTE = {
  copyright: { accent: '#4c8bff', label: 'BẢN QUYỀN' },
  ownership: { accent: '#a78bfa', label: 'SỞ HỮU' },
  security: { accent: '#2bd0b8', label: 'BẢO MẬT' },
  privacy: { accent: '#38bdf8', label: 'DỮ LIỆU' },
  default: { accent: '#4c8bff', label: 'TÍN NHIỆM' },
}

type StateStyle = {
  fg: string
  sub: string
  mark: string
  /** Chỉ các trạng thái bất thường mới có; ACTIVE mượn accent của palette. */
  accent?: string
  note?: string
}

const STATE = {
  ACTIVE: { fg: '#ededed', sub: '#8a8a8a', mark: '✓' },
  SUSPENDED: { fg: '#e0a53a', sub: '#e0a53a', mark: '!', accent: '#e0a53a', note: 'TẠM ĐÌNH CHỈ' },
  REVOKED: { fg: '#ff6a6a', sub: '#ff6a6a', mark: '✕', accent: '#ff6a6a', note: 'ĐÃ THU HỒI' },
  EXPIRED: { fg: '#8a8a8a', sub: '#8a8a8a', mark: '−', accent: '#5a5a5a', note: 'HẾT HẠN' },
  UNKNOWN: { fg: '#ff6a6a', sub: '#ff6a6a', mark: '?', accent: '#ff6a6a', note: 'KHÔNG TỒN TẠI' },
  DOMAIN_MISMATCH: {
    fg: '#ff6a6a',
    sub: '#ff6a6a',
    mark: '✕',
    accent: '#ff6a6a',
    note: 'SAI TÊN MIỀN',
  },
}

const ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
}

// Huy hiệu là SVG nhúng được trên site của bên thứ ba, nên đây là ranh giới
// thoát ký tự thật sự — `?? c` giữ nguyên ký tự nếu bảng thiếu, thay vì chèn
// "undefined" vào giữa văn bản SVG.
const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ESCAPES[c] ?? c)

/**
 * @param {object} o
 * @param {string} o.state  khoá trong STATE
 * @param {string} [o.variant] badgeVariant của chương trình
 * @param {string} [o.programName]
 * @param {string} [o.serial]
 */
type BadgeState = keyof typeof STATE
type BadgeVariant = keyof typeof PALETTE

type RenderBadgeOptions = {
  /** khoá trong STATE */
  state?: string
  /** badgeVariant của chương trình */
  variant?: string
  programName?: string
  serial?: string
}

function renderBadge({
  state = 'ACTIVE',
  variant = 'default',
  programName = '',
  serial = '',
}: RenderBadgeOptions = {}) {
  // `state`/`variant` tới từ DB nên vẫn là string tự do; thu hẹp tại đây và rơi
  // về nhánh mặc định thay vì tin vào giá trị lưu trong bảng.
  const st: StateStyle = STATE[state as BadgeState] || STATE.UNKNOWN
  const pal = PALETTE[variant as BadgeVariant] || PALETTE.default
  const accent = st.accent || pal.accent
  const topLine = st.note || esc(programName || pal.label)
  const bottom = serial ? esc(serial) : 'tsudev.com/trust'
  const W = 188
  const H = 62

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Con dấu tín nhiệm tsudev — ${topLine}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#161616"/><stop offset="100%" stop-color="#0d0d0d"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="9" fill="url(#g)" stroke="#2e2e2e"/>
  <rect x="0.5" y="0.5" width="4" height="${H - 1}" rx="2" fill="${accent}"/>
  <circle cx="30" cy="31" r="13" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.9"/>
  <text x="30" y="36" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="14" font-weight="700" fill="${accent}" text-anchor="middle">${
    st.mark
  }</text>
  <text x="52" y="24" font-family="Inter,system-ui,sans-serif" font-size="11.5" font-weight="700" fill="${
    st.fg
  }">tsudev</text>
  <text x="52" y="38" font-family="Inter,system-ui,sans-serif" font-size="9.5" font-weight="600" fill="${accent}" letter-spacing="0.4">${topLine}</text>
  <text x="52" y="50" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="7.5" fill="${
    st.sub
  }">${bottom}</text>
</svg>`
}

export { renderBadge, PALETTE, STATE }
