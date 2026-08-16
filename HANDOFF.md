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

## 0. ~~Phát hành~~ — ✅ XONG 16/08

PR #1 (20 commit) và PR #2 đã gộp vào `main`; production đang chạy mã mới.

Thứ tự đã thực hiện — **không được đảo ở lần sau**:

1. `prisma migrate deploy` lên Neon (2 migration, đều thuần tính cộng).
   Nghiệm thu ngay sau đó: site chạy mã CŨ vẫn liệt kê bài viết thật.
2. Gộp PR ⇒ Render tự dựng `tsudev-backend` (~160s).
   Dấu hiệu đã lên mã mới: `/health` trả `bundled` có `identity`.
3. `npm --workspace apps/frontend-main run deploy`.

### Nghiệm thu đã chạy

| Kiểm                                                     | Kết quả                    |
| -------------------------------------------------------- | -------------------------- |
| Bảy trang công khai                                      | 200                        |
| `/api/auth/providers`                                    | chỉ `credentials, passkey` |
| Blog còn nội dung thật                                   | 3 bài                      |
| Endpoint công khai của con dấu + JWKS                    | 200                        |
| Rate limit không chặn quá tay                            | 30/30 qua                  |
| `POST /api/identity/register` với username sai định dạng | **400 `invalid_username`** |

Phép kiểm cuối là phép kiểm QUAN TRỌNG NHẤT, và nó được chọn có lý do: thử đăng
nhập bằng mật khẩu sai cho ra 401 — nhưng cổng `INTERNAL_API_TOKEN` bị thiếu
cũng cho ra đúng 401 ở tầng NextAuth, nên phép thử đó **không phân biệt được**
"mật khẩu bị từ chối" với "request chưa bao giờ tới auth-service". `400
invalid_username` thì chỉ có thể đến từ route handler của auth-service.

### ⚠️ Vết đã trả giá ở chính lần phát hành này

`wrangler.jsonc` **KHÔNG** được `topology:gen` sinh ra và `topology:check`
trước đó **không** nhìn nó. Thêm `auth-service` vào `config/topology.json` vì
thế không kéo theo `AUTH_SERVICE_URL` cho Worker ⇒ `lib/services.ts` rơi về
`http://localhost:4004` ⇒ Worker gọi vào chính nó ⇒ **đăng nhập hỏng hoàn
toàn**, trong khi `/api/auth/providers` vẫn trả về đúng nên nhìn qua tưởng xong.

Đã vá ở PR #2, và `topology:check` nay canh luôn tệp đó (đã kiểm chứng nó báo
mã thoát 1 khi thiếu biến). **Thêm service mới ⇒ vẫn phải khai biến ở
`wrangler.jsonc` bằng tay**, chỉ khác là nay quên sẽ bị chặn.

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

Hoãn khỏi đợt phát hành trước có chủ đích (xem §0). Cột vẫn còn trong schema,
nên Prisma Client đang chạy ở production VẪN SELECT nó.

⚠️ **Với `DROP`, thứ tự NGƯỢC với `ADD`.** Thêm cột thì migration đi trước, code
đi sau. Xoá cột thì **code phải đi TRƯỚC**:

1. Bỏ trường `keycloakId` khỏi `packages/db/prisma/schema.prisma`, tạo migration,
   nhưng **chưa chạy nó lên production**.
2. Phát hành code mới (Render + Worker). Từ lúc này không tiến trình nào còn
   SELECT cột đó.
3. Mới chạy `prisma migrate deploy` lên Neon.

Đảo lại là `GET /api/posts` 500 ⇒ `lib/api.ts` nuốt thành `[]` ⇒ **trang trống**.

Mọi giá trị trong cột đều NULL và không dòng mã nào đọc nó, nên đây thuần tuý là
dọn dẹp — không có dữ liệu nào mất.

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` — chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Nó vẫn mô tả
  Keycloak. Mã nguồn là hiện trạng.
