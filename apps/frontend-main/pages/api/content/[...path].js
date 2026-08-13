// Proxy tới content-service. Chỉ phục vụ ĐƯỜNG GHI của trang quản trị dự án:
// phần đọc công khai (/api/projects, /api/posts, /api/docs) đi thẳng qua SSR
// trong lib/api.js và không cần đường này.
//
// Vì sao vẫn phải có proxy: trình duyệt KHÔNG được gọi thẳng cổng 4001 (CORS
// chặn, và cổng service không lộ ra ngoài ở production). Danh tính người dùng
// được lấy từ phiên next-auth rồi tiêm vào header cho service — trình duyệt
// không tự khai được vai trò của mình.
import { getToken } from 'next-auth/jwt';

import { CONTENT, internalHeaders } from '../../../lib/services';

// Danh sách trắng, không phải danh sách đen: thêm nhánh mới phải khai ở đây.
// Bỏ sót một nhánh thì nó 404 — an toàn hơn là lỡ mở cả /api.
const ALLOWED_PREFIXES = new Set(['admin']);

export default async function handler(req, res) {
  const parts = req.query.path || [];
  if (!parts.length || !ALLOWED_PREFIXES.has(parts[0])) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const username =
    (token.name || token.email || token.sub || 'member')
      .toString()
      .split('@')[0]
      .replace(/[^a-zA-Z0-9._-]/g, '') || 'member';

  const headers = {
    ...internalHeaders(),
    'x-dev-user': username,
    'x-dev-roles': token.role || 'member',
    'Content-Type': 'application/json',
  };

  const path = parts.join('/');
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

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
