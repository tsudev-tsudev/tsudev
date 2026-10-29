import type { NextApiRequest, NextApiResponse } from 'next';

import { CONTENT, internalHeaders } from '../../../../lib/services';

/**
 * Đường TẢI VỀ của một bản phát hành, dành cho trình duyệt.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MỘT CHẶNG Ở GIỮA THAY VÌ ĐƯA URL R2 RA THẲNG TRANG
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Ba lý do, cả ba đều thật:
 *
 *   1. BỘ ĐẾM sống ở content-service. Một thẻ `<a href="https://...r2.../app.apk">`
 *      thì `downloadCount` đứng yên mãi mãi - và con số 0 trông giống hệt "chưa
 *      ai tải", nên không ai phát hiện ra là bộ đếm đã chết.
 *   2. Trình duyệt KHÔNG được gọi thẳng cổng service (CORS chặn, và ở production
 *      cổng service không lộ ra ngoài).
 *   3. URL công khai của bucket đổi theo môi trường. Nhúng nó vào HTML là nhúng
 *      cấu hình môi trường vào trang - và đó đúng là lớp bẫy mà
 *      `S3_PUBLIC_ENDPOINT` ở dev/prod đã ghi trong CLAUDE.md.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * KHÁC `pages/api/content/[...path].ts` Ở HAI ĐIỂM, CẢ HAI ĐỀU CÓ CHỦ ĐÍCH
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   · KHÔNG đòi đăng nhập. Tệp phát hành là nội dung công khai; proxy content
 *     chỉ phục vụ đường GHI của trang quản trị nên nó mới chặn 401.
 *   · KHÔNG gửi khẳng định danh tính. Một đường tải ẩn danh không được phép mang
 *     theo danh tính của ai cả - cùng lý do `lib/api.ts` không gửi.
 *
 * Chỉ `internalHeaders()` được trải vào, vì `INTERNAL_API_TOKEN` gác `/api` của
 * content-service khi nó được đặt.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Chỉ GET. Một đường tải nhận được POST là dấu hiệu có người đang thử dùng nó
  // làm đường ghi.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Chỉ nhận GET' });
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!slug || !id) return res.status(400).json({ error: 'Thiếu slug hoặc id' });

  const url = `${CONTENT}/api/projects/${encodeURIComponent(slug)}/releases/${encodeURIComponent(
    id
  )}/download`;

  try {
    // `redirect: 'manual'` là mấu chốt. Mặc định `fetch` tự đi theo 302, nên
    // Worker sẽ TẢI CẢ TỆP về rồi mới trả cho trình duyệt - tức toàn bộ tệp
    // phát hành đi qua tầng biên, ăn CPU và băng thông của Worker cho một việc
    // mà một mã 302 làm xong.
    const upstream = await fetch(url, {
      method: 'GET',
      headers: internalHeaders(),
      redirect: 'manual',
    });

    const dich = upstream.headers.get('location');
    if (upstream.status >= 300 && upstream.status < 400 && dich) {
      // 302 chứ không 301 - xem lý do ở content-service.
      res.setHeader('Location', dich);
      return res.status(302).end();
    }

    // Không phải chuyển hướng: chuyển nguyên văn lỗi của upstream. Đừng dịch
    // 404 thành một trang trống - người bấm nút tải cần biết là bản đó không
    // còn, không phải đoán.
    const than = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(than);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được máy chủ nội dung' });
  }
}
