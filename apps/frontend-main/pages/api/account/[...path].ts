// Proxy CÓ PHIÊN tới auth-service - quản lý bảo mật của chính tài khoản mình.
//
// Tách khỏi pages/api/identity/[...path].ts một cách CÓ CHỦ ĐÍCH: hai tệp, hai
// mức bảo vệ. Tệp kia phục vụ người chưa đăng nhập (đăng ký, quên mật khẩu);
// tệp này đòi phiên hợp lệ và ký khẳng định danh tính gửi xuống.
//
// Gộp chung rồi rẽ nhánh bên trong là cách để một ngày nào đó thêm nhầm một
// route vào nhánh sai - và không có gì báo lỗi.
import { getToken } from 'next-auth/jwt';
import type { NextApiRequest, NextApiResponse } from 'next';

import { IDENTITY, internalHeaders } from '../../../lib/services';
import { catchAllSegments, identityHeaders } from '../../../lib/identity';

const ALLOWED = new Set([
  'totp/setup',
  'totp/confirm',
  'totp/disable',
  'passkey/register-options',
  'passkey/register-verify',
  'passkey/list',
  'passkey/delete',
  // Mã mời vào Con dấu. `invite/redeem` là của người dùng thường; ba cái còn
  // lại tự kiểm ADMIN ở auth-service (đọc User.role từ DB, không từ claim).
  'invite/redeem',
  'invite/create',
  'invite/list',
  'invite/revoke',
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
  }

  const parts = catchAllSegments(req.query.path);
  const action = parts.join('/');
  if (parts.length > 2 || !ALLOWED.has(action)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  try {
    const upstream = await fetch(`${IDENTITY}/api/identity/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders(),
        ...(await identityHeaders(token)),
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được dịch vụ xác thực' });
  }
}
