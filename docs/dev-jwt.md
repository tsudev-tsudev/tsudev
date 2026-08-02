# Dev JWT & Local Auth Guide

Quick dev authentication options (no Keycloak required):

- AUTH_DEV_BYPASS: fast local bypass. Set `AUTH_DEV_BYPASS=true` and send `x-dev-user` and optional `x-dev-roles` headers to simulate authenticated requests. This is the easiest method for unit tests and local development.
- Dev JWT generator: `scripts/generate-dev-jwt.js` produces an HS256-signed JWT using the `DEV_JWT_SECRET` value. Useful for wiring frontends that expect an `Authorization: Bearer <token>` header.

## Examples

1. Use dev bypass headers (recommended for tests):

```bash
export AUTH_DEV_BYPASS=true
curl -H "x-dev-user: alice" -H "x-dev-roles: storage:presign" http://localhost:4002/api/presign?fileName=foo.txt
```

2. Create a short-lived JWT and call an endpoint:

```bash
node scripts/generate-dev-jwt.js --sub alice --roles "storage:presign,storage:upload" --exp 3600
# copy the printed token
curl -H "Authorization: Bearer <token>" http://localhost:4002/api/presign?fileName=foo.txt
```

## Notes

- `AUTH_DEV_BYPASS` is intended only for local development. Do not enable it in CI/production. In CI, prefer either a real Keycloak test realm or a mocked jwks endpoint.
- Role enforcement can be enabled by setting `REQUIRE_ROLE_ENFORCEMENT=true`. When enabled, middleware will check `realm_access.roles` (or `resource_access`) for required roles.
