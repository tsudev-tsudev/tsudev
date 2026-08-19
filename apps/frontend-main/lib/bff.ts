// Factory for authenticated BFF proxies: forwards to content-service under a
// base path, injecting the caller identity from the next-auth session so the
// browser never talks to the service directly (no CORS, no token exposure).
import type { NextApiRequest, NextApiResponse } from 'next';

import { CONTENT, internalHeaders } from './services';
import { catchAllSegments, identityHeaders, queryStringOf } from './identity';
import { readSessionToken } from './sessionCookie';

export function makeAuthedProxy(base: string) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const token = await readSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập' });
    const path = catchAllSegments(req.query.path).join('/');
    const qs = queryStringOf(req.url);
    try {
      const upstream = await fetch(`${CONTENT}/api/${base}/${path}${qs}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...internalHeaders(),
          ...(await identityHeaders(token)),
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
