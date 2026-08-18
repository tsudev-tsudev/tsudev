# Xác thực & phân quyền

Ba lớp riêng biệt, hay bị lẫn:

1. **Phiên trình duyệt** - NextAuth, cookie `httpOnly` trên `.tsudev.com`.
2. **Danh tính gửi xuống service** - khẳng định có chữ ký do BFF ký.
3. **Phân quyền** - cột `User.role` trong DB, fail closed.

Xác thực do **codebase tự quản lý**: không có nhà cung cấp danh tính ngoài, không
có origin `auth.*`, không có biến issuer/client-id/client-secret nào cần đặt.

## 1. Phiên trình duyệt - NextAuth

`apps/frontend-main/pages/api/auth/[...nextauth].ts`.

Ba provider:

| Provider          | Dùng khi                                             |
| ----------------- | ---------------------------------------------------- |
| `credentials`     | tên đăng nhập/email + mật khẩu (+ mã 2FA nếu đã bật) |
| `passkey`         | WebAuthn - chữ ký đã được auth-service kiểm          |
| `github`/`google` | chỉ được thêm KHI ĐỦ biến môi trường                 |

Provider OAuth thiếu biến thì **không được thêm vào** thay vì được dựng ra rồi
không đăng nhập được - một nút bấm câm là lỗi khó chẩn đoán hơn một nút vắng mặt.

- `session.strategy = 'jwt'`. Cookie `httpOnly: true` khai **tường minh**:
  next-auth gộp cấu hình cookie NÔNG ở cấp tên cookie, nên khai `sessionToken`
  là thay thế trọn gói mặc định - kể cả `httpOnly` nằm bên trong. Bỏ dòng đó là
  cookie phiên đọc được bằng JavaScript.
- `pages.signIn = '/login'` - trang của chính site, không phải trang mặc định.
- `NEXTAUTH_COOKIE_DOMAIN` do `config/topology.json` sinh; đừng đặt tay.

**Không có provider dev nào.** Đăng nhập ở local đi qua đúng đường của
production: mật khẩu Argon2id trong DB. Tài khoản dev do `npm run db:seed:dev`
đặt (`tsudev` ADMIN · `alice` MEMBER · `bob` VIP, mật khẩu `tsudev-dev-2026!`).

> Bản trước có provider `e2e-dev` nhận **bất kỳ username nào** với mật khẩu
> `devpass`, gác sau một cờ môi trường bỏ qua xác thực. Ngày 16/08/2026 bản
> production đã mang theo cờ đó. Cả provider lẫn cờ đã bị gỡ khỏi mã nguồn.

## 2. Danh tính gửi xuống service

`packages/identity-token` - dùng chung giữa bên ký và bên kiểm.

BFF đọc phiên next-auth, ký một JWT HS256 hạn **120 giây**, gửi trong
`Authorization: Bearer`. `packages/auth` kiểm nó. Người dùng không bao giờ giữ
token này.

Claim:

| Claim  | Nghĩa                                                             |
| ------ | ----------------------------------------------------------------- |
| `sub`  | tên đăng nhập - service tra `User` theo giá trị này               |
| `role` | **CHỈ ĐỂ THAM KHẢO**, không phải nguồn phân quyền                 |
| `sv`   | `sessionVersion` lúc đăng nhập, đối chiếu với DB để thu hồi phiên |

`INTERNAL_IDENTITY_SECRET` (≥32 ký tự) phải **giống nhau** ở Cloudflare Workers
và Render. Lệch nhau ⇒ mọi đường ghi đã xác thực trả 401.

> Bản trước gửi danh tính bằng header thuần `x-dev-user`, mà service chỉ đọc
> header đó khi `AUTH_DEV_BYPASS=true` - biến không đặt ở production. Hệ quả là
> hai lỗi ngược chiều: production 401 ở mọi đường ghi, còn bật cờ lên thì một
> dòng header cấp quyền ADMIN.

### Ranh giới của từng service

- `content-service`: `/api` dùng **xác thực TUỲ CHỌN** - có Bearer thì kiểm, không
  có thì đi tiếp. Blog/tài liệu/dự án là nội dung công khai và SSR gọi không kèm
  token. Đường ghi nằm dưới `/api/admin` và tự gọi `requireAdmin()`.
- `storage-service`: `requireRole('MEMBER')` theo từng route.
- `trust-service`: **mặc định ĐÓNG** từ 18/08/2026. Cả `/api/trust` đi qua
  `auth` rồi `requireRole('VIP')`; chỉ còn danh sách miễn trừ `PUBLIC_PATHS` gồm
  đúng `/health` và JWKS. Trước đó nó gắn auth theo nhánh (`AUTH_PREFIXES`) và
  mặc định là công khai - quên khai một nhánh là nó lặng lẽ mở.
  `test/authCoverage.test.ts` canh cả bảng định tuyến lẫn phản hồi thật
  (401 cho khách, 403 cho MEMBER, 200 cho VIP).
- `auth-service`: **không có endpoint công khai nào**; mọi thứ đi qua BFF.

## 3. Phân quyền

**MỘT nguồn sự thật: cột `User.role`.** `Role`: `GUEST` · `MEMBER` · `VIP` ·
`MODERATOR` · `ADMIN`.

`requireRole(role)` từ `@tsudev/auth` **fail closed**, không có biến môi trường
nào tắt được. Lỗi DB cho 503, không phải "cho qua". Claim `role` trong khẳng
định KHÔNG nâng được quyền - có test canh.

Muốn dùng lại vai trò từ token của nhà cung cấp bên ngoài thì phải ánh xạ sang
`User.role` TRƯỚC. Đừng dựng hệ thứ hai chạy song song: bản trước đã có, gác sau
`REQUIRE_ROLE_ENFORCEMENT`, và nó chưa bao giờ hoạt động ở production.

### Mã mời → VIP

Vùng Con dấu tín nhiệm chỉ mở cho `VIP` trở lên, và đường lên VIP là **đổi mã
mời** (`POST /api/identity/invite/redeem`, xem `services/auth-service/src/invite.ts`).

Nó nằm ở auth-service chứ không ở trust-service vì nó **ghi vào `User.role`** -
tức là thuộc ranh giới danh tính. trust-service chỉ việc gọi `requireRole('VIP')`
và không cần biết mã mời tồn tại.

Bốn bất biến, cả bốn đều hỏng âm thầm nếu làm sai:

| Bất biến                                | Vì sao                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Trần cứng ở VIP, ghi trong MÃ           | Nếu dữ liệu nói được bậc vai trò thì ai ghi được vào bảng mã mời là tự cấp được ADMIN    |
| Không hạ vai trò                        | ADMIN đổi mã vẫn là ADMIN                                                                |
| Đếm lượt bằng `updateMany` có điều kiện | Đọc-rồi-ghi cho hai người cùng tiêu lượt cuối cùng                                       |
| DB chỉ giữ SHA-256 của mã               | Cùng lý do với `AuthToken.tokenHash` - bản sao DB bị rò không thành một xấp mã dùng được |

`sessionVersion` **không** tăng khi đổi mã: nâng quyền không phải lý do đá người
ta ra khỏi phiên đang dùng, và phiên cũ mang vai trò cũ thì chỉ có ít quyền hơn.

⚠️ **`token.role` của next-auth chỉ được ghi ở lần đăng nhập ĐẦU TIÊN.** Sau khi
đổi mã, DB nói VIP còn phiên vẫn nói MEMBER. `POST /api/identity/session-state`
và nhánh `trigger === 'update'` ở callback `jwt` tồn tại đúng vì chuyện đó - vai
trò được đọc lại **từ DB**, không bao giờ từ tham số mà client truyền vào
`update()`. Trang nào lọc giao diện theo `session.role` mà không đi qua đường đó
sẽ hiển thị vai trò cũ, và triệu chứng là "đổi mã xong mà không thấy gì đổi".

## 4. auth-service - nơi giữ bí mật

Service DUY NHẤT đọc `User.passwordHash`. Nó tách riêng vì một ràng buộc hạ
tầng trùng với ranh giới đúng: `frontend-main` chạy trên Cloudflare Workers,
không có kết nối Postgres và không nạp được native module, nên Argon2id không
thể chạy ở đó.

| Cơ chế             | Chi tiết                                                             |
| ------------------ | -------------------------------------------------------------------- |
| Mật khẩu           | Argon2id 19MiB/2/1 (OWASP). Tối thiểu 12 ký tự.                      |
| Chống dò tài khoản | Tài khoản không tồn tại vẫn chạy một lần verify thật (`burnTiming`)  |
| Giới hạn tần suất  | Hai trục: theo IP (`LoginAttempt`) và theo tài khoản (`lockedUntil`) |
| 2FA                | TOTP tự cài trên `crypto` của Node, có test theo vector RFC 6238     |
| Mã dự phòng        | 10 mã, chỉ lưu SHA-256, dùng một lần                                 |
| Passkey            | WebAuthn qua `@simplewebauthn/server`                                |
| Token một lần      | Chỉ lưu SHA-256; đổi bằng `updateMany` có điều kiện `usedAt: null`   |
| Mã mời             | Chỉ lưu SHA-256; nâng lên VIP, trần cứng trong mã (xem §3)           |

### Vì sao đăng nhập bằng passkey không hỏi thêm TOTP

Chữ ký WebAuthn được **trình duyệt buộc vào tên miền**. Một trang giả ở
`tsudev-login.example` không lấy được chữ ký dùng cho `tsudev.com`, kể cả khi
người dùng bị lừa hoàn toàn. Mật khẩu và TOTP đều không có tính chất đó. Bắt
thêm một bước nữa chỉ đổi bảo mật lấy phiền phức.

Passkey **vẫn** phải qua cổng khoá tài khoản - nếu không nó thành đường vòng
quanh chính cơ chế đó.

### Thu hồi phiên

`User.sessionVersion` tăng khi đổi/đặt lại mật khẩu. Khẳng định mang số cũ bị từ
chối ở tầng service - nơi truy vấn `User` đằng nào cũng đã xảy ra, nên phép so
sánh miễn phí. Kiểm ở BFF sẽ tốn một truy vấn Workers → Neon cho **mỗi** request.

## 5. Tài khoản không có mật khẩu

Tài khoản có từ trước khi mật khẩu được giữ trong DB thì không có `passwordHash`. Đường tự phục hồi là
"quên mật khẩu", nhưng nó chỉ chạy khi tài khoản có email **thật** - mà
`resolveUser()` tạo tài khoản với `<username>@tsudev.local`, tên miền không nhận
được thư.

Cho những tài khoản đó:

```bash
# PRODUCTION - phải xuất DATABASE_URL TRƯỚC
set -a; . <(grep '^DATABASE_URL=' backup/production-env-2026-08-16.txt); set +a
NEW_PASSWORD='…' node services/auth-service/scripts/set-password.js <username>
```

⚠️ **Không xuất `DATABASE_URL` thì script nhắm DB LOCAL.** Nó nạp `.env` ở gốc
repo, vốn trỏ cluster dev. Chạy thiếu bước đó thì nó vẫn báo "thành công" -
thành công thật, chỉ là trên máy dev - còn cột `passwordHash` ở production vẫn
rỗng và tài khoản vẫn không đăng nhập được. Đã xảy ra thật. Script nay **in ra
host của database trước khi ghi**; đọc dòng đó.

Mật khẩu truyền qua **biến môi trường**, không phải tham số dòng lệnh: tham số
nằm trong `ps` và trong lịch sử shell.

## Biến môi trường

| Biến                       | Bắt buộc ở production | Ghi chú                                     |
| -------------------------- | --------------------- | ------------------------------------------- |
| `NEXTAUTH_SECRET`          | ✔                     |                                             |
| `INTERNAL_IDENTITY_SECRET` | ✔ (≥32 ký tự)         | phải GIỐNG NHAU ở frontend và backend       |
| `TOTP_ENCRYPTION_KEY`      | ✔ (≥32 ký tự)         | đổi = mọi thiết bị 2FA hỏng                 |
| `RESEND_API_KEY`           | ✔                     | thiếu ⇒ không gửi được thư đặt lại mật khẩu |
| `NEXT_PUBLIC_MAIN_URL`     | ✔                     | liên kết trong thư và RP ID của passkey     |
| `GITHUB_*` / `GOOGLE_*`    | -                     | thiếu ⇒ provider không xuất hiện            |
| `INTERNAL_API_TOKEN`       | -                     | cổng chặn `/api` của content/storage/auth   |
