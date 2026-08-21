import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

/**
 * Đưa mọi truy cập dev về ĐÚNG MỘT host chuẩn.
 *
 * Vì sao cần: cookie phiên được phát kèm `Domain=.tsudev.localhost` (xem
 * `NEXTAUTH_COOKIE_DOMAIN`). Vào thẳng cổng nội bộ của Next thì
 * đăng nhập vẫn trả **HTTP 200** - mật khẩu được kiểm đúng, token được ký -
 * nhưng trình duyệt VỨT cookie đi vì host không khớp domain. Kết quả: phiên
 * không tồn tại, giao diện vẫn hiện nút "Đăng nhập", và **không có gì báo lỗi**.
 * Đó là dạng hỏng tệ nhất: thành công giả.
 *
 * Điều kiện kích hoạt được chọn để tự đúng, không phải để cấu hình thêm:
 * chuyển hướng chỉ xảy ra khi cookie BỊ giới hạn theo domain mà host hiện tại
 * lại nằm ngoài domain đó - tức đúng lúc và chỉ lúc cookie sẽ bị vứt.
 *
 * Hệ quả: `DEV_PROXY=0` (đường lui gõ thẳng cổng từng app) vẫn chạy nguyên vẹn,
 * vì lúc đó `NEXTAUTH_COOKIE_DOMAIN` rỗng nên không có gì để chuyển hướng.
 */

// ---------------------------------------------------------------------------
// CSP ép thật (không Report-Only), chỉ ở PRODUCTION. Kết hợp BĂM + NONCE.
//
// Vì sao cả hai:
//   - THEME_SCRIPT (inline, nội dung CỐ ĐỊNH) → phủ bằng BĂM. Băm đúng trên cả
//     trang prerender TĨNH (nonce thì không: HTML tĩnh sinh lúc build không mang
//     được nonce của lượt tải - đã đo, đã trả giá).
//   - Script JSD của Cloudflare Bot Fight Mode (`window.__CF$cv$params...` nạp
//     `/cdn-cgi/challenge-platform/scripts/jsd/main.js`) chèn ở TẦNG EDGE với
//     tham số ĐỔI MỖI REQUEST → không băm được. Cloudflare ĐỌC nonce từ CSP
//     RESPONSE header và tự gắn vào script nó chèn (chỉ khi nonce ở HTTP header,
//     không phải <meta>) - nên ta phát nonce mỗi request, CF lo phần còn lại.
//
// Vì sao KHÔNG cần luồn nonce vào _document/NextScript như bản nonce trước: script
// của Next là `<script src>` cùng origin (`'self'` cho qua), THEME_SCRIPT dùng băm,
// nên KHÔNG script nào của TA cần nonce. Nonce ở đây CHỈ để CF dùng. Vì thế cũng
// không đụng tới prerender tĩnh.
//
// `THEME_SCRIPT_HASH` hard-code ở đây vì middleware chạy runtime Edge - không có
// `fs` để đọc `_document.tsx`. `test/csp.test.ts` tính lại băm TỪ NGUỒN và bắt
// lệch (giống cách themeTokens.test.ts canh màu chép ra ngoài).
// ---------------------------------------------------------------------------
const THEME_SCRIPT_HASH = 'sha256-y2cjXwyx3qug97W9KR87Hjt5uyWkYosWfN0VgZ7ZdXg=';
const CF_INSIGHTS = 'https://static.cloudflareinsights.com';

function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' '${THEME_SCRIPT_HASH}' 'nonce-${nonce}' ${CF_INSIGHTS}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Gắn CSP (băm + nonce mỗi request) lên một phản hồi pass-through. */
function withCsp(res: NextResponse): NextResponse {
  res.headers.set('content-security-policy', buildCsp(newNonce()));
  return res;
}

/**
 * Production: MỘT địa chỉ duy nhất là chính tắc, mọi bí danh chuyển hướng về đó.
 *
 * Vì sao cần, khi thẻ `<link rel="canonical">` đã trỏ về apex: thẻ canonical là
 * một GỢI Ý cho công cụ tìm kiếm, không phải một quy tắc cho trình duyệt. Trước
 * đây `www.tsudev.com` và `tsudev.com` cùng trả 200 với nội dung y hệt, nên:
 *
 *   - người dùng ở lại `www.` suốt phiên, và mọi liên kết họ chia sẻ mang một
 *     tên miền thứ hai - đúng thứ "thống nhất URL" sinh ra để dẹp;
 *   - `NEXTAUTH_URL` chỉ khai apex, nên đường quay lại sau đăng nhập nhảy host
 *     giữa chừng;
 *   - hai host là hai bản sao nội dung, và gợi ý canonical chỉ giảm nhẹ chứ
 *     không xoá được chuyện đó.
 *
 * 308 chứ không phải 302: vĩnh viễn (công cụ tìm kiếm chuyển hẳn chỉ mục) và
 * GIỮ NGUYÊN method + body, nên một POST gõ nhầm host không biến thành GET rồi
 * mất dữ liệu.
 *
 * Bản xem trước `*.workers.dev` KHÔNG bị chuyển hướng - nó phải mở được thì mới
 * nghiệm thu được. Nhưng nó vẫn là một bản sao của toàn site, nên gắn
 * `X-Robots-Tag: noindex` để bản nháp không đi tranh chỉ mục với bản thật.
 */
function canonicalHost(req: NextRequest): NextResponse {
  const canonical = process.env.NEXTAUTH_URL;
  if (!canonical) return withCsp(NextResponse.next());

  const bare = new URL(canonical).hostname.toLowerCase();
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const host = (rawHost.split(':')[0] ?? '').toLowerCase();
  if (!host || host === bare) return withCsp(NextResponse.next());

  // Bí danh TRONG cùng tên miền (www.tsudev.com) ⇒ gộp về host chính tắc.
  // Redirect KHÔNG cần CSP (không dựng HTML/script nào).
  if (host.endsWith(`.${bare}`)) {
    return NextResponse.redirect(
      new URL(req.nextUrl.pathname + req.nextUrl.search, canonical),
      308
    );
  }

  // Host lạ (bản xem trước): phục vụ bình thường, nhưng không cho lập chỉ mục.
  const res = withCsp(NextResponse.next());
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return canonicalHost(req);

  // Dev: KHÔNG ép CSP (HMR cần eval + script nội tuyến). Chỉ lo chuyện cookie
  // domain như cũ.
  const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN;
  const canonical = process.env.NEXTAUTH_URL;
  if (!cookieDomain || !canonical) return NextResponse.next();

  const bare = cookieDomain.replace(/^\./, '');
  // Phải đọc từ header, KHÔNG dùng `req.nextUrl.hostname`: sau dev-proxy thì
  // nextUrl mang host nội bộ mà Next đang bind (127.0.0.1), nên so bằng nó sẽ
  // chuyển hướng chính host chuẩn - tức là tự tạo vòng lặp.
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const host = (rawHost.split(':')[0] ?? '').toLowerCase();
  if (!host || host === bare || host.endsWith(`.${bare}`)) return NextResponse.next();

  // CHỈ chuyển hướng điều hướng của TRÌNH DUYỆT. Vấn đề cookie chỉ tồn tại ở
  // trình duyệt; máy móc gọi vào không có cookie để mà mất.
  //
  // Đây không phải tinh chỉnh cho đẹp: bản đầu chuyển hướng mọi thứ, và nó làm
  // CI ĐỎ - Playwright dò server sẵn sàng bằng một GET trần tới cổng nội bộ của
  // Next, nhận 307, coi như chưa sẵn sàng, rồi
  // `Timed out waiting 120000ms from config.webServer`.
  const accept = req.headers.get('accept') || '';
  const isNavigation =
    req.headers.get('sec-fetch-mode') === 'navigate' || accept.includes('text/html');
  if (!isNavigation) return NextResponse.next();

  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical);
  // 307 giữ nguyên method và body: POST đăng nhập gõ nhầm host không bị biến
  // thành GET rồi mất dữ liệu.
  return NextResponse.redirect(target, 307);
}

export const config = {
  // Bỏ qua tài nguyên nội bộ của Next: chúng được nạp bằng đường dẫn tương đối
  // nên đã đúng host sẵn, chuyển hướng chỉ tốn thêm một vòng. CSP không cần cho
  // asset tĩnh (không có script nội tuyến).
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
