// BFF proxy for moderation: forwards GET/POST to content-service /api/mod/*,
// injecting the caller's identity from the next-auth session. content-service
// enforces the MODERATOR/ADMIN role from the resolved DB user.
import { getToken } from 'next-auth/jwt';

const CONTENT = process.env.CONTENT_SERVICE_URL || 'http://localhost:4001';

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
  try {
    const upstream = await fetch(`${CONTENT}/api/mod/${path}${qs}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-dev-user': username,
        'x-dev-roles': token.role || 'admin',
      },
      body:
        req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được content-service' });
  }
}
