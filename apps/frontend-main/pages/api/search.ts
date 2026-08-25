// Proxy CÔNG KHAI cho tìm kiếm bài viết (SEARCH_AND_FILTER §7). Ô tìm kiếm là
// tương tác (gõ + debounce) nên phải gọi từ trình duyệt - mà trình duyệt không
// gọi thẳng cổng content-service được (CORS + cổng nội bộ). Đường này chỉ CHUYỂN
// TIẾP các tham số tìm kiếm đã lọc trắng; KHÔNG mang danh tính (tìm kiếm là công
// khai, và content-service `optionalAuth` bỏ qua khi không có Authorization).
//
// KHÔNG nhận `status` hay tham số nhạy cảm nào: endpoint search của backend chỉ
// trả bài đã công bố + tới giờ, nên không có bề mặt lộ bản nháp qua URL.

import type { NextApiRequest, NextApiResponse } from 'next';

import { CONTENT, internalHeaders } from '../../lib/services';

// `type` và `category` là hai trục lọc thêm từ DOCS-SEARCH. Vẫn KHÔNG nhận
// `status` hay tham số nhạy cảm nào - xem chú thích đầu file.
const PASS = ['q', 'type', 'tag', 'category', 'sort', 'page', 'page_size'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Chỉ hỗ trợ GET' });

  const qs = new URLSearchParams();
  for (const key of PASS) {
    const v = req.query[key];
    if (typeof v === 'string' && v !== '') qs.set(key, v);
  }

  try {
    const upstream = await fetch(`${CONTENT}/api/posts/search?${qs.toString()}`, {
      headers: internalHeaders(),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được content-service' });
  }
}
