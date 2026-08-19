// Proxy CÓ PHIÊN tới newsroom-service - bảng điều khiển Toà soạn Agent AI.
//
// Theo khuôn pages/api/account/[...path].ts (đòi phiên + ký khẳng định danh
// tính), KHÔNG theo khuôn pages/api/identity/[...path].ts (proxy công khai cho
// người chưa đăng nhập). Đặt nhầm khuôn ở đây là mở toàn bộ bảng điều khiển
// vận hành ra internet.
//
// Vai trò được kiểm ở newsroom-service bằng requireRole('ADMIN'), đọc User.role
// TỪ DB. Lớp này chỉ chứng minh "có phiên"; nó KHÔNG tự quyết định vai trò -
// trình duyệt không bao giờ được tự khai vai trò của mình.
//
// `/api/newsroom/tick` CỐ Ý không có ở đây: nhịp đập là máy gọi máy, đi thẳng
// từ Worker cron tới backend bằng NEWSROOM_TICK_TOKEN. Mở nó qua proxy trình
// duyệt là cho bất kỳ ai đã đăng nhập ép toà soạn đốt hạn mức Neuron.
import type { NextApiRequest, NextApiResponse } from 'next';

import { NEWSROOM, internalHeaders } from '../../../lib/services';
import { catchAllSegments, identityHeaders } from '../../../lib/identity';
import { readSessionToken } from '../../../lib/sessionCookie';

// Danh sách TRẮNG theo tiền tố, không phải danh sách đen: nhánh chưa khai thì
// 404. Bỏ sót một nhánh là nó không chạy - an toàn hơn lỡ mở cả /api.
const ALLOWED_PREFIXES = ['state', 'admin'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = catchAllSegments(req.query.path);
  const head = parts[0];
  if (!head || !ALLOWED_PREFIXES.includes(head)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const token = await readSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH'].includes(method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue;
    if (typeof v === 'string') qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs}` : '';

  try {
    const upstream = await fetch(`${NEWSROOM}/api/newsroom/${parts.join('/')}${suffix}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders(),
        ...(await identityHeaders(token)),
      },
      body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được toà soạn' });
  }
}
