// Proxy tới trust-service. Sau đợt "chế độ mời"
// (docs/refactor-trust-invite-access.md, Phần A) đường này KHÔNG còn nhánh công
// khai nào: mọi tiền tố đều đòi phiên next-auth, và trust-service còn đòi thêm
// vai trò VIP đọc từ DB.
//
// Trước đây `programs`, `verify`, `directory`, `seal`, `profile` mở cho khách vì
// huy hiệu do trình duyệt của người xem site BÊN THỨ BA tải về. Quyết định 1 của
// kế hoạch bỏ hình đó: con dấu chỉ nhìn thấy được qua mã mời, không ngoại lệ cho
// trang xác minh. Cái giá bằng không - lúc quyết định có 0 chứng chỉ đang chạy.
//
// Danh sách dưới đây là MẶC ĐỊNH ĐÓNG: tiền tố lạ nhận 404 chứ không đi tiếp.

import type { NextApiRequest, NextApiResponse } from 'next';

import { TRUST } from '../../../lib/services';
import { catchAllSegments, identityHeaders, queryStringOf } from '../../../lib/identity';
import { readSessionToken } from '../../../lib/sessionCookie';

const ALLOWED_PREFIXES = new Set([
  'programs',
  'verify',
  'directory',
  'seal',
  'profile',
  'orgs',
  'domains',
  'applications',
  'certificates',
  'admin',
]);

/**
 * Nhánh CHỈ ĐỌC. Giữ lại sau khi mọi thứ thành riêng tư vì nó không phải cổng
 * đăng nhập mà là ràng buộc hình dạng API: không route nào dưới năm tiền tố này
 * nhận đường ghi, nên một `POST` lọt tới đây là dấu hiệu gọi nhầm.
 */
const READ_ONLY_PREFIXES = new Set(['programs', 'verify', 'directory', 'seal', 'profile']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = catchAllSegments(req.query.path);
  const head = parts[0] ?? '';
  if (!parts.length || !ALLOWED_PREFIXES.has(head)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }
  if (READ_ONLY_PREFIXES.has(head) && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ GET' });
  }

  // Không còn nhánh nào đi tiếp mà thiếu danh tính. Việc chuyển tiếp
  // Referer/Origin cho cơ chế phát hiện huy hiệu gắn sai tên miền đã được GỠ ở
  // đợt này: chỉ người đã đăng nhập mới tải được huy hiệu, nên nó không còn
  // ràng buộc được gì - để lại là để một lớp phòng thủ giả nằm trong mã.
  const token = await readSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });
  const headers: Record<string, string> = {
    ...(await identityHeaders(token)),
    'Content-Type': 'application/json',
  };

  const path = parts.join('/');
  const qs = queryStringOf(req.url);

  try {
    const upstream = await fetch(`${TRUST}/api/trust/${path}${qs}`, {
      method: req.method,
      headers,
      body:
        req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });

    const type = upstream.headers.get('content-type') || 'application/octet-stream';
    for (const h of ['cache-control', 'x-trust-seal-status']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('Content-Type', type);

    if (type.includes('application/json')) {
      const data = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json(data);
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được trust-service' });
  }
}
