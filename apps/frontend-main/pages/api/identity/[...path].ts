// Proxy CÔNG KHAI tới auth-service.
//
// Khác ba proxy kia: những endpoint dưới đây phục vụ người CHƯA đăng nhập -
// đăng ký, quên mật khẩu, xác minh email. Chúng không mang khẳng định danh tính
// nào, vì chưa có danh tính nào để mang.
//
// Điều đó khiến chúng là mặt tiếp xúc lộ ra ngoài rộng nhất của hệ xác thực,
// nên: danh sách TRẮNG tường minh, chỉ POST, và chuyển tiếp IP thật xuống dưới
// để giới hạn tần suất của auth-service đếm đúng người gọi chứ không phải đếm
// tiến trình Next.
import type { NextApiRequest, NextApiResponse } from 'next';

import { IDENTITY, internalHeaders } from '../../../lib/services';
import { catchAllSegments } from '../../../lib/identity';

/**
 * Danh sách trắng, không phải danh sách đen. Thêm endpoint mới phải khai ở đây;
 * bỏ sót thì nó 404 - an toàn hơn là lỡ mở cả `/api/identity`, nơi có cả
 * `verify-credentials` (thứ chỉ NextAuth phía server được gọi).
 */
const ALLOWED = new Set([
  'register',
  'verify-email',
  // Xác nhận đổi email: công khai vì người bấm liên kết trong thư có thể chưa
  // đăng nhập (hoặc phiên cũ vừa bị đá ra do sessionVersion tăng). Token trong
  // liên kết là bằng chứng, không cần phiên.
  'confirm-email-change',
  'request-password-reset',
  'reset-password',
  // Hai bước đăng nhập bằng passkey. Công khai vì người gọi CHƯA có danh tính -
  // đó chính là thứ họ đang cố chứng minh.
  //
  // `passkey/register-*` CỐ Ý KHÔNG có ở đây: đăng ký khoá mới đòi đã đăng
  // nhập, nên nó đi qua proxy có phiên (pages/api/account/[...path].ts).
  'passkey/login-options',
  'passkey/login-verify',
]);

/**
 * Header mô tả NGƯỜI GỌI THẬT: IP để auth-service đếm giới hạn tần suất theo
 * đúng trục, và quốc gia (`cf-ipcountry`, do Cloudflare đặt ở tầng biên) để nó
 * ghi được dấu vết đăng nhập. Đường passkey đi qua đây, nên thiếu chỗ này là
 * đăng nhập bằng passkey mất quốc gia trong khi mật khẩu và OAuth thì có.
 */
function callerHeaders(req: NextApiRequest): Record<string, string> {
  const raw = req.headers['x-forwarded-for'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const ip = (first?.split(',')[0]?.trim() || req.socket?.remoteAddress || '').slice(0, 45);
  const cc = req.headers['cf-ipcountry'];
  const country = (Array.isArray(cc) ? cc[0] : cc)?.trim() || '';
  return {
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(country ? { 'cf-ipcountry': country } : {}),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
  }

  const parts = catchAllSegments(req.query.path);
  // So khớp TOÀN BỘ đường dẫn, không chỉ đoạn đầu: cho phép 'passkey' rồi ghép
  // lại sẽ mở luôn 'passkey/register-verify', thứ phải đòi đăng nhập.
  const action = parts.join('/');
  if (parts.length > 2 || !ALLOWED.has(action)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const fwd = callerHeaders(req);
  try {
    const upstream = await fetch(`${IDENTITY}/api/identity/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders(),
        ...fwd,
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được dịch vụ xác thực' });
  }
}
