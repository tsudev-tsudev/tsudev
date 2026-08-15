# tsudev — Developer Ecosystem

[![CI](https://github.com/tsudev-tsudev/tsudev/actions/workflows/ci.yml/badge.svg)](https://github.com/tsudev-tsudev/tsudev/actions/workflows/ci.yml)

Website dự án cá nhân của tsudev: **dự án & bản quyền** (ứng dụng, công cụ, thư
viện — kèm giấy phép và trạng thái đăng ký quyền tác giả), blog, kho tài liệu,
**SSO**, và **con dấu tín nhiệm** cấp cho website dùng mã nguồn tsudev hoặc do
đội ngũ tsudev thực hiện.

Monorepo npm workspaces. Đặc tả gốc: [`documents-tsudev.md`](documents-tsudev.md).

## Bắt đầu

```bash
npm install
cp .env.example .env
npm run dev:full     # dựng Postgres user-space (:5433) + migrate + seed + chạy stack
```

Các lần sau chỉ cần `npm run dev:local` (DB đã có sẵn).

- Mở http://tsudev.localhost:8080 (một cổng vào duy nhất qua
  `scripts/dev-proxy.js`; `*.localhost` tự trỏ loopback, không phải sửa
  `/etc/hosts`). Proxy hỏng: `DEV_PROXY=0 npm run dev:local`.
- Đăng nhập dev: **bất kỳ username** + mật khẩu `devpass`
  (`.env` đã đặt `E2E_BYPASS_KEYCLOAK=1`, không cần Keycloak).
  `tsudev` = ADMIN (xem `/admin`), `alice` = MEMBER, `bob` = VIP.

Không cần Docker cho việc thường ngày. `docker-compose.yml` chỉ dùng khi cần
Keycloak/MinIO thật.

**Chi tiết, gỡ lỗi khởi động, đổi cổng → [docs/development.md](docs/development.md).**

## Cấu trúc

| Thư mục                    | Nội dung                                                   | Cổng |
| -------------------------- | ---------------------------------------------------------- | ---- |
| `apps/frontend-main`       | Next.js 15 — app duy nhất: dự án, blog, docs, trust, admin | 3000 |
| `apps/sso-auth`            | cấu hình realm Keycloak (không phải app Node)              | —    |
| `services/content-service` | blog, docs, dự án & bản quyền                              | 4001 |
| `services/storage-service` | presign S3/R2, upload                                      | 4002 |
| `services/trust-service`   | con dấu tín nhiệm                                          | 4003 |
| `packages/db`              | schema Prisma, migration, seed                             | —    |
| `packages/ui`              | design system + Storybook                                  | 6006 |
| `packages/brand`           | ảnh nguồn logo/favicon/avatar                              | —    |
| `infrastructure/`          | tài liệu hạ tầng & giám sát                                | —    |

Mỗi thư mục có `README.md` riêng.

## Lệnh thường dùng

```bash
npm run dev:local        # chạy toàn bộ stack
npm run dev:services     # chỉ 3 service
npm run dev:frontends    # chỉ app Next
npm run db:migrate       # prisma migrate deploy
npm run db:generate      # BẮT BUỘC sau khi đổi schema.prisma
npm run db:seed
npm run db:reset         # xoá sạch + migrate + seed (chỉ local)
npm run lint             # eslint toàn repo
npm run format           # prettier --write
npm --workspace services/<tên> test
npm --workspace packages/ui run storybook
```

Không có lệnh `test` ở gốc — test chạy theo từng service.

## Tài liệu

| Chủ đề                             | File                                           |
| ---------------------------------- | ---------------------------------------------- |
| Bản đồ hệ thống, luồng request     | [docs/architecture.md](docs/architecture.md)   |
| Chạy local, biến môi trường        | [docs/development.md](docs/development.md)     |
| SSO, JWT, RBAC                     | [docs/auth.md](docs/auth.md)                   |
| Unit test, E2E, chẩn đoán CI       | [docs/testing.md](docs/testing.md)             |
| Token màu, component, a11y         | [docs/design-system.md](docs/design-system.md) |
| Render, Cloudflare Workers, secret | [docs/deployment.md](docs/deployment.md)       |
| Vận hành con dấu tín nhiệm         | [docs/trust-seal.md](docs/trust-seal.md)       |
| Phân vai agent, kỷ luật token      | [AGENTS.md](AGENTS.md)                         |

## Trạng thái

| Phase | Nội dung                                                           | Trạng thái                             |
| ----- | ------------------------------------------------------------------ | -------------------------------------- |
| 0     | Postgres + Prisma + migration/seed, `@tsudev/db`, `@tsudev/types`  | ✅                                     |
| 1     | Backend dùng dữ liệu thật (users/blog/docs/files) + RBAC           | ✅                                     |
| 2     | Design system + trang chủ SSR                                      | ✅                                     |
| 3     | Hạ tầng & giám sát: alerting Telegram/email, CI, Docker            | ✅ cần credential để kích hoạt thật    |
| 4     | Con dấu tín nhiệm: cấp, ký, xác thực, phân phối huy hiệu           | ✅                                     |
| 5     | Một cổng vào + nguồn sự thật cổng/tên miền (`topology:check`)      | ✅                                     |
| 6     | Chuyển thành website dự án cá nhân: gỡ diễn đàn/chợ/tin nhắn       | ✅                                     |
| 7     | Dự án & bản quyền + hồ sơ uy tín tổ chức                           | ✅                                     |
| 8     | Production: Cloudflare Workers (main) + Render (service, Keycloak) | 🚧 chưa deploy migration DROP lên Neon |

## Đóng góp

`main` **không** có branch protection — GitHub Free không hỗ trợ cho repo
private. Lớp chắn duy nhất là hook client `.husky/pre-push`, tự cài khi
`npm install`. Làm việc trên nhánh feature rồi mở PR; thật sự cần vượt thì
`ALLOW_MAIN_FORCE=1 git push`.

Trước khi commit:

```bash
npm run format:check && npm run lint
npm --workspace services/<tên đã sửa> test
```

Commit theo [Conventional Commits](https://www.conventionalcommits.org/).
