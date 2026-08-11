// BFF proxy: forwards authenticated forum writes to content-service,
// injecting the caller's identity from the next-auth session (dev bypass header).
import { getToken } from 'next-auth/jwt';

import { CONTENT, internalHeaders } from '../../../lib/services';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });

  const username =
    (token.name || token.email || token.sub || 'member')
      .toString()
      .split('@')[0]
      .replace(/[^a-zA-Z0-9._-]/g, '') || 'member';

  const path = (req.query.path || []).join('/');
  try {
    const upstream = await fetch(`${CONTENT}/api/forum/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders(),
        'x-dev-user': username,
        'x-dev-roles': token.role || 'member',
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được content-service' });
  }
}
