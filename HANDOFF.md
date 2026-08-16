# Phiếu bàn giao — sau đợt xác thực tự quản lý và tái cấu trúc giao diện (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> xác thực/phân quyền là [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở**, không lặp lại kiến thức đã nằm trong `docs/` hay `CLAUDE.md`.

## 🔴 Đọc §0.5 TRƯỚC TIÊN

**Production hiện KHÔNG đăng nhập được** — tài khoản ADMIN duy nhất chưa có mật
khẩu. Đó là việc chặn, và nó chặn cả việc nghiệm thu mọi thứ vừa phát hành. Mọi
mục khác trong §1 đều đợi được.

Thứ tự đề nghị cho phiên mới:

1. §0.5 — đặt mật khẩu production, đăng nhập, mở `/admin/projects`.
   Chưa xong bước này thì không nghiệm thu được gì, kể cả các mục dưới.
2. §1.7 **đợt A** — dựng trang quản lý tài khoản (`/settings/profile` + đổi mật
   khẩu + ảnh đại diện). Đây là khoảng trống LỚN NHẤT về mặt sản phẩm: hiện
   không có route nào cho người dùng sửa hồ sơ của chính mình, và ba cột
   `displayName` / `avatarUrl` / `bio` không có đường ghi nào.
3. §1.5 — rà giao diện bằng mắt ở cả hai chế độ (chưa ai nhìn). Làm sau §1.7 thì
   rà được luôn các trang mới thay vì rà hai lần.
4. Còn lại theo mức độ: §1.1 ping giữ ấm · §1.4 CSP · §1.3 npm audit · §1.6 xoá
   cột · §1.7 **đợt B** (đổi email, xoá tài khoản — cần test đầy đủ).

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

## 0.5 🔴 VIỆC ĐẦU TIÊN CỦA PHIÊN MỚI — production KHÔNG đăng nhập được

**Tài khoản ADMIN duy nhất trên production chưa có mật khẩu.** Đã kiểm trực tiếp
trên Neon:

```
username: tsudev · email: devnguyentrangtinhsu@gmail.com · vai trò: ADMIN
passwordHash: RỖNG          ← nguyên nhân
lastLoginAt : chưa bao giờ
failedLoginCount: 0
```

### Triệu chứng và cách đọc nó

Đăng nhập ở https://tsudev.com/login báo **"Tên đăng nhập hoặc mật khẩu không
đúng"** — dù tên đăng nhập và mật khẩu đều đúng ý người dùng. Vì
`verify-credentials` rơi vào nhánh:

```ts
if (!user || !user.passwordHash) { await burnTiming(password); ... return 401 'invalid_credentials' }
```

Thông điệp **cố ý giống hệt** trường hợp sai mật khẩu (chống dò tài khoản). Ở
đây nó quay lại chống chính chủ tài khoản: nó giấu mất nguyên nhân thật.

**Dấu hiệu phân biệt hai nhánh:** `failedLoginCount` vẫn **0** sau nhiều lần
thử. Nhánh "không có mật khẩu" KHÔNG gọi `noteAccountFailure()`; nếu mật khẩu
sai thật thì bộ đếm đã tăng. Dùng dấu hiệu này để chẩn đoán, đừng đoán từ
thông điệp trên màn hình.

### Vì sao xảy ra

Chủ dự án đã chạy `set-password.js` và thấy báo "thành công" — **thành công
thật, nhưng trên DB LOCAL**. Script nạp `DATABASE_URL` từ `.env` ở gốc repo,
vốn trỏ cluster dev `localhost:5433`, và bản đầu **không in ra đang ghi vào đâu**.

Đã vá hai lần trong phiên trước (xem "Thay đổi chưa commit" bên dưới):
script nay in host của database trước khi ghi, và nhận mật khẩu qua **stdin**
thay vì biến môi trường.

Lần vá thứ hai vì lý do riêng: mật khẩu của chủ dự án chứa dấu nháy đơn, nên
`NEW_PASSWORD='…'` đóng chuỗi sớm và bash rơi vào dấu nhắc `>`.

### Cách sửa

Chạy trên máy có `backup/production-env-2026-08-16.txt` (dán cả ba dòng):

```bash
set -a && . <(grep '^DATABASE_URL=' backup/production-env-2026-08-16.txt) && set +a && node services/auth-service/scripts/set-password.js tsudev <<'MK'
mật khẩu ở đây, gõ nguyên văn, KHÔNG thêm dấu nháy
MK
```

`<<'MK'` có nháy quanh `MK` là phần quan trọng — nó tắt mọi phép diễn giải của
shell bên trong khối, nên dấu nháy đơn/`$`/backtick trong mật khẩu đều an toàn.
Đã kiểm chứng vòng tròn: pipe vào rồi `verifyPassword()` đọc ra khớp nguyên văn,
và bản thiếu 1 ký tự bị từ chối.

**Đọc dòng `Database:` nó in ra** — phải là host `...neon.tech`. Thấy
`localhost:5433` là phần export chưa chạy.

Đường thay thế, không cần shell: **https://tsudev.com/forgot-password**. Email
của tài khoản là địa chỉ thật và Resend đã cấu hình, nên đường này chạy được và
xác minh luôn email (hiện `emailVerifiedAt` đang rỗng).

### Nghiệm thu sau khi sửa

```bash
# phải trả 200 và Set-Cookie phiên
curl -s -o /dev/null -w '%{http_code}\n' https://tsudev.com/api/auth/session
```

Rồi đăng nhập thật và mở `/admin/projects` — đó là đường đã im lặng trả 401 suốt
thời gian dài và là thứ đợt vừa rồi vá.

---

## 0.6 Trạng thái repo khi bàn giao

- `main` = `origin/main`, **cây làm việc sạch**, không còn nhánh tạm nào.
- Bốn PR đã gộp: #1 (đợt lớn) · #2 (`AUTH_SERVICE_URL` cho Worker) · #3 (bàn
  giao) · #4 (vá `set-password.js`).
- Cả bốn cổng gốc và 195 test JS + 9 test Rust + 11 E2E đều xanh ở lần chạy cuối.
- Production đang chạy mã của `main`. Neon đã áp dụng 8 migration.

**KHÔNG có thay đổi nào đang treo ở cây làm việc.** Mọi thứ đã ở trên remote.

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

### 1.7 KHÔNG CÓ trang quản lý tài khoản / thông tin cá nhân — 🟠 CHƯA LÀM

Đây là khoảng trống lớn nhất còn lại về mặt sản phẩm, không phải một chi tiết
thiếu. `/settings/security` chỉ có 2FA và passkey — nó được dựng để hai cơ chế
đó không thành mã chết, chứ không phải để quản lý tài khoản.

#### Hiện trạng đã đo

**Không có route nào cho phép người dùng sửa hồ sơ của chính mình.** Mọi
`prisma.user.update` trong repo chỉ thuộc bốn nhóm, không nhóm nào do người dùng
chủ động gọi:

| Nơi                     | Sửa gì                                      |
| ----------------------- | ------------------------------------------- |
| `auth-service`          | `emailVerifiedAt`, `passwordHash` (đặt lại) |
| `auth-service/throttle` | bộ đếm sai / `lockedUntil` / `lastLoginAt`  |
| `trust-service`         | trừ `credits` khi nộp đơn cấp dấu           |

Hệ quả trên ba cột đang tồn tại trong schema:

- **`displayName`** — đặt một lần lúc đăng ký (hoặc mặc định bằng username), sau
  đó KHÔNG có đường nào đổi. Nó lại là thứ hiển thị công khai dưới mỗi bài viết
  (`authorCard` của content-service).
- **`avatarUrl`** — chỉ xuất hiện trong khai báo kiểu và trong `authorCard`.
  Không có gì GHI vào nó.
- **`bio`** — grep toàn bộ `services/`, `apps/`, `packages/`: không nơi nào đọc.
  Cột chết, chỉ được `seed.js` điền một lần.

Cũng không có `/admin/users` — quản trị chỉ có dự án và con dấu.

#### Vì sao thành ra thế

Site vốn dùng Keycloak, nơi bảng `User` được `resolveUser()` tự tạo ÂM THẦM từ
token — không ai "có tài khoản" theo nghĩa sản phẩm, chỉ có một dòng dữ liệu để
gắn quyền. Không có đăng ký thì cũng không có gì để quản lý.

Khái niệm tài khoản chỉ thành thật ở đợt vừa rồi, khi thêm đăng ký/mật khẩu/2FA/
passkey. Trang quản lý tài khoản là hệ quả trực tiếp của thay đổi đó nhưng nằm
ngoài phạm vi được giao, nên không được dựng.

#### Cần làm gì

Đề nghị chia hai đợt. **Đợt A** không có rủi ro chiếm tài khoản, làm trước:

| Mảnh                | Ghi chú                                                         |
| ------------------- | --------------------------------------------------------------- |
| `/settings/profile` | `displayName`, `bio`, ảnh đại diện                              |
| Đổi mật khẩu        | `POST /api/identity/change-password`, **đòi mật khẩu hiện tại** |
| Ảnh đại diện        | storage-service + presign đã có sẵn, chỉ cần nối vào            |

Đổi mật khẩu phải đòi mật khẩu hiện tại: cookie phiên bị đánh cắp KHÔNG được
phép đủ để đổi mật khẩu. Xong thì tăng `sessionVersion` để đá mọi phiên khác.
Khuôn có sẵn — `totp/disable` đã làm đúng kiểu đó.

Đường ghi đi qua proxy CÓ PHIÊN `pages/api/account/[...path].ts`, không phải
`pages/api/identity/[...path].ts` (proxy công khai). Hai tệp, hai mức bảo vệ —
thêm nhầm nhánh là mở một route đáng lẽ phải đăng nhập.

**Đợt B** chạm vào chiếm tài khoản và nghĩa vụ ở `/privacy`, làm riêng có test
đầy đủ:

| Mảnh              | Cạm bẫy                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đổi email         | phải xác minh địa chỉ MỚI trước khi thay. Thay trước rồi mới gửi thư xác minh là đường chiếm tài khoản: kẻ chiếm phiên đổi email sang của mình rồi dùng "quên mật khẩu". |
| Xem/thu hồi phiên | cơ chế đã có (`sessionVersion`), chỉ thiếu giao diện                                                                                                                     |
| Xoá tài khoản     | `Post.authorId` và `FileObject.ownerId` đều `onDelete: SetNull` nên xoá được mà không mất nội dung. Nhớ xoá kèm passkey/TOTP/mã dự phòng — `onDelete: Cascade` đã lo.    |

#### Thứ tự

Làm SAU §0.5. Chưa đăng nhập được vào production thì không thử được bất kỳ trang
tài khoản nào — mà đây đúng là loại tính năng chỉ lộ lỗi khi bấm thật.

### 1.8 Cân nhắc: đường chẩn đoán cho tài khoản không có mật khẩu — 🟡

Thông điệp đăng nhập cố ý không phân biệt "không có tài khoản" / "sai mật khẩu"
/ "tài khoản chưa đặt mật khẩu". Đúng về chống dò tài khoản, nhưng §0.5 cho thấy
nó làm chính chủ tài khoản mắc kẹt và mất nhiều lượt mới chẩn đoán ra.

KHÔNG sửa bằng cách nới thông điệp ra — đó là đánh đổi sai. Hai hướng an toàn:

- Ghi log ở auth-service khi rơi vào nhánh `!user.passwordHash` (có username),
  để người vận hành đọc được mà người ngoài thì không.
- Trang `/login` thêm gợi ý trung tính kiểu "Tài khoản mới hoặc chưa từng đặt
  mật khẩu? Dùng Quên mật khẩu." — không tiết lộ gì về một tài khoản cụ thể.

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` — chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Nó vẫn mô tả
  Keycloak. Mã nguồn là hiện trạng.
