# Auth Audit & Changes (automatic update)

Date: 2026-04-15

Summary:

- Implemented Keycloak JWKS-based JWT verification middleware in core services: `storage-service`, `content-service`, `user-service`, and `api-gateway`.
- Exposed a `requireRole(role)` helper (opt-in enforcement via `REQUIRE_ROLE_ENFORCEMENT=true`) allowing future RBAC checks without breaking local dev.
- Protected storage-sensitive endpoints (`/api/presign`, `/api/upload`) with RBAC hooks and default role env vars (`STORAGE_PRESIGN_ROLE`, `STORAGE_UPLOAD_ROLE`).
- Exported `app` and `startServer` from services to enable unit testing without starting listeners.
- Added unit tests asserting unauthenticated access is denied and added a GitHub Actions workflow to run per-service tests on PRs.

Findings:

- Local dev uses Keycloak realm export in `apps/sso-auth/keycloak/realm-export.json`.
- Frontends use NextAuth OIDC adapters in `apps/*/pages/api/auth/[...nextauth].js`.
- Several subsystems (Admin UI, search/indexer, notification relay) were not present or require deeper review.

Recommendations (prioritized):

1. CI first: enable GitHub Actions (done) and run tests on all PRs; fix any runtime CI failures.
2. Enable RBAC in staging: set `REQUIRE_ROLE_ENFORCEMENT=true` in non-local envs and configure role names per service. Monitor traffic and errors.
3. Harden presign policy: restrict AllowedOrigins, implement short-lived tokens, apply prefix checks on keys, and require a scoped role for server-side uploads.
4. Centralize edge auth (optional): expand `services/api-gateway` to act as a policy enforcement point (rate-limits, IP allowlists, centralized logging). Keep service-level checks for defense in depth.
5. Add integration tests that exercise Keycloak tokens (use a test client or mock `jose` verification for CI to simulate roles).
6. Audit remaining subsystems (Admin, search, notifications) for secret leaks and auth coverage.

How to proceed automatically (what I did / can continue):

- Created CI workflow `.github/workflows/ci.yml` to run `npm ci` and `npm test` per service.
- Added RBAC helper and updated storage endpoints to use role checks (opt-in).
- Can create a PR branch and open a PR with these changes if you want a review + merge workflow.

Next actions I can take (choose one):

- Create a PR branch and push changes to remote, open PR with description and tests attached.
- Add integration test harness that mints test JWTs and validates RBAC flow in CI.
- Enable RBAC enforcement in a staging config file and adjust role mappings.
