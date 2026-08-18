# Phiếu bàn giao - sau đợt xác thực tự quản lý và tái cấu trúc giao diện (16/08/2026)

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> xác thực/phân quyền là [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở**, không lặp lại kiến thức đã nằm trong `docs/` hay `CLAUDE.md`.

## Bắt đầu từ đâu

**Không còn việc chặn nào.** Production đã đăng nhập được (§0.5 đã xong 17/08).

➡️ **Phiên mới: đọc [§0.9 Bàn giao phiên 4](#09-bàn-giao-phiên-4-18082026--đọc-trước)
trước tiên.** Ba PR của phiên 3 (#12, #13, #14) đã gộp; §0.8 giữ lại làm lịch sử
nhưng **dấu hiệu phát hành ghi trong đó nay đã SAI** - §0.9 nói rõ vì sao.

Thứ tự đề nghị:

1. **PHÁT HÀNH frontend Worker.** Đo 18/08: backend Render đã chạy mã mới
   (`/health` có `newsroom`) nhưng Worker vẫn là bản CŨ - `/trust/redeem` và
   `/admin/newsroom` trả **404** trên `tsudev.com`. Nghĩa là mã mời (đợt 2) và
   toàn bộ Toà soạn Agent AI đã có ở backend mà **người dùng chưa với tới được**.
   Chi tiết và thứ tự: §0.9.
2. **§1.9 đợt 3 - gác bề mặt Con dấu + SEO + điều hướng.** Làm cuối vì đó là đợt
   duy nhất có thể khoá nhầm chính mình ra ngoài - và giờ đã có đường vào lại
   (cấp mã ở `/admin/trust`, đổi ở `/trust/redeem`).
3. **§1.7 đợt A - trang quản lý tài khoản.** Khoảng trống lớn nhất về sản phẩm:
   không có route nào cho người dùng sửa hồ sơ của chính mình.
4. **§1.5 - rà giao diện bằng MẮT.** Chưa ai nhìn. Làm sau §1.7 và §1.9 thì rà
   một lần cho cả trang mới.
5. Còn lại: §1.10 dọn service Render trùng (10 phút, làm lúc nào cũng được) ·
   §1.1 ping giữ ấm (§0.9 ghi chú: Worker cron của Toà soạn có thể đã gánh việc
   này) · §1.4 CSP · §1.3 npm audit · §1.6 xoá cột `keycloakId` · §1.7 đợt B ·
   §1.8.

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

## 0.9 Bàn giao phiên 4 (18/08/2026) - ĐỌC TRƯỚC

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

⚠️ **Điểm cần chủ dự án quyết:** `pages/robots.txt.ts` có `Disallow: /admin`,
và nó **triệt tiêu** chính thẻ `noindex` vừa thêm - bot bị chặn thu thập thì
không đọc được thẻ, URL vẫn lọt vào kết quả qua liên kết ngoài. Chuẩn là chọn
một: cho thu thập + `noindex` (mạnh hơn), hoặc chỉ `Disallow`. Chưa đổi vì đó là
thay đổi chính sách SEO nhìn thấy được.

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

### 1.1 Dựng bộ ping giữ ấm - 🟡 CÓ THỂ ĐÃ XONG, cần kiểm

⚠️ Đọc §0.9 việc 2 trước: `infrastructure/newsroom-cron` chạy `*/5 * * * *` và
**cố ý kiêm luôn việc giữ ấm**. Nếu Worker đó đã deploy thì mục này đóng lại,
khỏi dựng UptimeRobot. Phần dưới giữ nguyên làm bối cảnh.

Free tier cấp 750 giờ instance/tháng cho **cả tài khoản**; một service chạy liên
tục tiêu 720 giờ. Nay chỉ còn MỘT service (`tsudev-backend`) nên toàn bộ ngân
sách dồn về nó - không còn phải đánh đổi với đường đăng nhập như khi còn
Keycloak. Ping `https://tsudev-backend.onrender.com/health` mỗi 5 phút.

**Đừng dùng GitHub Actions cron.** Repo private, mỗi lần chạy tính tối thiểu 1
phút ⇒ ~8.600 phút/tháng, vượt xa hạn mức 2.000. Dùng UptimeRobot free hoặc
Better Stack free.

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

### 1.6 Xoá cột `User.keycloakId` - 🟡 CHỜ mã mới lên sóng

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
dọn dẹp - không có dữ liệu nào mất.

---

### 1.7 KHÔNG CÓ trang quản lý tài khoản / thông tin cá nhân - 🟠 CHƯA LÀM

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

Đề nghị chia hai đợt. **Đợt A** không có rủi ro chiếm tài khoản, làm trước:

| Mảnh                | Ghi chú                                                         |
| ------------------- | --------------------------------------------------------------- |
| `/settings/profile` | `displayName`, `bio`, ảnh đại diện                              |
| Đổi mật khẩu        | `POST /api/identity/change-password`, **đòi mật khẩu hiện tại** |
| Ảnh đại diện        | storage-service + presign đã có sẵn, chỉ cần nối vào            |

Đổi mật khẩu phải đòi mật khẩu hiện tại: cookie phiên bị đánh cắp KHÔNG được
phép đủ để đổi mật khẩu. Xong thì tăng `sessionVersion` để đá mọi phiên khác.
Khuôn có sẵn - `totp/disable` đã làm đúng kiểu đó.

Đường ghi đi qua proxy CÓ PHIÊN `pages/api/account/[...path].ts`, không phải
`pages/api/identity/[...path].ts` (proxy công khai). Hai tệp, hai mức bảo vệ -
thêm nhầm nhánh là mở một route đáng lẽ phải đăng nhập.

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

### 1.9 Đưa Con dấu về chế độ mời + gỡ tín dụng - 🟡 ĐANG LÀM (2/3 đợt xong)

> **Đợt 1 (gỡ tín dụng) đã XONG và đã phát hành 17/08/2026.** Ba cột
> `User.credits`, `SealProgram.feeCredits`, `SealApplication.feeCharged` không
> còn ở cả mã lẫn Neon. Mọi chương trình dấu miễn phí.
>
> **Đợt 2 (mã mời) đã XONG và đã GỘP vào `main` (PR #12), nhưng mới lên tới
> backend Render - frontend Worker vẫn là bản cũ, nên `/trust/redeem` còn 404
> trên production (§0.9).** Bảng
> `TrustInvite` + `TrustInviteRedemption`, bốn route
> `/api/identity/invite/{redeem,create,list,revoke}`, trang `/trust/redeem`,
> khối quản lý mã ở `/admin/trust`. 17 test đơn vị + 2 E2E mới, tất cả xanh.
> Migration thuần tính cộng nên chạy trước khi phát hành code là an toàn.
>
> Một bổ sung ngoài kế hoạch, **đợt 3 phụ thuộc vào nó**: `token.role` của
> next-auth CHỈ được ghi ở lần đăng nhập đầu, nên đổi mã xong thì DB nói VIP còn
> phiên vẫn nói MEMBER - điều hướng tiếp tục giấu mục Con dấu, trông y hệt như
> đổi mã không có tác dụng. Đã thêm `POST /api/identity/session-state` và nhánh
> `trigger === 'update'` ở callback `jwt` để đọc lại vai trò TỪ DB (không bao
> giờ từ tham số client truyền vào). Đợt 3 lọc điều hướng theo `session.role`
> nên nó dựa thẳng lên chỗ này.
>
> **Còn đợt 3 (gác bề mặt + SEO).** Đợt đó chỉ có code, không migration.
>
> Bài học từ đợt 1, áp dụng cho đợt còn lại: kế hoạch ước lượng "3 trang
> frontend" nhưng thực tế là 4 - `trust/portal.tsx` lọt lưới vì lần khảo sát đầu
> grep trong danh sách tệp đoán trước thay vì grep từ khoá trên cả cây.

**Kế hoạch đầy đủ: [`docs/refactor-trust-invite-access.md`](docs/refactor-trust-invite-access.md).**
Phạm vi đã được chủ dự án chốt 16/08/2026 - **không còn câu nào phải hỏi trước
khi bắt đầu.**

Chốt: **mọi trang liên quan tới chứng chỉ/huy hiệu chỉ truy cập và nhìn thấy
được qua mã mời do admin cấp**, không ngoại lệ cho trang xác minh. Gỡ hẳn
`credits`.

Cái giá của quyết định đó, đã đếm trên Neon: **0 chứng chỉ · 0 tổ chức · 0 đơn ·
0 tên miền**. Không có huy hiệu nào đang chạy trên site bên thứ ba, nên không có
gì để hỏng - quyết định này hôm nay tốn con số không.

Bốn điều phải biết trước khi mở kế hoạch:

1. **BA LẦN PHÁT HÀNH RIÊNG, không gộp.** Hai đợt migration chạy NGƯỢC chiều
   nhau: gỡ `credits` là `DROP` ⇒ code trước, migration sau. Mã mời là thêm bảng
   ⇒ migration trước, code sau. Gộp vào một lần là trang trống ở production.
   (Cả hai đã làm đúng thứ tự; đợt 3 không có migration nên ràng buộc này hết
   hiệu lực sau khi đợt 2 lên sóng.)
2. **Phần A (gác bề mặt) làm CUỐI CÙNG** - đó là đợt duy nhất có thể khoá nhầm
   chính mình ra ngoài. Làm sau thì mã mời đã chạy và có đường vào lại.
3. **`credits` KHÔNG phải cột chết** (gotcha riêng ở `CLAUDE.md`) - gỡ nó là gỡ
   cả cơ chế thu phí: 9 chỗ trong trust-service, 4 chương trình trong seed,
   3 trang frontend.
4. **JWKS được đề nghị giữ công khai** - nó chỉ chứa khoá công khai, không tiết
   lộ khách hàng/chứng chỉ nào. Gác nó không che giấu gì mà chỉ làm hỏng xác
   minh chữ ký ngoại tuyến. Chủ dự án muốn gác luôn cũng được, chỉ cần biết là
   nó không bảo vệ điều gì.

Điểm phải quyết lại TRONG TƯƠNG LAI (ghi trong kế hoạch, đừng quyết bây giờ):
khi cấp chứng chỉ đầu tiên cho khách hàng THẬT, phải trả lời "khách vãng lai bấm
vào huy hiệu thì thấy gì". `TRUST_ISSUER` được ký vào chứng chỉ nên URL xác minh
là cố định vĩnh viễn. Serial hiện có dạng tuần tự `TSU-CR-2026-000123` - nếu sau
này chọn hình "URL-năng-lực" thì phải đổi cách sinh serial TRƯỚC lần cấp đầu.

Hệ quả đã ghi nhận: **SEO không còn đến từ Con dấu.** Mục tiêu "đạt tiêu chí SEO"
phải do blog · tài liệu · dự án gánh. Với Con dấu, việc SEO duy nhất là rút khỏi
`sitemap.xml` và `noindex` cho sạch.

---

### 1.10 Dọn service Render trùng `tsudev-backend-rqkz` - 🟠 CHƯA LÀM

Mỗi lần deploy, hộp thư nhận `deploy failed for tsudev-backend-rqkz`. **Đó không
phải sự cố production** - nó là một service THỨ HAI chưa bao giờ khởi động nổi vì
không có secret nào (`render.yaml` khai `NODE_ENV: production` bằng giá trị
literal, còn 11 biến kia là `sync: false`), nên nó chết ngay lúc nạp module ở
`services/trust-service/src/signing.ts`.

Đã đo 18/08/2026: `tsudev-backend.onrender.com/health` trả 200 và đủ bốn nhánh;
`tsudev-backend-rqkz.onrender.com` không phản hồi nhưng DNS **vẫn phân giải** ⇒
service tồn tại trong tài khoản.

⚠️ **Thứ tự khi dọn: xoá Blueprint instance TRƯỚC, rồi mới xoá service.** Xoá mỗi
service mà để blueprint lại thì lần push sau nó dựng lại y nguyên. Và sau khi gỡ
blueprint phải xác nhận `tsudev-backend` còn bật Auto-Deploy - nếu đường deploy
tự động lâu nay do blueprint kéo thì gỡ xong sẽ thành "đã gộp PR rồi mà
production vẫn chạy mã cũ".

Chẩn đoán đầy đủ, ba rủi ro nếu để nguyên, và cảnh báo "đừng làm ngược lại":
[`docs/deployment.md`](docs/deployment.md) §`tsudev-backend-rqkz`.

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` - chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Nó vẫn mô tả
  Keycloak. Mã nguồn là hiện trạng.
