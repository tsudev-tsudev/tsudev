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

### Trước khi gộp — bốn việc phải làm TAY ở production

Không có việc nào trong số này làm được từ repo:

1. **Xoá service `tsudev-sso` trên Render.** Gỡ khỏi `render.yaml` KHÔNG xoá
   service đang chạy; nó vẫn tiêu giờ instance của tài khoản.
2. **Đặt ba secret mới** cho `tsudev-backend` và Worker:
   `INTERNAL_IDENTITY_SECRET` (≥32 ký tự, **giống nhau ở cả hai**),
   `TOTP_ENCRYPTION_KEY` (≥32 ký tự), `RESEND_API_KEY`.
3. **Xác minh tên miền `tsudev.com` bên Resend.** Chưa có thì luồng quên mật
   khẩu im lặng không gửi thư — có cảnh báo ở log, không có lỗi cho người dùng
   (phản hồi luôn giống nhau để không dò được tài khoản).
4. **Đặt mật khẩu cho tài khoản production.** Tài khoản tạo từ thời Keycloak
   không có `passwordHash`:

   ```bash
   NEW_PASSWORD='…' node services/auth-service/scripts/set-password.js tsudev
   ```

   Tài khoản `tsudev` có email thật nên cũng dùng được "quên mật khẩu". Tài
   khoản do `resolveUser()` tạo mang email `@tsudev.local` — tên miền không nhận
   được thư, nên **chỉ** vào được bằng script trên.

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

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` — chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Nó vẫn mô tả
  Keycloak. Mã nguồn là hiện trạng.
