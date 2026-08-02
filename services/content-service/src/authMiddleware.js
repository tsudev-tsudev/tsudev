const { createRemoteJWKSet, jwtVerify } = require('jose')
const { URL } = require('url')

const ISSUER = process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/tsudev-local'
const AUDIENCE = process.env.KEYCLOAK_CLIENT_ID || undefined

const jwksUri = `${ISSUER}/protocol/openid-connect/certs`
const JWKS = createRemoteJWKSet(new URL(jwksUri))

async function authenticateJWT(req, res, next) {
  // Development bypass (local testing): set AUTH_DEV_BYPASS=true and provide
  // `x-dev-user` and optional `x-dev-roles` headers to simulate an authenticated user.
  if (process.env.AUTH_DEV_BYPASS === 'true') {
    try {
      const devUser = req.get('x-dev-user') || req.headers['x-dev-user']
      const devRolesHeader = req.get('x-dev-roles') || req.headers['x-dev-roles']
      const user = devUser || process.env.DEV_DEFAULT_USER || 'dev'
      const roles = (devRolesHeader || process.env.DEV_DEFAULT_ROLES || 'admin')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
      req.user = { sub: user, preferred_username: user, realm_access: { roles } }
      return next()
    } catch (e) {
      /* header dev hỏng — rơi xuống nhánh xác thực thật bên dưới */
    }
  }
  try {
    const authHeader = req.get('authorization') || req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }
    const token = authHeader.slice(7)
    const verifyOpts = { issuer: ISSUER }
    if (AUDIENCE) verifyOpts.audience = AUDIENCE

    const { payload } = await jwtVerify(token, JWKS, verifyOpts)
    req.user = payload
    return next()
  } catch (err) {
    console.error('[content] auth middleware error', err && (err.stack || err.message || err))
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function hasRole(payload, role, clientId) {
  if (!payload) return false
  try {
    const realmRoles =
      payload.realm_access && Array.isArray(payload.realm_access.roles)
        ? payload.realm_access.roles
        : []
    if (realmRoles.includes(role)) return true

    if (
      clientId &&
      payload.resource_access &&
      payload.resource_access[clientId] &&
      Array.isArray(payload.resource_access[clientId].roles)
    ) {
      if (payload.resource_access[clientId].roles.includes(role)) return true
    }

    if (payload.scope && typeof payload.scope === 'string') {
      const scopes = payload.scope.split(/\s+/)
      if (scopes.includes(role)) return true
    }
  } catch (e) {
    // swallow and return false
  }
  return false
}

function requireRole(role) {
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

module.exports = authenticateJWT
module.exports.requireRole = requireRole
