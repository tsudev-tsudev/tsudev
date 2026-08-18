# Phiếu bàn giao - sau đợt xác thực tự quản lý và tái cấu trúc giao diện (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> xác thực/phân quyền là [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở**, không lặp lại kiến thức đã nằm trong `docs/` hay `CLAUDE.md`.

## Bắt đầu từ đâu

⛔ **VIỆC CHẶN ĐÃ QUAY LẠI, và nó nằm ở PRODUCTION chứ không ở mã.** Backend
Render thiếu (hoặc đặt ngắn hơn 32 ký tự) biến `INTERNAL_IDENTITY_SECRET`. Đo
19/08/2026:

```
POST https://tsudev-backend.onrender.com/api/trust/programs
  → 503 {"error":"Máy chủ chưa cấu hình xác thực"}
```

Nghĩa là **mọi đường ghi đã xác thực trên toàn site đang hỏng**, không riêng Con
dấu. Sửa: đặt lại biến đó ở dashboard Render, dài **≥ 32 ký tự** và **trùng
nguyên văn** secret cùng tên của Worker (Worker đã có, đã kiểm bằng
`wrangler secret list`).

Ba điều khiến lỗi này sống sót lâu đến thế - đáng đọc trước khi sửa cái khác:

1. **Nó có từ trước đợt 3.** Đợt 3 chỉ làm nó lộ ra, vì trước đó
   `/api/trust/directory` là công khai nên không đi qua tầng xác thực nào.
2. **Ba service kia che mất nó.** `/api/posts`, `/api/presign`,
   `/api/admin/projects` đều dính cổng `INTERNAL_API_TOKEN` TRƯỚC và trả 401,
   nên request không bao giờ tới được tầng danh tính để lộ 503.
3. **Đăng nhập vẫn chạy bình thường** - đăng nhập không dùng khẳng định danh
   tính, nên nó không chứng minh gì về biến này.

⚠️ **Phép chẩn đoán duy nhất không bị che: `GET /api/trust/programs` trên
backend.** trust-service cố ý đứng ngoài `INTERNAL_API_TOKEN`, nên nó là endpoint
duy nhất đi thẳng tới tầng danh tính. 503 = thiếu khoá · 401 = khoá đúng, chỉ
thiếu danh tính (đây mới là trạng thái lành mạnh).

⚠️ **Đừng phát hành Worker frontend trước khi sửa xong.** Đợt 3 đã lên backend,
nên khi Worker mới lên thì mọi trang `/trust/*` sẽ gọi vào một API đang 503 - kể
cả tài khoản VIP.

Thứ tự đề nghị:

1. **Sửa `INTERNAL_IDENTITY_SECRET` ở Render**, nghiệm thu bằng phép chẩn đoán ở
   trên (phải chuyển từ 503 sang 401).
2. **PHÁT HÀNH frontend Worker.** Nó đang mang mã CŨ: `/trust/redeem` và
   `/admin/newsroom` còn 404, `sitemap.xml` còn 2 dòng `/trust/`. Lệnh:
   `npm --workspace apps/frontend-main run deploy` (ĐỪNG gọi thẳng
   `opennextjs-cloudflare deploy` - lý do ở `CLAUDE.md`). Đợt 2 và đợt 3 lên
   cùng một lượt vì cả hai đã ở `main`.
   Nghiệm thu: `/trust/redeem` 200 · `/trust/directory` với khách chưa đăng nhập
   là CHUYỂN HƯỚNG chứ không phải 200 · `sitemap.xml` không còn `/trust/`.
3. **Deploy Worker cron** (§1.1 - CHƯA từng deploy, đã đo bằng
   `wrangler deployments list`). Không cần `NEWSROOM_TICK_TOKEN` cho việc giữ ấm.
4. **§1.7 đợt A - trang quản lý tài khoản.** Khoảng trống lớn nhất về sản phẩm:
   không có route nào cho người dùng sửa hồ sơ của chính mình.
5. **§1.5 - rà giao diện bằng MẮT.** Chưa ai nhìn.
6. Còn lại: §1.4 CSP · §1.3 npm audit · §1.7 đợt B · §1.8.

## Đang chạy

`https://tsudev.com` đã lên sóng.

| Thành phần       | Ở đâu                   | Ghi chú                                                 |
| ---------------- | ----------------------- | ------------------------------------------------------- |
| `frontend-main`  | Cloudflare Workers      | `tsudev.com` + `www.tsudev.com`                         |
| `tsudev-backend` | Render **singapore**    | gộp content + storage + trust + identity + **newsroom** |
| PostgreSQL       | Neon **ap-southeast-1** | DB `neondb`                                             |

Biến môi trường/secret production: **`backup/production-env-2026-08-16.txt`**
(đã gitignore VÀ dockerignore, không commit).

Ba thứ mất là không sinh lại được:

- `TRUST_SIGNING_KEY` - mất là chứng chỉ đã cấp không xác minh nổi.
- `TOTP_ENCRYPTION_KEY` - mất là mọi thiết bị 2FA đang dùng hỏng.
- `INTERNAL_IDENTITY_SECRET` - sinh lại được, nhưng phải đổi ĐỒNG THỜI ở
  Cloudflare Workers và Render; lệch nhau là mọi đường ghi trả 401.

---

## 0. ~~Phát hành~~ - ✅ XONG 16/08

PR #1 (20 commit) và PR #2 đã gộp vào `main`; production đang chạy mã mới.

Thứ tự đã thực hiện - **không được đảo ở lần sau**:

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
nhập bằng mật khẩu sai cho ra 401 - nhưng cổng `INTERNAL_API_TOKEN` bị thiếu
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

## 0.5 ~~Production không đăng nhập được~~ - ✅ XONG 17/08

Đã kiểm trực tiếp trên Neon: `tsudev` có `passwordHash`, `lastLoginAt` =
2026-08-17T13:33:18Z. Chủ dự án đã đặt mật khẩu và đăng nhập thành công.

`emailVerifiedAt` vẫn rỗng - không chặn gì, nhưng luồng "quên mật khẩu" sẽ xác
minh luôn nếu chạy qua nó một lần.

### Bài học giữ lại (đây là lý do mục này không bị xoá hẳn)

Sự cố gốc: `set-password.js` nạp `DATABASE_URL` từ `.env` ở gốc repo (trỏ DB
dev) và **không in ra đang ghi vào đâu**, nên nó báo "thành công" trong khi
production vẫn rỗng.

Hai dấu hiệu chẩn đoán, dùng lại được cho mọi sự cố đăng nhập:

- **`failedLoginCount` vẫn 0** sau nhiều lần thử ⇒ đang rơi vào nhánh "tài khoản
  không có mật khẩu", KHÔNG phải nhánh sai mật khẩu. Nhánh đó không gọi
  `noteAccountFailure()`.
- Thông điệp trên màn hình **cố ý không phân biệt** ba trường hợp (không có tài
  khoản / sai mật khẩu / chưa đặt mật khẩu) để chống dò tài khoản. Đừng chẩn
  đoán từ nó.

Script nay in host của database trước khi ghi, và nhận mật khẩu qua stdin
(heredoc) nên dấu nháy đơn trong mật khẩu không làm hỏng lệnh. Cách chạy nhắm
production: `docs/auth.md` §5.

## 0.6 Trạng thái repo khi bàn giao

- **14 PR đã gộp.** Gần nhất: #12 (mã mời), #13 (service Render trùng), #14
  (Toà soạn Agent AI).
- Bốn cổng gốc xanh. Số test **chưa đếm lại** kể từ phiên 3 (lúc đó: 219 test JS
  · 9 test Rust · 13 E2E) - Toà soạn thêm test riêng, con số cũ đã thấp hơn thật.
- ⚠️ **"Production đang chạy mã của `main`" nay chỉ đúng một nửa**: backend
  Render thì đúng, frontend Worker thì chưa (§0.9). Số migration Neon cũng chưa
  đo lại.

---

## 0.10 Bàn giao phiên 5 (18/08/2026) - ĐỌC TRƯỚC

### Đã làm: §1.9 đợt 3 - gác bề mặt Con dấu + SEO + điều hướng

Nhánh **`feat/trust-surface-gating`** (chưa push, chưa có PR). Nó nằm CHỒNG lên
`fix/admin-noindex-unauth` của phiên 4, nhánh cũng chưa push - nên PR của nhánh
này sẽ mang theo cả hai đợt công việc.

Con dấu nay chạy ở chế độ mời thật sự:

| Tầng                 | Trước                                                  | Sau                                                                                                        |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `trust-service`      | mặc định CÔNG KHAI, `AUTH_PREFIXES` khai 5 nhánh riêng | mặc định ĐÓNG: `rateLimit → auth → requireRole('VIP')` cho cả `/api/trust`, miễn trừ đúng `/health` + JWKS |
| proxy `/api/trust/*` | `PUBLIC_PREFIXES` 5 nhánh mở                           | không còn nhánh mở; `ALLOWED_PREFIXES` mặc-định-đóng                                                       |
| 7 trang `/trust/*`   | 4 trang không kiểm phiên                               | gác ở `getServerSideProps` qua `lib/trustGate.ts`                                                          |
| `/trust`             | trang giới thiệu công khai                             | trang MỜI cho khách · nội dung thật cho VIP                                                                |
| điều hướng           | luôn hiện                                              | `SiteHeader` 1 mục + `SiteFooter` 3 mục lọc theo vai trò                                                   |
| `sitemap.xml`        | 5 nhóm `/trust/*`                                      | không còn dòng nào                                                                                         |
| `robots.txt`         | `Disallow` /admin, /trust/apply, /trust/portal         | chỉ còn `Disallow: /api/` (xem §0.9 việc 3)                                                                |

**Thứ hai chỗ kế hoạch không lường trước, cả hai tìm ra bằng cách grep cả cây
thay vì đọc danh sách tệp đoán trước** - đúng bài học §0.7:

1. **Trang chủ** (`pages/index.tsx`) gọi `trust.directory()` và hiển thị nguyên
   một khối "Website mang dấu tsudev" + chỉ số "Website đã cấp dấu". Kế hoạch
   chỉ liệt kê các trang `/trust/*`. Đã gỡ khối đó, gỡ lời gọi, và đổi CTA
   "Đăng ký cấp dấu" thành "Tìm hiểu con dấu".
2. **`applicationSubmit.test.ts`** tạo người nộp đơn ở vai trò `MEMBER`, nên
   5 test đỏ ngay khi cổng VIP dựng lên. Đã nâng lên `VIP` và **thêm một test
   ngược lại**: MEMBER nộp đơn phải nhận 403, đơn phải còn ở DRAFT.

Bốn thứ đã cân nhắc và cố ý làm:

- **Rate limit chuyển lên TRƯỚC cổng danh tính.** `requireRole` đọc `User.role`
  bằng một truy vấn Postgres, nên đặt sau nó nghĩa là mỗi request rác không có
  token vẫn tạo một truy vấn - Neon free tính tiền bằng CU-giờ (§0.9 việc 4).
- **Mã nhúng huy hiệu nay nói thẳng** rằng khách vãng lai sẽ thấy ảnh hỏng, vì
  `/api/trust/seal/*.svg` đã nằm sau cổng. Đây là hệ quả đã chốt (0 chứng chỉ
  đang chạy), không phải lỗi - nhưng đưa mã nhúng mà không nói là để khách hàng
  tự phát hiện bằng cách hỏng trên site của họ.
- **`Referer`/`Origin` không còn được chuyển tiếp** ở proxy. Cơ chế phát hiện
  huy hiệu gắn sai tên miền dựa vào chúng nay vô nghĩa (chỉ người đã đăng nhập
  mới tải được huy hiệu); để lại là để một lớp phòng thủ giả nằm trong mã.
- **`/trust` và `/trust/redeem` KHÔNG bị gác.** `/trust` là đích của mọi chuyển
  hướng nên nó phải trả lời được "vì sao tôi không vào được"; `/trust/redeem` là
  đường vào lại. Gác một trong hai là tự khoá mình ra ngoài.

### Bẫy vai trò cũ đã được vá thêm một lớp

`token.role` chỉ ghi ở lần đăng nhập đầu, nên người vừa đổi mã mời vẫn bị coi là
MEMBER cho tới khi phiên làm mới. `/trust/redeem` đã gọi `update()` từ đợt 2;
phiên 5 thêm: trang mời `/trust` **tự gọi `update()` một lần** rồi tải lại trang
nếu vai trò đổi. Không có lớp này thì người tới `/trust` bằng liên kết cũ sau khi
đổi mã sẽ thấy đúng màn hình "bạn cần mã mời" - trông y hệt như mã không có tác
dụng.

### Cổng kiểm đã chạy ở cuối phiên 5

| Cổng                                                     | Kết quả                                     |
| -------------------------------------------------------- | ------------------------------------------- |
| `format:check` · `lint` · `typecheck` · `topology:check` | xanh cả bốn                                 |
| `npm --workspace services/trust-service test`            | **57 test xanh** (thêm 12 so với trước)     |
| `npm --workspace packages/ui test`                       | 68 xanh                                     |
| `npm --workspace apps/frontend-main test`                | 19 xanh                                     |
| **E2E `--project=app`**                                  | **20 xanh**, chạy thật với stack dev đầy đủ |

E2E thêm bốn khẳng định mới trong `smoke.spec.js`: khách chỉ thấy trang mời và
thẻ `noindex` · ba trang khác chuyển hướng về `/login` · tài khoản MEMBER bị đá
về `/trust` · VIP (`bob`) thấy nội dung thật · `sitemap.xml` không còn `/trust/`.

⚠️ Test MEMBER **tự đăng ký một tài khoản mới** thay vì dùng `alice`:
`invite.spec.js` nâng alice lên VIP khi nó chạy, và hai tệp spec không có thứ tự
đảm bảo. Một test chỉ xanh khi tệp khác chưa chạy là một test nói dối.

### Trạng thái máy dev khi bàn giao

- **Postgres user-space đang CHẠY ở 5433** (phiên 5 khởi động bằng `npm run
db:up`). MinIO không chạy - E2E `full-stack` vì thế chưa chạy được.
- DB dev đã dọn sau E2E: `alice` trả về `MEMBER`, tài khoản `e2e-member-*` và
  mã mời nhãn `E2E …` đã xoá. Dữ liệu demo con dấu (`seed-demo.js`) vẫn còn -
  test danh bạ cần nó.
- Bốn nhánh cục bộ chưa push: `feat/trust-surface-gating` (phiên 5),
  `fix/admin-noindex-unauth` (phiên 4), `feat/minio-user-space`,
  `fix/dev-canonical-host`. `main` cục bộ vẫn đứng sau `origin/main` 19 commit.

### Việc kế tiếp cần chủ dự án

1. Duyệt và push nhánh này (chưa push theo quy ước "xin xác nhận trước khi
   push").
2. Phát hành theo đúng thứ tự ở mục "Bắt đầu từ đâu": Worker mang đợt 2 lên
   trước, cấp + đổi thử một mã mời, RỒI mới đợt 3.
3. Sau khi đợt 3 lên sóng, nghiệm thu bằng lệnh trong
   `docs/refactor-trust-invite-access.md` §Phần D: `sitemap.xml` không còn
   `/trust/`, và `/trust/directory` với khách chưa đăng nhập phải là chuyển
   hướng chứ không phải 200.

---

## 0.9 Bàn giao phiên 4 (18/08/2026)

### Production đang lệch nhịp: backend MỚI, Worker CŨ

Đo trực tiếp 18/08, không suy đoán:

| Phép đo                              | Kết quả                                                | Nghĩa là           |
| ------------------------------------ | ------------------------------------------------------ | ------------------ |
| `tsudev-backend.onrender.com/health` | `bundled: content, storage, trust, identity, newsroom` | Render chạy mã mới |
| `tsudev.com/trust`                   | 200                                                    | site vẫn sống      |
| `tsudev.com/trust/redeem`            | **404**                                                | Worker chạy mã CŨ  |
| `tsudev.com/admin/newsroom`          | **404**                                                | Worker chạy mã CŨ  |

Nghĩa là **mã mời (đợt 2) và toàn bộ Toà soạn Agent AI đã có ở backend nhưng
chưa có bề mặt** - người dùng không với tới được. Đây là trạng thái nửa vời:
không hỏng cái gì đang chạy, nhưng mọi nghiệm thu "bấm thật" của hai đợt đó đều
chưa làm được.

**Dấu hiệu phát hành đúng cho đợt này** (thứ THAY ĐỔI giữa hai bản - xem §0.7):

```
GET https://tsudev.com/trust/redeem   → 404 ở bản cũ · 200 ở bản mới
```

### Việc 1 - phát hành frontend Worker

1. **Kiểm Neon đã áp migration của đợt 2 + Toà soạn chưa** (`prisma migrate
status` nhắm production). Backend khởi động được **không** chứng minh điều đó:
   nó chỉ nạp module, chưa route nào chạm vào bảng mới. Worker mới lên là người
   dùng chạm ngay.
2. `npm --workspace apps/frontend-main run deploy` - **đừng** gọi thẳng
   `opennextjs-cloudflare deploy` (lý do ở `CLAUDE.md`: `.env.local` thắng
   `.env.production`).
3. Nghiệm thu: `/trust/redeem` trả 200 · đăng nhập `tsudev` · cấp mã ở
   `/admin/trust` · đổi mã bằng tài khoản khác · mở `/admin/newsroom`.

### Việc 2 - Worker cron của Toà soạn có thể đã làm xong §1.1

`infrastructure/newsroom-cron` giữ ấm Render bằng nhịp 5 phút - đúng thứ §1.1
cần. **Chưa đo trong phiên này** đã deploy hay chưa; kiểm bằng
`npx wrangler deployments list` trong thư mục đó. Nếu đã deploy thì đóng §1.1;
nếu chưa, deploy nó rẻ hơn dựng UptimeRobot.

⚠️ **Nếu đã deploy bản cũ thì PHẢI deploy lại** (`npm run cron:deploy`): phiên 4
tách Worker này thành **hai nhịp** vì một hạn mức chưa ai tính tới. Xem mục
ngay dưới.

### Việc 4 - hạn mức Neon là chỗ chật nhất, và cron cũ sẽ phá nó

Neon free cho **100 CU-giờ/tháng** và tự ngủ sau ~5 phút không có truy vấn. Cron
cũ gọi `POST /api/newsroom/tick` (có truy vấn database) đúng **mỗi 5 phút** -
tức đánh thức lại ngay trước mỗi lần Neon định ngủ. Compute thức 24/7 ở 0,25 CU
là `0,25 × 744 = 186` CU-giờ/tháng, **gần gấp đôi hạn mức**. Vượt là Neon treo
compute tới đầu tháng sau và **cả site chết**, không riêng toà soạn.

Đã vá trong phiên 4: Worker cron nay phân nhánh theo `event.cron`.

| Nhịp          | Gọi gì                    | Chạm DB? | Việc          |
| ------------- | ------------------------- | -------- | ------------- |
| `*/5 * * * *` | `GET /health`             | Không    | giữ ấm Render |
| `7 * * * *`   | `POST /api/newsroom/tick` | **Có**   | nhịp toà soạn |

Ngân sách chật thứ hai, **chưa vá vì là đánh đổi sản phẩm**: giữ ấm 24/7 tiêu
744 trên 750 giờ instance của Render trong tháng 31 ngày - biên còn 6 giờ, và
hạn mức đó tính cho CẢ workspace. Thêm bất kỳ service free thứ hai chạy vài giờ
là Render tạm dừng **mọi** service free tới đầu tháng sau. Cách nới duy nhất là
ngừng giữ ấm trong một khung giờ đêm (~150 giờ/tháng), đổi lấy cold start ~50
giây cho người truy cập đầu tiên sau khung đó.

Toàn bộ hạn mức của bảy dịch vụ, các van chi phí và danh sách cấm:
[`docs/free-tier.md`](docs/free-tier.md) (mới, phiên 4).

Cũng trong phiên 4: `render.yaml` **thiếu toàn bộ biến của nhánh newsroom** -
blueprint mô tả một service không còn giống service đang chạy. Đã bổ sung bảy
biến, trong đó `NEWSROOM_ENABLED: 'false'` để literal chứ không `sync: false`:
mặc định của một service dựng lại từ blueprint phải là "không tiêu gì".

### Việc 3 - `noindex` ở nhánh CHƯA ĐĂNG NHẬP (phiên 4 đã làm)

Nhánh `fix/admin-noindex-unauth`, 5 trang. Lỗi gốc: thẻ `Seo … noindex` chỉ được
đặt ở nhánh **đã** đăng nhập, mà trình thu thập thì KHÔNG BAO GIỜ có phiên - nên
thẻ nằm đúng chỗ không ai đọc. Ba trang `/admin/*` đã vá từ trước; phiên 4 quét
cả cây và tìm thêm hai trang cùng lỗi ở nhánh `status === 'loading'`:
`settings/security.tsx` và `trust/redeem.tsx`. Tiện tay sửa hai lỗi nhỏ trong
chính thẻ đó: tiêu đề lặp hậu tố (`Seo` tự nối `- tsudev`) và
`settings/security` thiếu `path` nên `canonical` trỏ về trang chủ.

E2E canh việc này: `e2e/tests/newsroom.spec.js` → `trang không được lập chỉ mục`.

✅ **Đã quyết ở phiên 5 (18/08):** chọn **cho thu thập + `noindex`**.
`pages/robots.txt.ts` nay chỉ còn `Disallow: /api/`; mọi khu vực riêng tư dựa
hẳn vào thẻ `noindex`. Hệ quả bắt buộc, ghi ngay đầu tệp đó: trang riêng tư phải
có `<Seo … noindex />` ở TẤT CẢ các nhánh render (kể cả `loading` và chưa đăng
nhập) - trình thu thập không bao giờ có phiên.

### Trạng thái máy dev khi bàn giao

- **Không có gì đang chạy**: 3000/8080/4001/4004 trống, Postgres 5433 và MinIO
  9000 cũng không. Muốn chạy E2E phải `npm run dev:full` trước.
- `main` cục bộ **đứng sau `origin/main` 19 commit** - chưa fast-forward.
- Nhánh `fix/admin-noindex-unauth` mang theo commit `91c45ca`
  (`fix(dev): hợp nhất địa chỉ local về một host`) **chưa có ở `origin/main`**,
  nên PR của nhánh này sẽ gồm cả nó. Cùng commit đó cũng nằm trên hai nhánh cục
  bộ `feat/newsroom` và `fix/dev-canonical-host`.
- Cổng kiểm chạy ở cuối phiên 4: `format:check` · `lint` · `typecheck` ·
  `topology:check` - **xanh cả bốn**. E2E chưa chạy (không có stack).

---

## 0.8 Bàn giao phiên 3 (18/08/2026) - LỊCH SỬ, đã gộp hết

### ✅ Ba PR của phiên 3 đã gộp

| PR                                                     | Nhánh                           | Nội dung                                       |
| ------------------------------------------------------ | ------------------------------- | ---------------------------------------------- |
| [#12](https://github.com/tsudev-tsudev/tsudev/pull/12) | `feat/trust-invite-codes`       | §1.9 đợt 2 - mã mời. 19 tệp, +1370/−28         |
| [#13](https://github.com/tsudev-tsudev/tsudev/pull/13) | `docs/render-duplicate-service` | §1.10 + chẩn đoán `tsudev-backend-rqkz`. 2 tệp |
| [#14](https://github.com/tsudev-tsudev/tsudev/pull/14) | `feat/newsroom`                 | Toà soạn Agent AI, 5 đợt                       |

`origin/main` = `e4bed3f`. Nhánh `feat/minio-user-space` cũng đã vào `main` -
cảnh báo "chưa có upstream" ở bản trước **không còn hiệu lực**.

### Việc 1 - PHÁT HÀNH đợt 2 (mã mời) - ĐÃ GỘP, CHƯA LÊN WORKER

Mã đã ở trên `main` và backend Render đã dựng lại. Frontend Worker thì **chưa** -
xem §0.9 để biết cách đo và thứ tự phát hành còn lại.

⚠️ Thứ tự đợt này **NGƯỢC** với đợt 1 (đợt 1 là `DROP COLUMN` nên code đi trước;
đợt này là thêm bảng nên migration đi trước):

1. `prisma migrate deploy` lên Neon - thuần tính cộng, hai `CREATE TABLE`, không
   đụng bảng nào đang có. Mã cũ đang chạy không biết hai bảng đó tồn tại.
2. Gộp #12 ⇒ Render dựng lại `tsudev-backend` (~160s).
3. `npm --workspace apps/frontend-main run deploy`.

> ⚠️ **Dấu hiệu phát hành ghi ở bản trước đã SAI, đừng dùng lại.** Bản trước nói
> `POST /api/identity/invite/redeem` trả 401 ở mã mới và 404 ở mã cũ. Trong mã
> đã gộp, `invite/*` **không** nằm trong `ALLOWED` của proxy công khai
> `pages/api/identity/[...path].ts` - nó nằm ở proxy CÓ PHIÊN
> `pages/api/account/[...path].ts` (đúng thiết kế: đổi mã đòi đã đăng nhập). Nên
> đường `/api/identity/invite/redeem` trả **404 ở CẢ hai bản** và không phân
> biệt được gì. Dấu hiệu đúng: xem §0.9.

Nghiệm thu sau khi lên sóng: đăng nhập bằng `tsudev`, cấp một mã ở
`/admin/trust`, đổi nó ở `/trust/redeem` bằng một tài khoản khác. Đây là loại
tính năng **chỉ lộ lỗi khi bấm thật**.

### Việc 2 - §1.9 đợt 3 (gác bề mặt + SEO + điều hướng)

Đợt cuối của kế hoạch, và là đợt **duy nhất có thể khoá nhầm chính mình ra
ngoài**. Làm được rồi vì mã mời đã chạy: có đường vào lại qua `/trust/redeem`.

Chỉ có code, **không migration**. Ba thứ phải sửa **TRONG CÙNG MỘT COMMIT**:
`AUTH_PREFIXES` của trust-service · `PUBLIC_PREFIXES`/`PRIVATE_PREFIXES` của
`pages/api/trust/[...path].ts` · `authCoverage.test.ts`. Lệch một nhịp là hoặc
route riêng tư lộ ra, hoặc trang công khai chết - **cả hai đều im lặng**.

⚠️ Đợt 3 lọc điều hướng theo `session.role`. Vai trò trong phiên **chỉ đúng sau
khi làm mới** - `token.role` của next-auth chỉ được ghi ở lần đăng nhập đầu.
Đường sửa đã có sẵn từ đợt 2 (`POST /api/identity/session-state` + nhánh
`trigger === 'update'` ở callback `jwt`); `/trust/redeem` đã tự gọi `update()`.
Trang nào của đợt 3 dựa vào `session.role` mà không đi qua đường đó sẽ thấy vai
trò cũ.

Kế hoạch đầy đủ + danh sách cổng kiểm bắt buộc:
[`docs/refactor-trust-invite-access.md`](docs/refactor-trust-invite-access.md).

### Việc 3 - §1.10 dọn service Render trùng

10 phút, làm lúc nào cũng được, nằm trong PR #13. Không phải sự cố production.

### Có người khác đang làm song song - ĐỪNG quét chung vào commit của mình

Nhánh **`feat/minio-user-space`** (MinIO user-space cho dev) không phải của phiên
3, xuất hiện trong cây làm việc giữa phiên và đã suýt bị `git add -A` quét vào
PR #12. **Nay đã vào `main`** (`2776c15` là tổ tiên của `origin/main`), nên không
còn rủi ro mất mã.

Bài học dùng lại được: **trước khi commit, đối chiếu danh sách staged với danh
sách tệp mình thực sự sửa.** `git status --short` trước và sau khi làm việc,
hoặc đơn giản là `ls -l --time-style=+%H:%M` để xem mtime - tệp của người khác
có dấu thời gian không khớp với phiên của mình.

### Trạng thái máy dev khi bàn giao

- Postgres user-space đang chạy ở `5433`; migration của đợt 2 **đã áp dụng cục bộ**.
- DB dev đã seed lại; `alice` đã trả về `MEMBER`, mã mời do E2E sinh đã xoá.
- Một stack dev (`3000/4001/4002/4003/4004/8080`) đang chạy từ trước phiên 3.
  E2E chạy bằng `E2E_REUSE_SERVER=1` để bám vào nó - **mặc định là dựng mới**, và
  mặc định đó có lý do (xem chú thích trong `e2e/playwright.config.js`).

### Vết đã trả giá ở phiên 3

- **`gh pr create` gặp GitHub API 503 suốt ~5 phút** trong khi `git push` (HTTPS)
  vẫn chạy bình thường - hai đường khác nhau, GraphQL hỏng riêng. Lần thử đầu trả
  503 **sau khi** đã gửi request, nên phải `gh pr list` kiểm trước khi thử lại,
  nếu không dễ tạo PR trùng. Mất 6 lần thử.
- **Thêm tệp spec E2E mới thì phải khai vào `testMatch`** của một project trong
  `e2e/playwright.config.js`. Playwright **không** tự nhặt; quên là spec đó im
  lặng không bao giờ chạy, và triệu chứng duy nhất là số test không tăng.
- **`docs/testing.md` từng ghi sai** rằng "E2E không chạy trong CI". Project `app`
  **vẫn** chạy ở job `e2e-app`. Đã sửa trong PR #12.

---

## 0.7 Kỹ thuật rút ra từ phiên trước - dùng lại được

Bốn thứ đã trả giá để học, ghi lại để khỏi học lần nữa.

### Dấu hiệu "bản mới đã lên sóng" phải là thứ THAY ĐỔI giữa hai bản

`/health` của backend không đổi giữa các lần phát hành, nên nó chỉ nói "còn
sống", không nói "đã mới". Chọn một trường thật sự khác nhau:

- Đợt gỡ tín dụng: `/api/trust/programs` - mã cũ trả `feeCredits`, mã mới không.
  Chờ nó biến mất (mất ~80 giây) rồi mới chạy migration `DROP`.
- Đợt thêm auth-service: `/health` trả `bundled` có `identity` hay chưa.

Chạy bước phá huỷ trước khi có dấu hiệu này là tự tạo cửa sổ hỏng.

### ⚠️ Đừng truyền DATABASE_URL thật vào `--shadow-database-url`

`prisma migrate diff --shadow-database-url "$DATABASE_URL"` dùng DB đó theo cách
**PHÁ HUỶ** - nó xoá bảng `_prisma_migrations`, và lần `migrate deploy` sau đó
chết với `P3005`. Đã xảy ra với DB dev (dựng lại được bằng `migrate reset`);
nếu lỡ tay trỏ vào production thì hậu quả khác hẳn.

`prisma migrate dev --create-only` từ chối chạy khi không có TTY nếu thay đổi
làm **mất dữ liệu** (`DROP COLUMN`) - đó là lý do phải dùng `migrate diff`. Cách
an toàn: so hai TỆP schema (`--from-schema-datamodel` cũ lấy từ git,
`--to-schema-datamodel` mới), không cần DB nào cả.

### Grep theo TỪ KHOÁ trên cả cây, đừng grep trong danh sách tệp đoán trước

Khảo sát cho đợt gỡ tín dụng đếm "3 trang frontend" vì chỉ quét ba tệp đã biết
tên. Thực tế là 4 - `trust/portal.tsx` lọt lưới. Hai đợt còn lại của §1.9 khảo
sát theo đúng kiểu đó, nên rất dễ lặp lại.

### `wrangler.jsonc` KHÔNG được `topology:gen` sinh ra

Thêm service vào `config/topology.json` **không** kéo theo biến cho Worker. Quên
là biến rơi về `http://localhost:<port>` và Worker gọi vào chính nó. Đã xảy ra
với `AUTH_SERVICE_URL` (đăng nhập hỏng hoàn toàn, trong khi
`/api/auth/providers` vẫn trả đúng nên nhìn qua tưởng xong).

`topology:check` nay canh tệp đó - nhưng nó chỉ kiểm SỰ CÓ MẶT, không kiểm giá
trị. Giá trị vẫn phải điền tay.

---

## 1. Việc còn dở

### 1.1 Dựng bộ ping giữ ấm - 🟠 CHƯA XONG (đã ĐO, không còn phải đoán)

`infrastructure/newsroom-cron` **chưa bao giờ được deploy**. Đo 19/08/2026:

```
$ npx wrangler deployments list      # trong infrastructure/newsroom-cron
✘ This Worker does not exist on your account. [code: 10007]
```

Nghĩa là backend Render **hiện không có nhịp giữ ấm nào** - bản trước của phiếu
này ghi "có thể đã xong", đó là suy đoán và nó sai.

Deploy nó là xong mục này, và **không cần `NEWSROOM_TICK_TOKEN`**: nhánh giữ ấm
chỉ đọc `BACKEND_URL`. Thiếu token thì mỗi giờ có một dòng log lỗi ở nhánh toà
soạn, nhịp 5 phút vẫn chạy đủ.

```
npm run cron:deploy
```

Kể từ 19/08 cả hai nhịp **nghỉ 01:00-06:00 giờ VN** (viết trong cron là giờ UTC
`0-17,23`) để hạ mức tiêu Render từ 744 xuống ~589 trên 750 giờ. Chi tiết và
bảng đánh đổi: [`docs/free-tier.md`](docs/free-tier.md).

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ ~8.600 phút/tháng, vượt xa hạn mức 2.000.

### 1.2 ~~Giới hạn tần suất~~ - ✅ XONG 16/08

- Đường đăng nhập: hai trục (theo IP qua bảng `LoginAttempt`, theo tài khoản qua
  `failedLoginCount`/`lockedUntil`) trong `services/auth-service/src/throttle.ts`.
- Nhánh công khai của con dấu: `services/trust-service/src/rateLimit.ts`, cửa sổ
  trượt trong bộ nhớ tiến trình.

⚠️ **Bộ đếm của trust-service nằm trong RAM và giả định ĐÚNG MỘT tiến trình.**
Giả định đó đúng hôm nay (`backend-bundle` là một tiến trình) và **vỡ** nếu chạy
nhiều bản - lúc đó ngưỡng thực tế nhân lên theo số bản. Chú thích đầu tệp ghi rõ.

### 1.3 `npm audit`: 7 lỗ, 4 mức cao - 🟠 CHƯA LÀM

`sharp` kế thừa CVE của libvips qua `next`; sửa cần nâng lên `next@16` -
breaking. Phải là **đợt riêng có test đầy đủ**, đừng nhét vào commit khác.
`qs` qua `express` thì `npm audit fix` xử lý được, không breaking.

### 1.4 Bật CSP thật - 🟡 CHƯA LÀM

CSP đang ở **`Content-Security-Policy-Report-Only`, CÓ CHỦ ĐÍCH**, không phải
quên. Trình duyệt PUT thẳng lên endpoint R2 bằng URL presign, mà host đó đến từ
biến môi trường chứ không biết được lúc build - bật chặn mù là upload chết **mà
không có lỗi nào phía máy chủ**.

Cách bật: mở site, thao tác thật vài phút (đăng nhập, xem blog, **upload một
tệp**, **đăng ký một passkey**), xem Console. Không có dòng "Report Only" nào thì
đổi tên key trong `apps/frontend-main/next.config.js` thành
`Content-Security-Policy`.

> Đợt này thêm một script NỘI TUYẾN trong `pages/_document.tsx` (chống nháy màu).
> CSP thật sẽ chặn nó trừ khi có `'unsafe-inline'` hoặc một nonce. Xử lý trước
> khi bật, nếu không mọi lần tải trang đều nháy trắng ở chế độ tối.

### 1.5 Kiểm giao diện bằng MẮT - 🟠 CHƯA LÀM

Đợt tái cấu trúc giao diện được canh bằng cổng tương phản tự động
(`packages/ui/test/contrast.test.ts`, 68 phép kiểm) và E2E, nhưng **chưa ai nhìn
thấy nó bằng mắt**. Cổng đó chứng minh màu đủ tương phản; nó không chứng minh bố
cục đẹp hay khoảng cách hợp lý.

Cần rà tay ở cả hai chế độ, ưu tiên: trang chủ · `/blog/[slug]` (mục lục mới) ·
`/login` · `/settings/security` · `/admin/projects` · `/trust`.

### 1.6 ~~Xoá cột `User.keycloakId`~~ - ✅ XONG Ở MÃ 19/08, **migration chờ phát hành**

Gỡ khỏi `schema.prisma` + migration `20260819103000_drop_keycloak_id` (PR #16, đã
gộp). Đã áp lên DB dev; **chưa áp lên Neon**.

⚠️ **Thứ tự bắt buộc, và nó NGƯỢC với khi thêm cột:**

1. ~~Gỡ trường khỏi schema + `db:generate`~~ ✅
2. Phát hành mã mới (Render đã có sau khi gộp; **Worker thì chưa**)
3. Chỉ sau đó mới `npm run db:migrate` nhắm Neon

Bằng chứng cho thấy bước 2-3 an toàn: 268 test xanh trên schema CÒN cột, rồi 252
test xanh trên schema ĐÃ XOÁ cột. Mã mới sống được với cả hai, nên cửa sổ giữa
hai bước không có trạng thái nào hỏng.

Đảo lại là `GET /api/posts` 500 ⇒ `lib/api.ts` nuốt thành `[]` ⇒ **trang trống**.

### 1.7 Trang quản lý tài khoản - 🟢 ĐỢT A XONG 19/08 (trừ ảnh đại diện) · đợt B chưa làm

Đây là khoảng trống lớn nhất còn lại về mặt sản phẩm, không phải một chi tiết
thiếu. `/settings/security` chỉ có 2FA và passkey - nó được dựng để hai cơ chế
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

- **`displayName`** - đặt một lần lúc đăng ký (hoặc mặc định bằng username), sau
  đó KHÔNG có đường nào đổi. Nó lại là thứ hiển thị công khai dưới mỗi bài viết
  (`authorCard` của content-service).
- **`avatarUrl`** - chỉ xuất hiện trong khai báo kiểu và trong `authorCard`.
  Không có gì GHI vào nó.
- **`bio`** - grep toàn bộ `services/`, `apps/`, `packages/`: không nơi nào đọc.
  Cột chết, chỉ được `seed.js` điền một lần.

Cũng không có `/admin/users` - quản trị chỉ có dự án và con dấu.

#### Vì sao thành ra thế

Site vốn dùng Keycloak, nơi bảng `User` được `resolveUser()` tự tạo ÂM THẦM từ
token - không ai "có tài khoản" theo nghĩa sản phẩm, chỉ có một dòng dữ liệu để
gắn quyền. Không có đăng ký thì cũng không có gì để quản lý.

Khái niệm tài khoản chỉ thành thật ở đợt vừa rồi, khi thêm đăng ký/mật khẩu/2FA/
passkey. Trang quản lý tài khoản là hệ quả trực tiếp của thay đổi đó nhưng nằm
ngoài phạm vi được giao, nên không được dựng.

#### Cần làm gì

**Đợt A - ✅ XONG 19/08/2026, trừ ảnh đại diện.**

| Mảnh                                 | Trạng thái                                                |
| ------------------------------------ | --------------------------------------------------------- |
| `/settings/profile`                  | ✅ `displayName` + `bio`                                  |
| `POST /api/identity/password/change` | ✅ đòi mật khẩu hiện tại, tăng `sessionVersion`           |
| Ảnh đại diện                         | 🟠 **CHƯA - cần chủ dự án quyết một việc, xem ngay dưới** |

Ba route mới ở auth-service (`profile/get`, `profile/update`, `password/change`),
đều gắn `auth` theo nhánh và đi qua proxy CÓ PHIÊN
`pages/api/account/[...path].ts`. 11 test mới trong
`services/auth-service/test/profile.test.ts` khoá bốn thứ:

- `profile/update` chỉ chạm ĐÚNG hai cột - có test gửi kèm `role: 'ADMIN'`,
  `username`, `email` và khẳng định chúng không đổi. Một route "sửa hồ sơ" nhận
  nguyên `req.body` là đường tự cấp ADMIN bằng một dòng JSON, và nó vẫn trả 200.
- Sai mật khẩu hiện tại ⇒ 401 và mật khẩu KHÔNG đổi.
- Đổi mật khẩu ⇒ `sessionVersion` tăng, và **phiên mang số cũ bị từ chối ngay
  sau đó** - đây mới là thứ làm cho việc đổi mật khẩu LẤY LẠI được tài khoản.
- Tài khoản chỉ có passkey ⇒ 409 `no_password_set` nói rõ, không phải 401 mơ hồ.
  Trả 401 ở đó là đẩy người dùng vào đúng kiểu bế tắc của §0.5.

Số mới của `sessionVersion` được TRẢ VỀ cho client để nó gọi `update()` của
`useSession`. Thiếu bước đó thì chính người vừa đổi mật khẩu thành công bị đăng
xuất ngay lập tức, và trông y hệt như thao tác đã hỏng.

⚠️ **Tiện tay phát hiện: `/settings/security` là TRANG CHẾT.** Nó không được
nhắc tới ở bất kỳ đâu trong giao diện - chỉ vào được bằng cách gõ URL. Tức là
trang được dựng để 2FA và passkey không thành mã chết thì chính nó lại mắc đúng
số phận đó. Đã sửa: tên người dùng ở `SiteHeader` nay là liên kết tới
`/settings/profile`, và menu di động có thêm hai mục (trên màn hình hẹp tên người
dùng bị ẩn, nên đó là lối vào duy nhất).

#### ⚠️ Ảnh đại diện - một quyết định phải chốt TRƯỚC khi viết mã

Nghe như "nối presign có sẵn vào là xong", nhưng không phải, và cái vướng không
nằm ở tầng tải lên:

**Bucket R2 là bucket RIÊNG TƯ.** `CLAUDE.md` cảnh báo đừng đặt
`S3_PUBLIC_ENDPOINT` thành `cdn.tsudev.com` vì làm thế biến bucket thành công
khai. Nhưng ảnh đại diện phải đọc được CÔNG KHAI - nó hiện dưới mỗi bài viết,
nơi người xem không có phiên nào. URL presign thì HẾT HẠN, nên lưu một URL
presign vào `User.avatarUrl` là hẹn ngày ảnh hỏng hàng loạt.

Ba đường đi, phải chọn một:

| Cách                                                        | Được                                    | Mất                                                                      |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Bucket/tiền tố `avatars/` để đọc công khai                  | đơn giản nhất, ảnh là URL vĩnh viễn     | phải tách bucket hoặc bật public read - đụng đúng cảnh báo ở `CLAUDE.md` |
| Route proxy `/api/avatar/<username>` ký presign GET rồi 302 | bucket vẫn riêng tư hoàn toàn           | mỗi lượt xem ảnh là một lượt gọi Worker, ăn vào hạn mức 100.000/ngày     |
| Không có ảnh tải lên, dùng chữ cái đầu (`Avatar` đã có)     | 0 hạ tầng, 0 chi phí, 0 bề mặt tấn công | không cá nhân hoá được                                                   |

Với một site dự án cá nhân lưu lượng thưa và mục tiêu chi phí bằng 0, **đề nghị
cách 3 trước mắt** - component `Avatar` của `@tsudev/ui` đã dựng sẵn hình chữ cái
đầu. Cách 1 để dành cho lúc thật sự cần.

**Đợt B** chạm vào chiếm tài khoản và nghĩa vụ ở `/privacy`, làm riêng có test
đầy đủ:

| Mảnh              | Cạm bẫy                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đổi email         | phải xác minh địa chỉ MỚI trước khi thay. Thay trước rồi mới gửi thư xác minh là đường chiếm tài khoản: kẻ chiếm phiên đổi email sang của mình rồi dùng "quên mật khẩu". |
| Xem/thu hồi phiên | cơ chế đã có (`sessionVersion`), chỉ thiếu giao diện                                                                                                                     |
| Xoá tài khoản     | `Post.authorId` và `FileObject.ownerId` đều `onDelete: SetNull` nên xoá được mà không mất nội dung. Nhớ xoá kèm passkey/TOTP/mã dự phòng - `onDelete: Cascade` đã lo.    |

#### Thứ tự

§0.5 đã xong nên không còn chặn. Nhưng đây là loại tính năng **chỉ lộ lỗi khi
bấm thật**, nên nghiệm thu phải là đăng nhập vào production rồi thao tác, không
phải chỉ chạy test.

### 1.8 Cân nhắc: đường chẩn đoán cho tài khoản không có mật khẩu - 🟡

Thông điệp đăng nhập cố ý không phân biệt "không có tài khoản" / "sai mật khẩu"
/ "tài khoản chưa đặt mật khẩu". Đúng về chống dò tài khoản, nhưng §0.5 cho thấy
nó làm chính chủ tài khoản mắc kẹt và mất nhiều lượt mới chẩn đoán ra.

KHÔNG sửa bằng cách nới thông điệp ra - đó là đánh đổi sai. Hai hướng an toàn:

- Ghi log ở auth-service khi rơi vào nhánh `!user.passwordHash` (có username),
  để người vận hành đọc được mà người ngoài thì không.
- Trang `/login` thêm gợi ý trung tính kiểu "Tài khoản mới hoặc chưa từng đặt
  mật khẩu? Dùng Quên mật khẩu." - không tiết lộ gì về một tài khoản cụ thể.

---

### 1.9 ~~Đưa Con dấu về chế độ mời + gỡ tín dụng~~ - ✅ XONG 3/3 ĐỢT, đã gộp hết

| Đợt                  | Trạng thái                                        |
| -------------------- | ------------------------------------------------- |
| 1 - gỡ tín dụng      | ✅ phát hành 17/08                                |
| 2 - mã mời           | ✅ gộp (PR #12); backend đã chạy, **Worker chưa** |
| 3 - gác bề mặt + SEO | ✅ gộp (PR #15); backend đã chạy, **Worker chưa** |

Cả hai đợt sau nay lên cùng một lượt deploy Worker - xem "Bắt đầu từ đâu" việc 2,
và **sửa `INTERNAL_IDENTITY_SECRET` trước đã**.

Kế hoạch đầy đủ: [`docs/refactor-trust-invite-access.md`](docs/refactor-trust-invite-access.md).

Hai thứ rút ra từ đợt 3, đã ghi vào chỗ đúng của nó nên không lặp lại ở đây:

- Bề mặt Con dấu phải sửa ĐỒNG THỜI ở **bốn** chỗ, không phải ba - chỗ thứ tư
  (`services/backend-bundle/test/routing.test.ts`) nằm ở workspace khác nên đã
  lọt lưới đúng một lần. Gotcha ở `CLAUDE.md` đã cập nhật.
- Khi hai cổng chặn khác nhau cùng trả một mã trạng thái thì **mã trạng thái
  thôi không còn là dấu hiệu**. Test định tuyến của backend-bundle nay phân biệt
  bằng thân phản hồi.

Điểm phải quyết lại TRONG TƯƠNG LAI: khi cấp chứng chỉ đầu tiên cho khách hàng
THẬT, phải trả lời "khách vãng lai bấm vào huy hiệu thì thấy gì".
`TRUST_ISSUER` được ký vào chứng chỉ nên URL xác minh là cố định vĩnh viễn.
Serial hiện có dạng tuần tự `TSU-CR-2026-000123` - nếu sau này chọn hình
"URL-năng-lực" thì phải đổi cách sinh serial TRƯỚC lần cấp đầu.

Hệ quả đã ghi nhận: **SEO không còn đến từ Con dấu.** Mục tiêu "đạt tiêu chí SEO"
phải do blog · tài liệu · dự án gánh.

### 1.10 Dọn service Render trùng `tsudev-backend-rqkz` - 🟠 CHƯA LÀM

Mỗi lần deploy, hộp thư nhận `deploy failed for tsudev-backend-rqkz`. **Đó không
phải sự cố production** - nó là một service THỨ HAI chưa bao giờ khởi động nổi vì
không có secret nào, nên nó chết ngay lúc nạp module ở
`services/trust-service/src/signing.ts`. Chưa bao giờ chạy ⇒ **không tiêu giờ
instance**, nên nó không phải nguồn rủi ro ngân sách - chỉ là rác.

⚠️ **Thứ tự khi dọn: xoá Blueprint instance TRƯỚC, rồi mới xoá service.** Xoá mỗi
service mà để blueprint lại thì lần push sau nó dựng lại y nguyên. Và sau khi gỡ
blueprint phải xác nhận `tsudev-backend` còn bật Auto-Deploy - nếu đường deploy
tự động lâu nay do blueprint kéo thì gỡ xong sẽ thành "đã gộp PR rồi mà
production vẫn chạy mã cũ".

⚠️ **Đừng chẩn đoán bằng DNS.** Phiên 4 kết luận service "vẫn tồn tại trong tài
khoản" vì tên miền còn phân giải - **lập luận đó sai**: `*.onrender.com` là
wildcard nên MỌI tên đều phân giải, kể cả tên chưa ai đăng ký. Header
`x-render-routing: no-server` cũng không phân biệt được "đã xoá" với "tồn tại mà
không khởi động nổi". Chỉ dashboard mới trả lời được.

✅ `tsudev-sso` (service danh tính của bản thiết kế cũ) **đã được xác nhận không
còn tồn tại** trên Render - chủ dự án kiểm dashboard 19/08/2026. Nó từng là
khoản chi lớn nhất của ngân sách giờ instance.

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` - chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Mã nguồn là hiện
  trạng. §2.2 của nó đã được cập nhật 19/08 để ghi nhánh xác thực ĐÃ CHỌN (tự
  xây), nhưng phần còn lại vẫn là đích đến chứ không phải mô tả cái đang chạy.
