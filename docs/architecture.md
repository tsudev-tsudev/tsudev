# Kiến trúc tsudev

Monorepo npm workspaces (`apps/*`, `services/*`, `packages/*`). Không có công cụ
build monorepo (Turbo/Nx): mọi thứ chạy qua `npm --workspace <path> run <script>`.

## Bản đồ

```
apps/
  frontend-main/     Next.js 15 + React 19 · :3000 · trang chủ, blog, docs,
                     members, messages, market, trust, admin
  frontend-forum/    Next.js 13 + React 18 · :3001 · diễn đàn (board, thread)
  sso-auth/          KHÔNG phải app Node — chỉ chứa realm export Keycloak
services/            Express + CommonJS, mỗi service một tiến trình
  user-service/      :4000  hồ sơ thành viên, uy tín, xếp hạng
  content-service/   :4001  blog, docs, forum, kiểm duyệt, tin nhắn, market
  storage-service/   :4002  presign S3/R2, upload phía server, liệt kê file
  trust-service/     :4003  con dấu tín nhiệm (cấp, ký, xác thực, giám sát)
packages/
  @tsudev/db         Prisma schema + migration + seed (nguồn dữ liệu duy nhất)
  @tsudev/ui         design system: 17 component + tokens.css + Storybook
  @tsudev/types      kiểu dùng chung
  @tsudev/utils      tiện ích dùng chung
  brand/             ảnh gốc logo/avatar/favicon + script sinh asset
  observability/     initSentry.js · notify.js (Telegram/email) — thư mục thuần,
                     không có package.json, import theo đường dẫn tương đối
```

## Luồng request

```
trình duyệt
   │  chỉ gọi cùng origin (:3000 hoặc :3001)
   ▼
Next.js API route  (pages/api/<domain>/[...path].js)
   │  chuyển tiếp kèm token, thêm header nội bộ
   ▼
service Express  (:4000–:4003)
   │  jose xác thực JWT theo JWKS của Keycloak
   ▼
Prisma → PostgreSQL      ·      S3/R2 (chỉ storage-service)
```

**Trình duyệt không bao giờ gọi thẳng cổng service.** Các route proxy hiện có:

| Proxy                                                     | Đích            |
| --------------------------------------------------------- | --------------- |
| `frontend-forum` `/api/forum/[...path]`                   | content-service |
| `frontend-main` `/api/mod`, `/api/msg`, `/api/market`     | content-service |
| `frontend-main` `/api/trust/[...path]`, `/api/trust/jwks` | trust-service   |

Nhờ vậy mã nhúng của bên thứ ba (huy hiệu trust) chỉ trỏ tới **một** domain, và
hạ tầng phía sau đổi được mà không phiền ai. Thêm endpoint service mới thì phải
thêm/ mở rộng proxy tương ứng, nếu không trình duyệt sẽ chặn CORS.

## Bề mặt API

Đầy đủ trong mã (`services/*/src/index.js`). Nhóm chính:

- **user-service** — `/api/users`, `/api/users/:username`
- **content-service** — `/api/posts`, `/api/docs`, `/api/forum/*`,
  `/api/market/*`, `/api/messages/*`, `/api/mod/*`
- **storage-service** — `/api/presign`, `/api/upload`, `/api/files`
- **trust-service** — `/api/trust/*`, `/api/trust/admin/*`,
  `/.well-known/tsudev-trust-jwks.json`

Mọi service có `GET /health` (Render dùng làm health check).
`content-service` có `GET /debug/boom` chỉ bật ngoài production — dùng để nghiệm
thu đường cảnh báo (§6.3 của TSD).

## Dữ liệu

Một database PostgreSQL, một schema Prisma dùng chung
(`packages/db/prisma/schema.prisma`). Các service **không** có DB riêng — đây là
microservice về mặt tiến trình, không phải về mặt dữ liệu.

- Vai trò: enum `Role` = `GUEST`, `MEMBER`, `VIP`, `MODERATOR`, `ADMIN` — mặc định `MEMBER`.
- Migration đã áp dụng là **bất biến** — sửa file cũ làm lệch checksum và
  `prisma migrate deploy` sẽ dừng, kéo theo CI đỏ và deploy không boot. Cần đổi
  thì tạo migration mới.
- Đổi `schema.prisma` xong phải chạy `npm run db:generate`, nếu không build
  frontend đỏ vì client Prisma cũ.

## Điểm lệch cần biết

- **Hai app Next lệch phiên bản lớn**: main dùng Next 15/React 19, forum dùng
  Next 13/React 18. Component trong `@tsudev/ui` phải chạy được ở **cả hai** —
  đừng dùng API chỉ có ở React 19.
- Chỉ `frontend-main` có cấu hình Cloudflare Workers (`wrangler.jsonc`,
  `open-next.config.ts`). `frontend-forum` chưa có đường deploy tương ứng.
- `services/api-gateway` xuất hiện trong TSD nhưng **không tồn tại** trong repo;
  vai trò gateway hiện do các route proxy của Next đảm nhiệm.
