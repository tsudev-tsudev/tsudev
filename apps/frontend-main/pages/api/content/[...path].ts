// Proxy tới content-service. Chỉ phục vụ ĐƯỜNG GHI của trang quản trị dự án:
// phần đọc công khai (/api/projects, /api/posts, /api/docs) đi thẳng qua SSR
// trong lib/api.js và không cần đường này.
//
// Vì sao vẫn phải có proxy: trình duyệt KHÔNG được gọi thẳng cổng 4001 (CORS
// chặn, và cổng service không lộ ra ngoài ở production). Danh tính người dùng
// được lấy từ phiên next-auth rồi tiêm vào header cho service - trình duyệt
// không tự khai được vai trò của mình.

import type { NextApiRequest, NextApiResponse } from 'next';

import { CONTENT, internalHeaders } from '../../../lib/services';
import { catchAllSegments, identityHeaders, queryStringOf } from '../../../lib/identity';
import { readSessionToken } from '../../../lib/sessionCookie';

// Danh sách trắng, không phải danh sách đen: thêm nhánh mới phải khai ở đây.
// Bỏ sót một nhánh thì nó 404 - an toàn hơn là lỡ mở cả /api.
const ALLOWED_PREFIXES = new Set(['admin', 'author']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = catchAllSegments(req.query.path);
  const head = parts[0];
  if (!head || !ALLOWED_PREFIXES.has(head)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const token = await readSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const headers: Record<string, string> = {
    ...internalHeaders(),
    ...(await identityHeaders(token)),
    'Content-Type': 'application/json',
  };

  const path = parts.join('/');
  const qs = queryStringOf(req.url);

  try {
    const upstream = await fetch(`${CONTENT}/api/${path}${qs}`, {
      method: req.method,
      headers,
      body:
        req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được content-service' });
  }
}
