// BFF cho storage-service. Trước giai đoạn 4, storage là service DUY NHẤT trình
// duyệt gọi thẳng cổng (:4002) - vi phạm quy tắc của repo và là lý do nó phải
// bật CORS mở toàn bộ. Route này đóng đường tắt đó lại: trình duyệt chỉ nói
// chuyện cùng origin, danh tính lấy từ phiên next-auth ở phía server.
//
//   GET  /api/storage/presign?fileName=…   → GET  {STORAGE}/api/presign?…
//   POST /api/storage/presign              → POST {STORAGE}/api/presign
//   POST /api/storage/upload?key=…         → POST {STORAGE}/api/upload?…
//   GET  /api/storage/files                → GET  {STORAGE}/api/files
import { getToken } from 'next-auth/jwt';

import type { NextApiRequest, NextApiResponse } from 'next';

import { STORAGE, internalHeaders } from '../../../lib/services';
import { catchAllSegments, identityHeaders, queryStringOf } from '../../../lib/identity';

/** Lỗi có mã HTTP đi kèm - readBody() ném ra khi thân request vượt MAX_BODY. */
type SizedError = Error & { status?: number };

// Thân request đọc thành Buffer rồi mới chuyển tiếp, không stream: frontend-main
// chạy trên Cloudflare Workers ở production, nơi `http.request` của Node không
// dùng được và `fetch` streaming cần duplex nửa vời không phải runtime nào cũng
// có. Đánh đổi: tệp lớn nằm trọn trong bộ nhớ một lúc - vì vậy có MAX_BODY.
export const config = { api: { bodyParser: false } };

const MAX_BODY = Number(process.env.STORAGE_BFF_MAX_BYTES || 25 * 1024 * 1024);

function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
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

/**
 * Header chuyển tiếp lên storage-service.
 *
 * `x-filename` có thể tới dưới dạng mảng khi client gửi trùng tên header; lấy
 * phần tử đầu thay vì để `string[]` rơi vào HeadersInit (nơi nó không hợp lệ).
 */
function buildHeaders(
  req: NextApiRequest,
  identity: Record<string, string>
): Record<string, string> {
  const rawName = req.headers['x-filename'];
  const fileName = Array.isArray(rawName) ? rawName[0] : rawName;
  return {
    'content-type': req.headers['content-type'] || 'application/octet-stream',
    // storage-service đọc tên tệp từ header này ở nhánh upload phía server.
    ...(fileName ? { 'x-filename': fileName } : {}),
    ...internalHeaders(),
    ...identity,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const path = catchAllSegments(req.query.path).join('/');
  const qs = queryStringOf(req.url);

  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await readBody(req);
    } catch (e) {
      const err = e as SizedError;
      return res.status(err.status || 400).json({ error: err.message });
    }
  }

  try {
    const upstream = await fetch(`${STORAGE}/api/${path}${qs}`, {
      method: req.method,
      headers: buildHeaders(req, await identityHeaders(token)),
      // Buffer là Uint8Array, hợp lệ với BodyInit lúc chạy; kiểu của fetch
      // trong lib DOM lại không liệt kê Buffer nên phải nói rõ ra.
      body: body as BodyInit | undefined,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được storage-service' });
  }
}
