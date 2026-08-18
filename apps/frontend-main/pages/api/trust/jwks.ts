// Khoá công khai của cơ quan cấp dấu, phục vụ tại /.well-known/tsudev-trust-jwks.json
// (xem rewrite trong next.config.js). Công khai có chủ đích - đây chính là thứ
// cho phép bên thứ ba tự xác minh chữ ký mà không cần tin API của tsudev.
import type { NextApiRequest, NextApiResponse } from 'next';

import { TRUST } from '../../../lib/services';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const upstream = await fetch(`${TRUST}/.well-known/tsudev-trust-jwks.json`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được trust-service' });
  }
}
