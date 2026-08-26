// Proxy CÓ PHIÊN tới auth-service - quản lý bảo mật của chính tài khoản mình.
//
// Tách khỏi pages/api/identity/[...path].ts một cách CÓ CHỦ ĐÍCH: hai tệp, hai
// mức bảo vệ. Tệp kia phục vụ người chưa đăng nhập (đăng ký, quên mật khẩu);
// tệp này đòi phiên hợp lệ và ký khẳng định danh tính gửi xuống.
//
// Gộp chung rồi rẽ nhánh bên trong là cách để một ngày nào đó thêm nhầm một
// route vào nhánh sai - và không có gì báo lỗi.
import type { NextApiRequest, NextApiResponse } from 'next';

import { IDENTITY, internalHeaders } from '../../../lib/services';
import { catchAllSegments, identityHeaders } from '../../../lib/identity';
import { readSessionToken } from '../../../lib/sessionCookie';

const ALLOWED = new Set([
  // Hồ sơ của chính mình. `profile/get` là POST chứ không phải GET để đi chung
  // một khuôn với cả tệp này - proxy chỉ nhận POST, và mở thêm một phương thức
  // nữa ở đây là mở thêm một nhánh phải nhớ kiểm.
  'profile/get',
  'profile/update',
  'password/change',
  // Gửi lại email xác minh + yêu cầu đổi email (đòi mật khẩu). Xác nhận đổi email
  // đi qua proxy CÔNG KHAI (confirm-email-change) vì lúc bấm liên kết có thể chưa
  // đăng nhập.
  'verify/resend',
  // Xác minh bằng MÃ SỐ. Hai nhánh riêng vì chúng làm hai việc khác nhau và
  // chịu hai chính sách chặn khác nhau - gộp thành một endpoint thì chặn tần
  // suất gửi sẽ vô tình chặn luôn việc gõ mã, và người gõ sai một lần phải chờ
  // cả phút mới gõ lại được.
  'verify/code/send',
  'verify/code/confirm',
  'email/change',
  // Nhật ký bảo mật: của chính mình, và console OWNER xuyên tài khoản
  // (useradmin/security tự kiểm OWNER ở auth-service).
  'security/events',
  'security/revoke-all',
  'useradmin/security',
  // Vòng đời tài khoản tự phục vụ (đòi mật khẩu).
  'account/deactivate',
  'account/delete',
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
  // Quản lý tài khoản & phân quyền - auth-service tự kiểm OWNER (đọc User.role
  // từ DB, không từ claim). Tên hai đoạn vì proxy chặn path quá 2 đoạn.
  'useradmin/list',
  'useradmin/create',
  'useradmin/update',
  'useradmin/role',
  'useradmin/revoke',
  'useradmin/delete',
  // Bí danh thư nội bộ. Giữ tên HAI đoạn cho nhất quán với phần còn lại của
  // nhóm này; `useradmin/alias/create` từng 404 vì trần độ dài, và cái 404 đó
  // trông y hệt "chưa làm xong".
  'alias/list',
  'alias/create',
  'alias/delete',
  'alias/sync',
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
  }

  const parts = catchAllSegments(req.query.path);
  const action = parts.join('/');
  // Trần độ dài là lớp chặn THỨ HAI, sau danh sách trắng. Nó không thừa: nó
  // chặn mọi đường dẫn lạ TRƯỚC khi chuỗi được ghép, nên một lỗi ghép chuỗi ở
  // trên không biến thành đường đi tới nhánh sâu hơn của auth-service.
  // Nới từ 2 lên 3 cho `verify/code/{send,confirm}` (26/08/2026) - nới đúng một
  // nấc, không bỏ hẳn.
  if (parts.length > 3 || !ALLOWED.has(action)) {
    return res.status(404).json({ error: 'Không tìm thấy' });
  }

  const token = await readSessionToken(req);
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
