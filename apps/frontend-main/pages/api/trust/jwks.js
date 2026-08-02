// Khoá công khai của cơ quan cấp dấu, phục vụ tại /.well-known/tsudev-trust-jwks.json
// (xem rewrite trong next.config.js). Công khai có chủ đích — đây chính là thứ
// cho phép bên thứ ba tự xác minh chữ ký mà không cần tin API của tsudev.
const TRUST = process.env.TRUST_SERVICE_URL || 'http://localhost:4003';

export default async function handler(req, res) {
  try {
    const upstream = await fetch(`${TRUST}/.well-known/tsudev-trust-jwks.json`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được trust-service' });
  }
}
