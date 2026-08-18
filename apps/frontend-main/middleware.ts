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
export function middleware(req: NextRequest) {
  // Production tự có tên miền thật và chỉ phục vụ host nằm trong domain cookie.
  // Bản xem trước (*.workers.dev) thì KHÔNG - nhưng chuyển hướng nó về production
  // là sai, nên ở đó ta để yên và không giả vờ sửa.
  if (process.env.NODE_ENV === 'production') return NextResponse.next();

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
  // nên đã đúng host sẵn, chuyển hướng chỉ tốn thêm một vòng.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
