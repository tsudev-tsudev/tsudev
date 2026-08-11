# Xác thực & phân quyền

Ba lớp riêng biệt, hay bị lẫn: **phiên trình duyệt** (NextAuth), **token gọi
service** (Keycloak JWT), và **kiểm tra vai trò** (RBAC, hiện là opt-in).

## 1. Phiên trình duyệt — NextAuth

Cấu hình ở `apps/*/pages/api/auth/[...nextauth].js` (mỗi app một bản).

- Provider chính: Keycloak OIDC (`KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`,
  `KEYCLOAK_CLIENT_SECRET`).
- `session.strategy = 'jwt'`, cookie `secure` chỉ khi `NODE_ENV=production`.
- `NEXTAUTH_COOKIE_DOMAIN` chia sẻ phiên giữa các subdomain: `.tsudev.vn` ở
  production, `.tsudev.localhost` ở local. Giá trị do `config/topology.json`
  sinh ra, đừng đặt tay.
  Từ giai đoạn 3, local đi qua `dev-proxy` nên hai app nằm trên hai subdomain
  thật (`tsudev.localhost`, `forum.tsudev.localhost`) — nghĩa là **đường chia sẻ
  phiên kiểm chứng được ngay ở local**, đúng như trên production. Trước đó thì
  không: `localhost:3000` và `localhost:3001` vốn dùng chung kho cookie, nên bug
  về phạm vi cookie chỉ lộ ra lần đầu khi lên production.
  Đã đo trên Chromium và Firefox: cookie host-only **không** sang được
  subdomain, cookie có `Domain=.tsudev.localhost` thì sang được.
- `NEXTAUTH_URL` phải khớp origin của **chính app đang chạy**, xem
  [development.md](development.md#biến-môi-trường).

### Provider dev

`E2E_BYPASS_KEYCLOAK=1` thêm provider credentials `e2e-dev`: mọi username +
mật khẩu `devpass` (`E2E_PASS`). **Chỉ cho local và E2E.** Production tuyệt đối
không đặt biến này.

## 2. Token gọi service — Keycloak JWT

`services/*/src/authMiddleware.js` (bốn bản gần như giống nhau) xác thực bằng
`jose`:

- Lấy JWKS từ `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`.
- Kiểm `issuer`; kiểm `audience` nếu có `KEYCLOAK_CLIENT_ID`.
- Thiếu/sai token → `401`.
- Gắn payload đã giải mã vào `req.user`.

**Hai service gắn middleware theo hai kiểu khác nhau** — nhớ kiểu của service
mình đang sửa:

- `content-service`, `user-service`, `storage-service`: `app.use('/api', auth)`.
  Route công khai (`/health`) phải đăng ký **trước** dòng đó.
- `trust-service`: chỉ gắn `auth` cho từng nhánh cần danh tính (`/api/trust/orgs`,
  `/api/trust/domains`, `/api/trust/applications`, `/api/trust/certificates`,
  `/api/trust/admin`). Mặc định ở đây là **công khai** — huy hiệu, trang xác
  thực, thư mục và danh sách chương trình được trình duyệt của khách trên site
  bên thứ ba tải về, hoàn toàn không có token. Thêm nhánh riêng tư mới thì phải
  bổ sung vào danh sách đó, nếu không nó lộ ra công khai và không có gì báo lỗi.

### Bypass khi phát triển

```bash
export AUTH_DEV_BYPASS=true
# Gọi thẳng cổng service — chỉ để gỡ rối. Từ giai đoạn 4, TRÌNH DUYỆT phải đi
# qua BFF cùng origin: /api/storage/presign trên frontend-main.
curl -H 'x-dev-user: alice' -H 'x-dev-roles: storage:presign' \
     "$STORAGE_SERVICE_URL/api/presign?fileName=foo.txt"
```

- `x-dev-user` → `sub` và `preferred_username`.
- `x-dev-roles` → `realm_access.roles` (ngăn nhau bằng dấu phẩy).
- Mặc định khi thiếu header: `DEV_DEFAULT_USER` (`dev`) và `DEV_DEFAULT_ROLES`
  (`admin`).

**Không bật ở CI hay production.** CI nên dùng realm Keycloak test hoặc mock
JWKS.

### JWT dev có chữ ký

Khi cần header `Authorization: Bearer` thật (client không gửi được header tuỳ ý):

```bash
node scripts/generate-dev-jwt.js --sub alice --roles 'storage:presign,storage:upload' --exp 3600
```

Ký HS256 bằng `DEV_JWT_SECRET`.

## 3. RBAC

Hai hệ vai trò tồn tại song song — biết mình đang nói về hệ nào:

| Hệ               | Nguồn                             | Dùng ở đâu                       |
| ---------------- | --------------------------------- | -------------------------------- |
| Vai trò ứng dụng | cột `User.role` trong Prisma      | logic nghiệp vụ, giao diện admin |
| Vai trò token    | `realm_access.roles` của Keycloak | `requireRole()` trong middleware |

`Role` (Prisma): `GUEST` · `MEMBER` · `VIP` · `MODERATOR` · `ADMIN`.

`requireRole(role)` **trả về middleware rỗng** trừ khi
`REQUIRE_ROLE_ENFORCEMENT=true`. Nghĩa là: ở local mọi route "được bảo vệ" đều
mở. Đây là chủ đích (giữ local dễ chạy), nhưng cũng có nghĩa **route mới không
được kiểm chứng phân quyền cho tới khi bật biến này**. Sửa route nhạy cảm thì
chạy lại với `REQUIRE_ROLE_ENFORCEMENT=true` ít nhất một lần.

Tên vai trò cho storage cấu hình được: `STORAGE_PRESIGN_ROLE`,
`STORAGE_UPLOAD_ROLE`.

`requireRole` tìm vai trò ở ba nơi theo thứ tự: `realm_access.roles`,
`resource_access[KEYCLOAK_CLIENT_ID].roles`, rồi `scope` (tách theo khoảng
trắng).

## Keycloak local

Realm export: `apps/sso-auth/keycloak/realm-export.json` — định nghĩa client
public `tsudev-frontend` và user `devuser` / `devpass`.

```bash
docker compose up keycloak   # :4100, qua proxy: auth.tsudev.localhost:8080
```

Không có Docker thì trỏ `KEYCLOAK_ISSUER` sang một instance bên ngoài. Production
dùng client **confidential** kèm secret thật và bắt buộc HTTPS.

## Nợ kỹ thuật đã biết

- Bốn `authMiddleware.js` gần trùng nhau, chỉ khác tiền tố log. Sửa hành vi xác
  thực thì phải sửa **cả bốn** — hoặc gom về `packages/utils` (chưa làm).
- Chưa có test tích hợp nào chạy token Keycloak thật; test hiện chỉ khẳng định
  request không xác thực bị từ chối.
