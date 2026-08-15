import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTVerifyOptions } from 'jose'
import { URL } from 'url'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

const ISSUER =
  process.env.KEYCLOAK_ISSUER || 'http://auth.tsudev.localhost:8080/realms/tsudev-local'
const AUDIENCE = process.env.KEYCLOAK_CLIENT_ID || undefined

const jwksUri = `${ISSUER}/protocol/openid-connect/certs`
const JWKS = createRemoteJWKSet(new URL(jwksUri))

// Header có thể tới dưới dạng mảng khi client gửi trùng tên. Gộp về một chuỗi
// ngay tại cửa vào thay vì để `string | string[]` lan xuống dưới.
const firstHeader = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  // Development bypass (local testing): set AUTH_DEV_BYPASS=true and provide
  // `x-dev-user` and optional `x-dev-roles` headers to simulate an authenticated user.
  if (process.env.AUTH_DEV_BYPASS === 'true') {
    try {
      const devUser = req.get('x-dev-user') || firstHeader(req.headers['x-dev-user'])
      const devRolesHeader = req.get('x-dev-roles') || firstHeader(req.headers['x-dev-roles'])
      const user = devUser || process.env.DEV_DEFAULT_USER || 'dev'
      const roles = (devRolesHeader || process.env.DEV_DEFAULT_ROLES || 'admin')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
      req.user = { sub: user, preferred_username: user, realm_access: { roles } }
      return next()
    } catch (e) {
      /* token hỏng — rơi xuống nhánh xác thực thật bên dưới */
    }
  }
  try {
    const authHeader = req.get('authorization') || firstHeader(req.headers.authorization)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }
    const token = authHeader.slice(7)
    // Khai kiểu ngay lúc dựng: gán `verifyOpts.audience` vào một object literal
    // chưa khai trường đó là lỗi biên dịch, và nó là trường quyết định token của
    // client khác có được nhận hay không.
    const verifyOpts: JWTVerifyOptions = { issuer: ISSUER }
    if (AUDIENCE) verifyOpts.audience = AUDIENCE

    const { payload } = await jwtVerify(token, JWKS, verifyOpts)

    req.user = payload as AuthenticatedUser
    return next()
  } catch (err) {
    try {
      console.error('[trust] auth middleware error', err instanceof Error ? err.stack : err)
    } catch (e) {
      /* console cũng hỏng thì cũng không làm gì hơn được */
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function hasRole(payload: AuthenticatedUser | undefined, role: string, clientId?: string): boolean {
  if (!payload) return false
  try {
    const realmRoles = Array.isArray(payload.realm_access?.roles) ? payload.realm_access.roles : []
    if (realmRoles.includes(role)) return true

    const clientRoles = clientId ? payload.resource_access?.[clientId]?.roles : undefined
    if (Array.isArray(clientRoles) && clientRoles.includes(role)) return true

    if (payload.scope && typeof payload.scope === 'string') {
      const scopes = payload.scope.split(/\s+/)
      if (scopes.includes(role)) return true
    }
  } catch (e) {
    // swallow and return false
  }
  return false
}

function requireRole(role: string): RequestHandler {
  if (process.env.REQUIRE_ROLE_ENFORCEMENT !== 'true') return (req, res, next) => next()
  return (req, res, next) => {
    try {
      const clientId = process.env.KEYCLOAK_CLIENT_ID
      const user = req.user
      if (!user) return res.status(401).json({ error: 'Missing authentication' })
      if (!hasRole(user, role, clientId)) return res.status(403).json({ error: 'Forbidden' })
      return next()
    } catch (e) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }
}

// `export =` chứ không phải `export default`: nơi gọi dùng
// `auth = require('./authMiddleware')` rồi vừa gọi `auth(req, res, next)` vừa đọc
// `auth.requireRole`. Object.assign giữ đúng hình dạng vừa-hàm-vừa-có-thuộc-tính đó.
export = Object.assign(authenticateJWT, { requireRole })
