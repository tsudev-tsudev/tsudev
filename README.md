# tsudev — Developer Ecosystem

[![CI](https://github.com/b4djl1h/tsudev/actions/workflows/ci.yml/badge.svg)](https://github.com/b4djl1h/tsudev/actions/workflows/ci.yml)

Hệ sinh thái công nghệ đa nền tảng cho developer (theo `documents-tsudev.md`): trang chủ portfolio, blog, tài liệu, **diễn đàn** (forum engine với uy tín/xếp hạng, kiểm duyệt, tin nhắn, marketplace), SSO và object storage.

## Trạng thái triển khai

| Phase | Nội dung                                                                             | Trạng thái                                        |
| ----- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 0     | Nền móng: Postgres + Prisma + migration/seed, packages `@tsudev/db`, `@tsudev/types` | ✅                                                |
| 1     | Backend dùng dữ liệu thật (users/blog/docs/files) + RBAC                             | ✅                                                |
| 2     | Design system theme-aware + trang chủ SSR                                            | ✅                                                |
| 3     | Forum engine: chuyên mục/chủ đề/bài viết, reply, vote                                | ✅                                                |
| 4     | Uy tín, xếp hạng, bảng xếp hạng, hồ sơ thành viên                                    | ✅                                                |
| 5     | Kiểm duyệt (report/ban/audit), tin nhắn riêng, marketplace escrow                    | ✅                                                |
| 6     | Hạ tầng & giám sát: alerting Telegram/email, CI, Docker, Cloudflare docs             | ✅ (cần credential/cloud để kích hoạt thật)       |
| 7     | Con dấu tín nhiệm: `trust-service`, cấp/xác thực/phân phối huy hiệu                  | ✅ (xem [docs/trust-seal.md](docs/trust-seal.md)) |

## Quick start (một lệnh, không cần Docker)

```bash
npm install
npm run dev:full   # dựng Postgres user-space (5433) + migrate + seed + chạy 5 process
```

- Frontend chính: http://localhost:3000 · Diễn đàn: http://localhost:3001
- Đăng nhập dev (khi `E2E_BYPASS_KEYCLOAK=1`): bất kỳ username + mật khẩu `devpass`.
  - `tsudev` = quản trị (xem `/admin`), `alice`/`bob` = thành viên.

Các lệnh DB: `npm run db:up | db:migrate | db:seed | db:reset`.

> Bản gốc scaffold dùng `docker-compose up` (Keycloak, MinIO, Postgres, Redis, services, frontends). `dev:full` là đường chạy local không cần Docker.

Overview:

- Multi-app monorepo với `apps/`, `services/`, `packages/`, và `infrastructure/`.
- Dev bootstrap qua `docker-compose up` HOẶC `npm run dev:full` (local, không Docker).

Quick start (development):

1. Copy `.env.example` to `.env` and edit values.
2. Run `docker-compose up --build` to start the development environment.

This scaffold provides minimal, extensible placeholders so you can incrementally implement the full production-quality system.

## Local development without Docker (real-time hot-reload)

If Docker Desktop is unavailable or you prefer local dev that updates immediately on file save, you can run the services and frontends directly with file watchers.

Prerequisites:

- Node.js 18+ and `npm` installed on your machine.

Install tools (from repo root):

```powershell
# Install workspace dependencies (root will install workspaces)
npm install

# Optionally install per-package dependencies if you prefer:
npm --prefix services/user-service install
npm --prefix services/content-service install
npm --prefix services/storage-service install
npm --prefix apps/frontend-main install
npm --prefix apps/frontend-forum install
```

Start all dev servers (hot-reload enabled):

```powershell
npm run dev
```

## Run everything locally (no Docker)

To run the full dev stack locally (frontends with Fast Refresh and services with nodemon) without Docker, use the helper added in this repo:

```bash
# install workspace deps
npm run bootstrap

# start all local dev servers and sync .env into frontends
npm run dev:local
```

The `dev:local` helper generates each frontend's `.env.local` from your root `.env` (via `scripts/write-env-local.js`) and spawns the `npm run dev` scripts for the services and frontends with the same environment. For full SSO/DB/storage behavior you still need Keycloak/Postgres/Redis/MinIO; you can run only those infra containers with Docker if desired.

Notes about environment variables:

- Copy `.env.example` to `.env` at the repository root and update values.
- `NEXT_PUBLIC_MAIN_URL` / `NEXT_PUBLIC_FORUM_URL` are the origins of the two frontends. The shared `SiteHeader`/`SiteFooter` build absolute links from them, because a relative `/blog` would follow whichever origin the visitor is on and 404 on the forum. Set them to the real domains before deploying.
- `apps/*/.env.local` is generated — do not hand-edit it. Each app gets its own `NEXTAUTH_URL` (derived from the two variables above) so next-auth builds callbacks against the right port; a shared value would bounce forum logins to `:3000`. Regenerate at any time with `npm run env:local`; `npm run dev`, `dev:frontends` and `dev:local` do it automatically.

Keycloak / SSO:

- For the local SSO to work, start Keycloak via Docker (see `apps/sso-auth/README.md`). The included realm export creates a `tsudev-frontend` public client and a development user `devuser` / `devpass`.

Notes:

- Frontend Next.js apps run with `next dev` and provide React Fast Refresh on edits.
- Backend services use `nodemon` (watching `src/`) to restart automatically on changes.
- You can run subsets: `npm run dev:services` or `npm run dev:frontends`.

See individual `apps/*` and `services/*` READMEs for per-component details.

## Running tests & CI

Unit tests for backend services are run per-service. To run tests locally for a service, from the repository root:

```bash
# example: run tests for storage-service
npm --prefix services/storage-service install
npm --prefix services/storage-service test
```

CI is configured with GitHub Actions (file: `.github/workflows/ci.yml`) to run `npm ci` and `npm test` for the core services on push and PRs.

## Role-based enforcement (RBAC)

Authentication is enforced via Keycloak JWT verification in `services/*/src/authMiddleware.js`. Role checks are available but opt-in to avoid breaking local development: set the environment variable `REQUIRE_ROLE_ENFORCEMENT=true` to enable role checks across services. Role names can be configured via service-specific environment variables such as `STORAGE_UPLOAD_ROLE` and `STORAGE_PRESIGN_ROLE`.
