// Factory for authenticated BFF proxies: forwards to content-service under a
// base path, injecting the caller identity from the next-auth session so the
// browser never talks to the service directly (no CORS, no token exposure).
import { getToken } from 'next-auth/jwt';

import { CONTENT, internalHeaders } from './services';

export function makeAuthedProxy(base) {
  return async function handler(req, res) {
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
      const upstream = await fetch(`${CONTENT}/api/${base}/${path}${qs}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...internalHeaders(),
          'x-dev-user': username,
          'x-dev-roles': token.role || 'member',
        },
        body:
          req.method === 'GET' || req.method === 'HEAD'
            ? undefined
            : JSON.stringify(req.body || {}),
      });
      const data = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json(data);
    } catch (e) {
      return res.status(502).json({ error: 'Không kết nối được content-service' });
    }
  };
}
