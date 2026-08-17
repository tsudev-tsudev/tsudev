# Kiến trúc tsudev

Monorepo npm workspaces (`apps/*`, `services/*`, `packages/*`). Không có công cụ
build monorepo (Turbo/Nx): mọi thứ chạy qua `npm --workspace <path> run <script>`.

**Một app, ba service.** tsudev là website dự án cá nhân: dự án/bản quyền, blog,
tài liệu và con dấu tín nhiệm. Diễn đàn, chợ ký quỹ, tin nhắn và hồ sơ thành
viên đã được gỡ — xem [refactor-personal-site.md](refactor-personal-site.md).

## Bản đồ

```
apps/
  frontend-main/     Next.js 15 + React 19 · tsudev.localhost · app DUY NHẤT
                     trang chủ, dự án, blog, docs, trust, admin
services/            Express + CommonJS, mỗi service một tiến trình
  content-service/   :4001  blog, docs, dự án & bản quyền
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

Ở dev, mọi thứ trình duyệt chạm tới đi qua **một cổng vào duy nhất**
(`scripts/dev-proxy.js`, cổng 8080) và phân biệt bằng subdomain —
`tsudev.localhost`, `auth.…`, `cdn.…` — đúng hình trạng production. Bảng cổng:
`config/topology.json`.

```
trình duyệt
   │  chỉ gọi cùng origin (tsudev.localhost)
   ▼
Next.js: getServerSideProps  •  hoặc  API route (pages/api/<domain>/[...path].js)
   │  chuyển tiếp kèm token, thêm header nội bộ
   ▼
service Express  (:4001–:4003)
   │  jose kiểm khẳng định danh tính do BFF ký (@tsudev/identity-token)
   ▼
Prisma → PostgreSQL      ·      S3/R2 (chỉ storage-service)
```

**Trình duyệt không bao giờ gọi thẳng cổng service.** Hai đường vào service:

- **Đọc công khai** (blog, docs, dự án, danh bạ dấu) đi qua
  `getServerSideProps` — chạy trên server, không cần proxy.
- **Ghi và đọc riêng tư** đi qua route proxy; trình duyệt không tự khai được vai
  trò của mình, danh tính lấy từ phiên next-auth rồi tiêm vào header.

| Proxy                                        | Đích            |
| -------------------------------------------- | --------------- |
| `/api/content/[...path]` — chỉ nhánh `admin` | content-service |
| `/api/storage/[...path]`                     | storage-service |
| `/api/trust/[...path]`, `/api/trust/jwks`    | trust-service   |

Nhờ vậy mã nhúng của bên thứ ba (huy hiệu trust) chỉ trỏ tới **một** domain, và
hạ tầng phía sau đổi được mà không phiền ai. Thêm endpoint service mới thì phải
thêm/mở rộng proxy tương ứng, nếu không trình duyệt sẽ chặn CORS.

Cả `/api/content/*` và `/api/trust/*` dùng **danh sách trắng tiền tố**, không
phải danh sách đen: nhánh chưa khai thì 404. Bỏ sót một nhánh là nó không chạy —
an toàn hơn lỡ mở cả `/api`.

## Bề mặt API

Đầy đủ trong mã (`services/*/src/index.js`). Nhóm chính:

- **content-service** — `/api/posts`, `/api/docs`, `/api/projects`,
  `/api/admin/projects` (chỉ ADMIN)
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

13 model: `User` `Post` `Doc` `FileObject` `Project`, cộng 8 model của con dấu
(`TrustOrganization` `TrustDomain` `SealProgram` `SealApplication`
`SealEvidence` `TrustCertificate` `TrustCheck` `TrustAuditLog`).

- Vai trò: enum `Role` = `GUEST`, `MEMBER`, `VIP`, `MODERATOR`, `ADMIN` — mặc định `MEMBER`.
- Migration đã áp dụng là **bất biến** — sửa file cũ làm lệch checksum và
  `prisma migrate deploy` sẽ dừng, kéo theo CI đỏ và deploy không boot. Cần đổi
  thì tạo migration mới.
- Đổi `schema.prisma` xong phải chạy `npm run db:generate`, nếu không build
  frontend đỏ vì client Prisma cũ.

## Điểm lệch cần biết

- **Tín dụng đã bị gỡ (16/08/2026).** `User.credits`, `SealProgram.feeCredits`,
  `SealApplication.feeCharged` không còn; mọi chương trình dấu miễn phí. Trước
  đó `credits` là bẫy: tên gợi ý ví của chợ ký quỹ đã xoá, nhưng trust-service
  dùng nó để thu phí nộp đơn. Đường nộp đơn nay có test riêng
  (`applicationSubmit.test.ts`) nên bẫy đó không tái diễn.
- **Uy tín không phải điểm số.** `ReputationEvent` và `User.reputation` đã bị
  xoá. "Uy tín" nay là hồ sơ tổ chức (`/trust/org/<id>`), dẫn ra từ dữ liệu cấp
  dấu đã có: chứng chỉ hiệu lực, tên miền đã xác minh, thâm niên, tỉ lệ vượt
  giám sát. Cố ý không quy về một con số.
- `services/api-gateway` xuất hiện trong TSD nhưng **không tồn tại** trong repo;
  vai trò gateway hiện do các route proxy của Next đảm nhiệm.
