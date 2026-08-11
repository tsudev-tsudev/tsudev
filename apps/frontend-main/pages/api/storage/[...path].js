// BFF cho storage-service. Trước giai đoạn 4, storage là service DUY NHẤT trình
// duyệt gọi thẳng cổng (:4002) — vi phạm quy tắc của repo và là lý do nó phải
// bật CORS mở toàn bộ. Route này đóng đường tắt đó lại: trình duyệt chỉ nói
// chuyện cùng origin, danh tính lấy từ phiên next-auth ở phía server.
//
//   GET  /api/storage/presign?fileName=…   → GET  {STORAGE}/api/presign?…
//   POST /api/storage/presign              → POST {STORAGE}/api/presign
//   POST /api/storage/upload?key=…         → POST {STORAGE}/api/upload?…
//   GET  /api/storage/files                → GET  {STORAGE}/api/files
import { getToken } from 'next-auth/jwt';

import { STORAGE, internalHeaders } from '../../../lib/services';

// Thân request đọc thành Buffer rồi mới chuyển tiếp, không stream: frontend-main
// chạy trên Cloudflare Workers ở production, nơi `http.request` của Node không
// dùng được và `fetch` streaming cần duplex nửa vời không phải runtime nào cũng
// có. Đánh đổi: tệp lớn nằm trọn trong bộ nhớ một lúc — vì vậy có MAX_BODY.
export const config = { api: { bodyParser: false } };

const MAX_BODY = Number(process.env.STORAGE_BFF_MAX_BYTES || 25 * 1024 * 1024);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Tệp quá lớn'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const username =
    (token.name || token.email || token.sub || 'member')
      .toString()
      .split('@')[0]
      .replace(/[^a-zA-Z0-9._-]/g, '') || 'member';

  const path = (req.query.path || []).join('/');
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await readBody(req);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }

  try {
    const upstream = await fetch(`${STORAGE}/api/${path}${qs}`, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/octet-stream',
        // storage-service đọc tên tệp từ header này ở nhánh upload phía server.
        ...(req.headers['x-filename'] ? { 'x-filename': req.headers['x-filename'] } : {}),
        ...internalHeaders(),
        'x-dev-user': username,
        'x-dev-roles': token.role || 'member',
      },
      body,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được storage-service' });
  }
}
