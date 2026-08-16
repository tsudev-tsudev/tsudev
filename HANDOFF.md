# Phiếu bàn giao — sau đợt xác thực tự quản lý và tái cấu trúc giao diện (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> xác thực/phân quyền là [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở**, không lặp lại kiến thức đã nằm trong `docs/` hay `CLAUDE.md`.

## Đang chạy

`https://tsudev.com` đã lên sóng.

| Thành phần       | Ở đâu                   | Ghi chú                                      |
| ---------------- | ----------------------- | -------------------------------------------- |
| `frontend-main`  | Cloudflare Workers      | `tsudev.com` + `www.tsudev.com`              |
| `tsudev-backend` | Render **singapore**    | gộp content + storage + trust + **identity** |
| PostgreSQL       | Neon **ap-southeast-1** | DB `neondb`                                  |

Biến môi trường/secret production: **`backup/production-env-2026-08-16.txt`**
(đã gitignore VÀ dockerignore, không commit).

Ba thứ mất là không sinh lại được:

- `TRUST_SIGNING_KEY` — mất là chứng chỉ đã cấp không xác minh nổi.
- `TOTP_ENCRYPTION_KEY` — mất là mọi thiết bị 2FA đang dùng hỏng.
- `INTERNAL_IDENTITY_SECRET` — sinh lại được, nhưng phải đổi ĐỒNG THỜI ở
  Cloudflare Workers và Render; lệch nhau là mọi đường ghi trả 401.

---

## 0. VIỆC ĐẦU TIÊN CỦA PHIÊN MỚI

**PR #1** (`feat/typescript-migration` → `main`) đang mở và xanh. Nó gộp cả đợt
TypeScript/Rust lẫn đợt xác thực + giao diện này. Gộp nó trước khi bắt đầu bất
cứ thứ gì mới.

### ~~Bốn việc phải làm TAY ở production~~ — ✅ XONG 16/08

Chủ dự án xác nhận: đã xoá service `tsudev-sso` trên Render, đã đặt
`INTERNAL_IDENTITY_SECRET` / `TOTP_ENCRYPTION_KEY` / `RESEND_API_KEY` **giống
nhau ở Worker và Render**, đã xác minh tên miền `tsudev.com` bên Resend, và đã
đặt mật khẩu cho tài khoản `tsudev`.

### THỨ TỰ PHÁT HÀNH — không được đảo

`prisma migrate deploy` **không tự chạy lúc service khởi động** (xem
`docs/deployment.md`). Nên phải:

1. **Chạy migration lên Neon TRƯỚC.** Ba migration của đợt này đều THUẦN TÍNH
   CỘNG — mã cũ đang phục vụ không bị ảnh hưởng.
2. Gộp PR ⇒ Render tự dựng và phát hành `tsudev-backend`.
3. Phát hành frontend: `npm --workspace apps/frontend-main run deploy`.

⚠️ **Migration xoá cột `User.keycloakId` CỐ Ý bị hoãn sang đợt sau.** Trong
khoảng giữa bước 1 và bước 2, mã CŨ vẫn đang chạy, mà `GET /api/posts` dùng
`include: { author: true }` ⇒ Prisma SELECT mọi cột của `User`. Xoá cột đó ở
bước 1 là blog và trang bài viết 500 — và `lib/api.ts` nuốt lỗi thành `[]`, nên
triệu chứng là **trang trống**, không phải trang lỗi.

Xoá nó ở §1.6 bên dưới, sau khi mã mới đã lên sóng.

### Nghiệm thu sau khi phát hành

```bash
curl -s https://tsudev.com/api/auth/providers   # chỉ credentials/passkey/oauth đã cấu hình
curl -s -o /dev/null -w '%{http_code}\n' https://tsudev.com/login   # 200
```

Rồi đăng nhập thật và mở `/admin/projects` — đó là đường đã im lặng trả 401 suốt
thời gian dài và là thứ đợt này vá.

---

## 1. Việc còn dở

### 1.1 Dựng bộ ping giữ ấm — 🟠 CHƯA LÀM

Free tier cấp 750 giờ instance/tháng cho **cả tài khoản**; một service chạy liên
tục tiêu 720 giờ. Nay chỉ còn MỘT service (`tsudev-backend`) nên toàn bộ ngân
sách dồn về nó — không còn phải đánh đổi với đường đăng nhập như khi còn
Keycloak. Ping `https://tsudev-backend.onrender.com/health` mỗi 5 phút.

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ ~8.600 phút/tháng, vượt xa hạn mức 2.000. Dùng UptimeRobot free hoặc
Better Stack free.

### 1.2 ~~Giới hạn tần suất~~ — ✅ XONG 16/08

- Đường đăng nhập: hai trục (theo IP qua bảng `LoginAttempt`, theo tài khoản qua
  `failedLoginCount`/`lockedUntil`) trong `services/auth-service/src/throttle.ts`.
- Nhánh công khai của con dấu: `services/trust-service/src/rateLimit.ts`, cửa sổ
  trượt trong bộ nhớ tiến trình.

⚠️ **Bộ đếm của trust-service nằm trong RAM và giả định ĐÚNG MỘT tiến trình.**
Giả định đó đúng hôm nay (`backend-bundle` là một tiến trình) và **vỡ** nếu chạy
nhiều bản — lúc đó ngưỡng thực tế nhân lên theo số bản. Chú thích đầu tệp ghi rõ.

### 1.3 `npm audit`: 7 lỗ, 4 mức cao — 🟠 CHƯA LÀM

`sharp` kế thừa CVE của libvips qua `next`; sửa cần nâng lên `next@16` —
breaking. Phải là **đợt riêng có test đầy đủ**, đừng nhét vào commit khác.
`qs` qua `express` thì `npm audit fix` xử lý được, không breaking.

### 1.4 Bật CSP thật — 🟡 CHƯA LÀM

CSP đang ở **`Content-Security-Policy-Report-Only`, CÓ CHỦ ĐÍCH**, không phải
quên. Trình duyệt PUT thẳng lên endpoint R2 bằng URL presign, mà host đó đến từ
biến môi trường chứ không biết được lúc build — bật chặn mù là upload chết **mà
không có lỗi nào phía máy chủ**.

Cách bật: mở site, thao tác thật vài phút (đăng nhập, xem blog, **upload một
tệp**, **đăng ký một passkey**), xem Console. Không có dòng "Report Only" nào thì
đổi tên key trong `apps/frontend-main/next.config.js` thành
`Content-Security-Policy`.

> Đợt này thêm một script NỘI TUYẾN trong `pages/_document.tsx` (chống nháy màu).
> CSP thật sẽ chặn nó trừ khi có `'unsafe-inline'` hoặc một nonce. Xử lý trước
> khi bật, nếu không mọi lần tải trang đều nháy trắng ở chế độ tối.

### 1.5 Kiểm giao diện bằng MẮT — 🟠 CHƯA LÀM

Đợt tái cấu trúc giao diện được canh bằng cổng tương phản tự động
(`packages/ui/test/contrast.test.ts`, 68 phép kiểm) và E2E, nhưng **chưa ai nhìn
thấy nó bằng mắt**. Cổng đó chứng minh màu đủ tương phản; nó không chứng minh bố
cục đẹp hay khoảng cách hợp lý.

Cần rà tay ở cả hai chế độ, ưu tiên: trang chủ · `/blog/[slug]` (mục lục mới) ·
`/login` · `/settings/security` · `/admin/projects` · `/trust`.

### 1.6 Xoá cột `User.keycloakId` — 🟡 CHỜ mã mới lên sóng

Hoãn khỏi đợt phát hành trước có chủ đích (xem §0). Khi `tsudev-backend` đã chạy
mã mới và không còn tiến trình nào dùng schema cũ:

```bash
# bỏ trường keycloakId khỏi packages/db/prisma/schema.prisma, rồi:
npm --workspace packages/db exec -- prisma migrate dev --name drop_keycloak_id
```

Mọi giá trị trong cột đều NULL và không dòng mã nào đọc nó, nên đây thuần tuý là
dọn dẹp — không có dữ liệu nào mất.

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` — chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Nó vẫn mô tả
  Keycloak. Mã nguồn là hiện trạng.
