// Proxy tới trust-service. Một đường duy nhất /api/trust/* phục vụ hai loại:
//
//   CÔNG KHAI  programs, verify, directory, seal
//              Không yêu cầu đăng nhập — huy hiệu do trình duyệt của khách trên
//              site BÊN THỨ BA tải về, không hề có phiên nào. Trang xác thực
//              cũng phải mở cho bất kỳ ai kiểm chứng.
//
//   RIÊNG      orgs, domains, applications, certificates, admin
//              Bắt buộc có phiên next-auth; danh tính được tiêm vào header cho
//              service, trình duyệt không bao giờ nói chuyện trực tiếp với 4003.
//
// Gộp vào một đường để mã nhúng của khách trỏ vào MỘT domain duy nhất — hạ tầng
// bên trong đổi thì khách không phải sửa gì.
import { getToken } from 'next-auth/jwt';

import type { NextApiRequest, NextApiResponse } from 'next';

import { TRUST } from '../../../lib/services';
import {
  catchAllSegments,
  queryStringOf,
  roleFromToken,
  usernameFromToken,
} from '../../../lib/identity';

const PUBLIC_PREFIXES = new Set(['programs', 'verify', 'directory', 'seal', 'profile']);
const PRIVATE_PREFIXES = new Set(['orgs', 'domains', 'applications', 'certificates', 'admin']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parts = catchAllSegments(req.query.path);
  const head = parts[0] ?? '';
  const isPublic = PUBLIC_PREFIXES.has(head);
  const isPrivate = PRIVATE_PREFIXES.has(head);
  if (!parts.length || (!isPublic && !isPrivate)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }
  if (isPublic && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ GET' });
  }

  const headers: Record<string, string> = {};
  if (isPrivate) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });
    const username = usernameFromToken(token);
    headers['x-dev-user'] = username;
    headers['x-dev-roles'] = roleFromToken(token);
    headers['Content-Type'] = 'application/json';
  } else {
    // Chuyển tiếp Referer/Origin nguyên vẹn — trust-service dựa vào đó để phát
    // hiện huy hiệu bị gắn sai tên miền. Mất header này là mất luôn ràng buộc.
    if (req.headers.referer) headers['referer'] = req.headers.referer;
    if (req.headers.origin) headers['origin'] = req.headers.origin;
  }

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
