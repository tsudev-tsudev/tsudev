# Phiếu bàn giao - tsudev

> **Trạng thái tạm.** Xong hết §1 thì **xoá file này** và xoá dòng trỏ tới nó ở
> đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về vận hành là [`docs/deployment.md`](docs/deployment.md), về
> hạn mức miễn phí là [`docs/free-tier.md`](docs/free-tier.md), về xác thực là
> [`docs/auth.md`](docs/auth.md), về giao diện là
> [`docs/design-system.md`](docs/design-system.md). Phiếu này chỉ liệt kê **việc
> còn dở** và **những gì đã trả giá để học**, không lặp lại `docs/`.
>
> Phiên 6 (19/08/2026) đã gộp bốn lớp bàn giao cũ (phiên 3, 4, 5 và mục "phát
> hành 16/08") thành §0. Chúng mô tả công việc nay đã phát hành xong; giữ nguyên
> chỉ tạo mâu thuẫn với hiện trạng.

## ✅ Bắt đầu từ đâu

**Không còn việc chặn nào.** Bốn lỗi production của phiên 6 đã sửa và đã nghiệm
thu trên `tsudev.com` (chi tiết §0):

- Nội dung site trở lại - `/blog` **3 bài** · `/docs` **2 mục** · `/projects`
  **4 dự án**. Đếm bằng NỘI DUNG, không bằng mã 200.
- Mọi đường ghi đã xác thực chạy lại: sửa hồ sơ, đổi mật khẩu, upload, ghi nội
  dung admin. Trước đó **toàn bộ** chúng trả 401 trên HTTPS.
- Trang `/trust/*` phân biệt đúng hai đích: khách → `/login`, người đã đăng nhập
  chưa đạt VIP → `/trust`.
- Keycloak sạch hoàn toàn, kể cả cột DB và secret cuối cùng ở hạ tầng.

### ✅ Toà soạn Agent AI ĐÃ CHẠY (19/08/2026)

Ba biến cuối đã được đặt ở Render và toà soạn sản xuất thật. Đo bằng
`npm run newsroom:check` - script này đếm **việc đã chạy**, không đếm mã HTTP,
vì `POST /api/newsroom/tick` trả 202 NGAY rồi mới chạy nền:

```
AgentRun trước: 8  →  tick 202  →  AgentRun sau: 14
✔ Toà soạn ĐANG CHẠY THẬT
```

Trạng thái đường ống lúc chốt phiên: **18 nháp · 2 bản sửa · 3 bài đăng**
(3 bài là nội dung cũ, agent chưa xuất bản bài nào). Bản sửa đầu tiên dài 4.046
ký tự, 37 dòng, có tiêu đề Markdown thật.

**Chi phí vẫn bằng 0**: 714 Neuron hôm nay trên trần 8.000 (hạn mức Cloudflare
10.000/ngày), trung bình 26 Neuron mỗi lượt agent. Dự phóng ~2.500/ngày ở nhịp
19 lần/ngày - biên còn rất rộng.

✅ **Hàng đợi ý tưởng đã có trần** (trước đó lớn một chiều: 25 PENDING và tăng
đều). `scanSources()` nay ngừng quét khi hàng đợi chạm `IDEA_QUEUE_CAP = 12`.

Đo trên production sau khi phát hành, sáu nhịp liên tiếp:

```
trước:  ý tưởng chờ=23  scan.skipped=0  bản sửa=3
lượt 1: 21  1  5      lượt 4:  8  4  6   ← dưới trần, quét TỰ BẬT LẠI
lượt 2: 17  2  5      lượt 5: 11  4  6
lượt 3: 13  3  6      lượt 6: 12  4  8
```

Hàng đợi nay **dao động quanh trần** thay vì lớn một chiều, và bản sửa vẫn tăng
đều - tức van chặn đúng chỗ cần chặn mà không chặn nhầm Writer.

Chọn áp lực ngược thay vì tăng `batch` cho vừa là có lý do: tốc độ sinh phụ thuộc
nguồn tin bên ngoài, nên tăng số chỉ dời điểm vỡ. Van đặt TRƯỚC lượt gọi mô hình
đầu tiên - đặt sau thì hàng đợi bị chặn mà Neuron vẫn tiêu đều.

#### Lỗi đã sửa để tới được đây

Toà soạn bật lên rồi vẫn **không ra bài nào** trong khi vẫn tiêu Neuron:
`event.failed` lặp lại với `"Writer trả về bài rỗng hoặc quá ngắn"`. Nguyên nhân:
Llama 70B được yêu cầu trả `{"contentMd":"<cả bài Markdown>"}` thì xuống dòng
NGUYÊN VĂN trong chuỗi, mà JSON không cho phép ký tự điều khiển thô ⇒
`JSON.parse` ném ⇒ `parseJsonLoose` trả null ⇒ Writer ném ⇒ sự kiện quay lại
PENDING. Vòng lặp không tự thoát được vì cùng prompt cho cùng dạng đầu ra.

Vá ở PR #28: `escapeRawControlChars` (máy trạng thái, không phải regex - phải
biết đang trong hay ngoài chuỗi). Test hồi quy dùng **đầu ra thật của mô hình**
bắt được lúc truy nguyên.

### Rồi tới, theo thứ tự

1. **§1.5 - rà giao diện bằng MẮT.** Việc lớn nhất còn lại, và chưa ai nhìn.
   Nay có thêm ba thứ mới: trang mời `/trust`, `/settings/profile`, điều hướng
   đã đổi.
2. **§1.7 ảnh đại diện** - cần chủ dự án chốt một trong ba đường; bảng đánh đổi
   và đề nghị đã ghi sẵn.
3. **§1.10** dọn service Render trùng · **§1.4** CSP · **§1.3** npm audit ·
   **§1.7 đợt B** · **§1.8**.

### ✅ Bản sao lưu biến production đã được dựng lại

`backup/production-env-2026-08-19.txt` - **21 biến, không còn chỗ giữ chỗ**, và
cả ba cặp dùng chung (`INTERNAL_API_TOKEN`, `INTERNAL_IDENTITY_SECRET`,
`NEWSROOM_TICK_TOKEN`) đều chỉ có ĐÚNG MỘT giá trị, tức bản ghi tự nhất quán.

Bản 16/08 (nên xoá nếu còn) sai theo ba kiểu, và đáng ghi lại vì mỗi kiểu đều
từng gây sự cố:

- **Thiếu `INTERNAL_IDENTITY_SECRET`** ⇒ biến đó chưa bao giờ được đặt ở Render
  ⇒ mọi đường ghi đã xác thực trả 503 trong nhiều ngày.
- **Thiếu `TOTP_ENCRYPTION_KEY`** - mất là MỌI thiết bị 2FA đang dùng hỏng, và
  không sinh lại được. Chưa gây sự cố, nhưng đây là loại thiếu sót chỉ lộ ra vào
  đúng ngày tệ nhất.
- **Hai giá trị `INTERNAL_API_TOKEN` khác nhau** cho hai nơi bắt buộc phải trùng.
  Hạ tầng vẫn đúng (đã đo: giá trị nào qua được cổng backend), chỉ bản ghi sai -
  nhưng một bản ghi sai thì lần khôi phục sau sẽ đặt nhầm.

⚠️ **Ba thứ mất là không sinh lại được**: `TRUST_SIGNING_KEY` ·
`TOTP_ENCRYPTION_KEY` · (và `INTERNAL_IDENTITY_SECRET` sinh lại được nhưng phải
đổi ĐỒNG THỜI hai nơi). Sao lưu chúng ra một chỗ thứ hai, ngoài máy này.

Quy trình xoay secret dùng chung và phép đo cho từng cặp:
[`docs/deployment.md`](docs/deployment.md) §Biến môi trường.

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

---

## 0. Nhật ký phiên 6 (19/08/2026)

Phiên dài nhất tới nay: **mười PR gộp (#15-#24)**, ba lần phát hành thật, và
**bốn lỗi production được tìm ra - cả bốn đều đã chạy im lặng từ trước khi phiên
bắt đầu**. Không lỗi nào do công việc của phiên gây ra; công việc của phiên chỉ
làm chúng lộ ra.

### Bốn lỗi production, xếp theo mức độ

**1. `getToken()` tìm sai tên cookie trên HTTPS** ⇒ _mọi_ đường ghi đã xác thực
trên production trả 401: upload, ghi nội dung admin, toà soạn, mọi route tài
khoản, và các trang `/trust/*` đá cả VIP về `/login`. Đây là lỗi nặng nhất, và
nó chỉ được báo lên dưới dạng "đổi tên hiển thị không lưu được". Cơ chế và cách
canh: §0.7. Vá ở PR #23.

**2. Neon thiếu 6 migration** ⇒ toàn bộ nội dung site trống từ 18/08 lúc 01:55.
Render chạy mã SELECT những cột chưa tồn tại, `lib/api.ts` nuốt lỗi thành `[]`,
nên triệu chứng là trang trống chứ không phải trang lỗi. Phiếu phiên 4 có ghi
"kiểm Neon đã áp migration chưa" như một câu hỏi mở và **nó chưa bao giờ được
trả lời**.

**3. `INTERNAL_IDENTITY_SECRET` chưa bao giờ được đặt ở Render** ⇒ mọi đường ghi
đã xác thực trả 503. Ba thứ che nó: đăng nhập không dùng khẳng định danh tính
nên vẫn chạy; ba service kia dính cổng `INTERNAL_API_TOKEN` trước và trả 401 nên
không bao giờ chạm tới tầng danh tính; `/health` vẫn 200. Phép chẩn đoán duy nhất
không bị che đã ghi vào `docs/deployment.md`.

**4. `/settings/security` là trang chết** - không được nhắc tới ở bất kỳ đâu
trong giao diện, chỉ vào được bằng cách gõ URL. Trang dựng ra để 2FA và passkey
không thành mã chết thì chính nó mắc đúng số phận đó.

Ba mảnh nhỏ hơn cũng đã sửa: `Makefile e2e-up` gọi một container không còn tồn
tại · `scripts/verify-stack.ps1` gọi log của hai service đã xoá · Worker giữ một
secret `KEYCLOAK_CLIENT_SECRET` chết.

### Đã phát hành

| Việc                                  | Trạng thái                                              |
| ------------------------------------- | ------------------------------------------------------- |
| Con dấu về chế độ mời (§1.9, 3/3 đợt) | ✅ gộp + phát hành                                      |
| Gỡ Keycloak khỏi dự án                | ✅ **hoàn toàn** - mã, tài liệu, schema, cột DB, secret |
| Xoá cột `User.keycloakId` (§1.6)      | ✅ trọn ba bước, kể cả migration lên Neon               |
| Worker frontend                       | ✅ hai lần: đợt 2+3, rồi bản vá cookie                  |
| Worker cron giữ ấm (§1.1)             | ✅ deploy, kèm khung nghỉ đêm 01:00-06:00 giờ VN        |
| Trang tài khoản (§1.7 đợt A)          | ✅ trừ ảnh đại diện                                     |
| CI thôi chạy trùng                    | ✅ ~360 phút/tháng thôi bị đốt                          |
| Dữ liệu tham chiếu Toà soạn           | ✅ seed lên Neon (4 agent · 4 chuyên mục · 9 nguồn)     |

### Nghiệm thu trên production

Nội dung: `/blog` **3 bài** · `/docs` **2 mục** · `/projects` **4 dự án** - đếm
bằng nội dung, không bằng mã 200.

Xác thực và gác, đo bằng một tài khoản dùng-một-lần đi đúng luồng người dùng
thật (đã xoá sau khi xong; bảng `User` còn đúng 1 dòng thật):

| Thao tác                     | Trước     | Sau                           |
| ---------------------------- | --------- | ----------------------------- |
| đọc hồ sơ                    | 401       | **200** kèm dữ liệu thật      |
| đổi tên hiển thị             | 401       | **200**, tên đã đổi           |
| đổi mật khẩu SAI             | 401 mơ hồ | **401 `invalid_credentials`** |
| đổi mật khẩu ĐÚNG            | 401       | **200**, `sessionVersion` 0→1 |
| MEMBER mở `/trust/directory` | → /login  | **→ /trust**                  |
| khách mở `/trust/directory`  | → /login  | → /login (đúng)               |

Vế cuối hai dòng là toàn bộ ý nghĩa của `trustRedirect()`: khách đi đăng nhập,
người đã đăng nhập đi đọc giải thích về mã mời. Trước bản vá chúng gộp làm một.

Còn lại: `/trust/redeem` **200** (trước 404) · `sitemap.xml` **0 dòng** `/trust/`
· `/api/auth/providers` chỉ `credentials, passkey` · `noindex` có ở nhánh **khách
vãng lai** của cả bốn trang riêng tư.

### Dọn dẹp và chuẩn hoá (cuối phiên 6)

- **Redis bị gỡ hẳn.** Dựng ở dev, khai ở ba tệp env, chiếm một nút trong hợp
  đồng cổng - và KHÔNG dòng mã nào đụng tới. Nếu sau này cần giới hạn tần suất
  dùng chung giữa nhiều bản chạy thì Redis là câu trả lời (§1.2), nhưng giữ một
  service không ai dùng chạy sẵn không làm điều đó đến gần hơn.
- **Năm phụ thuộc thừa** đã gỡ (`cors`, `@tsudev/types` ×2, `jose` ×2), mỗi cái
  kiểm riêng. ⚠️ `react-dom` cũng bị công cụ báo thừa nhưng ĐƯỢC GIỮ - nó là peer
  dependency của Next. Đừng gỡ theo danh sách của công cụ dò phụ thuộc.
- **CI: job treo ba lần** (18/08 một, 19/08 hai). Truy ra bằng API trạng thái
  từng bước lúc job còn chạy: nó treo ở `npx playwright install`, KHÔNG phải ở
  test - đó là lý do cả ba lần không có dòng log test nào. Đã lắp ba lớp: trần
  10 phút cho bước đó · cache `~/.cache/ms-playwright` · trần 25 phút cho cả năm
  job. Trần mặc định của GitHub là 360 phút, tức một job treo tiêu 18% hạn mức
  tháng mà không sinh kết quả nào.

### Số đo cuối phiên

- **296 test** trên **tám** workspace (auth 61 · bundle 14 · content 26 ·
  newsroom 34 · storage 13 · trust 57 · ui 68 · frontend-main 23).
- Bốn cổng gốc xanh · `main` xanh · một nhánh cục bộ duy nhất.
- `tsudev-sso` đã xác nhận **không còn** trên Render.

---

## 0.7 Kỹ thuật đã trả giá để học - dùng lại được

Tám thứ, ghi lại để khỏi học lần nữa. Mỗi mục là một lỗi đã thật sự xảy ra.

### Lỗi CHỈ tồn tại trên HTTPS thì không bộ test nào ở đây bắt được

Cookie phiên khai tường minh trong `[...nextauth].ts` (bắt buộc, để đặt được
`domain`) nên nó KHÔNG mang tiền tố `__Secure-`, còn `getToken()` thì đi theo
quy ước của next-auth và tự thêm tiền tố đó khi `NEXTAUTH_URL` là https:

| Môi trường   | Cookie thật được đặt      | Tên `getToken` đi tìm              | Kết quả  |
| ------------ | ------------------------- | ---------------------------------- | -------- |
| dev (http)   | `next-auth.session-token` | `next-auth.session-token`          | khớp     |
| prod (https) | `next-auth.session-token` | `__Secure-next-auth.session-token` | **null** |

Hậu quả: **mọi đường ghi đã xác thực trên production trả 401** trong nhiều ngày -
upload, ghi nội dung admin, toà soạn, mọi route tài khoản - và các trang
`/trust/*` đá cả VIP về `/login`. Không lỗi nào được ném, không log nào đỏ.

Hai điều rút ra, dùng được cho mọi lỗi cùng họ:

1. **Dev và E2E chạy `http://localhost`.** Mọi thứ phân nhánh theo `https` -
   tiền tố cookie, `secure`, `SameSite=None`, HSTS, CSP `upgrade-insecure-requests` -
   đều KHÔNG được kiểm ở đây. 20 test E2E xanh trong khi production hỏng hoàn toàn.
2. **Vì thế phải canh bằng test quét NGUỒN, không phải quét hành vi.**
   `apps/frontend-main/test/sessionCookie.test.ts` đỏ khi có chỗ gọi thẳng
   `getToken`, khi cấu hình NextAuth viết lại chuỗi tên thay vì dùng hằng chung,
   hoặc khi tên cookie mọc tiền tố. Hình dạng của mã là thứ duy nhất kiểm được
   khi hành vi chỉ sai ở một môi trường không tái hiện được.

### Tái hiện lỗi production bằng một tài khoản dùng-một-lần

Khi triệu chứng chỉ xảy ra với người đã đăng nhập mà bạn không có mật khẩu của
ai, đừng đoán từ xa. Đường đăng ký là công khai:

```bash
curl -sX POST https://tsudev.com/api/identity/register -H 'content-type: application/json' \
  -d '{"username":"chan-doan-...","email":"...@tsudev.local","password":"..."}'
# rồi lấy csrf → POST /api/auth/callback/credentials với cookie jar của curl
# rồi gọi đúng endpoint đang hỏng bằng cookie đó
```

Đó là cách sự cố cookie ở trên được tìm ra trong vài phút, sau khi đoán mò không
ra. **Nhớ xoá tài khoản khỏi Neon sau khi xong** - đã xoá, còn đúng 1 tài khoản
thật trong bảng.

### Mã 200 KHÔNG chứng minh trang có nội dung

Phép nghiệm thu cho một trang nội dung phải đếm **thứ bên trong trang**, không
phải mã trạng thái của nó. `lib/api.ts` nuốt mọi lỗi thành `[]`, nên backend 500
hay 401 đều cho ra một trang **200 rỗng** - trông y hệt "chưa có bài nào".

Đã xảy ra ở quy mô tệ nhất có thể: site trống suốt từ 18/08 tới 19/08 trong khi
mọi bảng nghiệm thu đều xanh, vì tất cả đều đo mã HTTP. Phép kiểm đúng:

```bash
curl -s https://tsudev.com/blog | grep -c 'href="/blog/'   # phải > 0
```

Hệ quả cho các đợt sau: mỗi lần phát hành, đo **một truy vấn đi tới tận
database** chứ không chỉ `/health` - `/health` của backend-bundle trả JSON tĩnh
và không đụng Prisma, nên nó xanh kể cả khi DB lệch schema hoàn toàn.

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

### Tệp test mới phải có `export {}`, và `tsc -b` sẽ GIẤU chuyện đó ở máy dev

Tệp test không có `import`/`export` nào thì TypeScript coi là **script toàn cục**,
nên `request`, `prisma`, `app`, `post`, `clean`… ở top-level đụng tên với đúng
những biến đó trong tệp test khác ⇒ `TS6200`, và cả suite không chạy nổi.

Cái đắt không phải lỗi mà là **nó không lộ ra ở máy dev**: `tsc -b` dựng tăng
dần, bỏ qua tệp chưa đổi, nên `npm --workspace … test` xanh ở local rồi đỏ ở CI
(nơi build sạch). Đã tốn một vòng CI đúng theo đường này.

Hai cách dùng lại được:

- Thêm `export {}` vào mọi tệp test dùng `require()` ở top-level.
- Nghi ngờ thì xoá `*.tsbuildinfo` rồi chạy lại - đó là cách tái hiện điều kiện
  của CI ở máy mình:
  `find . -name "*.tsbuildinfo" -not -path "./node_modules/*" -delete`

### `wrangler.jsonc` KHÔNG được `topology:gen` sinh ra

Thêm service vào `config/topology.json` **không** kéo theo biến cho Worker. Quên
là biến rơi về `http://localhost:<port>` và Worker gọi vào chính nó. Đã xảy ra
với `AUTH_SERVICE_URL` (đăng nhập hỏng hoàn toàn, trong khi
`/api/auth/providers` vẫn trả đúng nên nhìn qua tưởng xong).

`topology:check` nay canh tệp đó - nhưng nó chỉ kiểm SỰ CÓ MẶT, không kiểm giá
trị. Giá trị vẫn phải điền tay.

---

---

## 0.8 Bài học: "đặt mật khẩu thành công mà production vẫn rỗng"

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

---

## 1. Việc còn dở

### 1.1 ~~Dựng bộ ping giữ ấm~~ - ✅ XONG 19/08

`infrastructure/newsroom-cron` đã được deploy 19/08 với cả hai nhịp:

```
Deployed tsudev-newsroom-cron triggers
  schedule: */5 0-17,23 * * *
  schedule: 7 0-17,23 * * *
```

Trước đó nó **chưa bao giờ được deploy** - `wrangler deployments list` trả
`This Worker does not exist on your account`. Bản trước của phiếu này ghi "có thể
đã xong"; đó là suy đoán và nó sai. Ghi lại vì đây là kiểu sai dễ lặp: một mục
được đánh dấu "có thể xong" rồi không ai đo lại.

⚠️ Nhịp giữ ấm **không dùng** `NEWSROOM_TICK_TOKEN` (chỉ đọc `BACKEND_URL`), nên
mục này xong độc lập với việc toà soạn có chạy hay không.

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

### 1.3 `npm audit` - 🟠 CHƯA LÀM, và phần "dễ" hoá ra KHÔNG chạy được

Đo lại 19/08/2026 (con số cũ "7 lỗ, 4 cao" đã lạc hậu):

| Phạm vi                     | Số lỗ                                   |
| --------------------------- | --------------------------------------- |
| Toàn bộ                     | **37** (1 thấp, 18 vừa, 17 cao, 1 nguy) |
| `--omit=dev` (thật sự ship) | **7** (3 vừa, 4 cao)                    |

Chênh lệch 30 lỗ nằm ở Storybook - **không nằm trong CI và không được ship**
(nợ đã đăng ký ở §2). Đừng để con số 37 kéo phiên đi sai hướng.

Bảy lỗ thật đều là **`sharp` kế thừa CVE của libvips qua `next`**; sửa cần nâng
lên `next@16` - breaking. Phải là **đợt riêng có test đầy đủ**, đừng nhét vào
commit khác.

⚠️ **`npm audit fix` (không `--force`) KHÔNG chạy được.** Nó chết ở xung đột peer
dependency - đúng khoản nợ `react@18.3.1` ghim ở gốc cho Storybook so với React
19 ở app (§2). Bản trước của mục này ghi "`qs` qua `express` thì `npm audit fix`
xử lý được"; điều đó **không còn đúng**. Ép bằng `--force` hay `--legacy-peer-deps`
là đổi cây phụ thuộc một cách mù, đừng làm ngoài một đợt riêng.

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

### 1.6 ~~Xoá cột `User.keycloakId`~~ - ✅ XONG HẲN 19/08/2026

Cả ba bước đã chạy đúng thứ tự: gỡ khỏi schema → phát hành mã (Render + Worker)
→ `migrate deploy` lên Neon. Cột không còn ở cả mã lẫn database.

Bằng chứng cho thấy thứ tự đó là thật chứ không phải nghi thức: **268 test xanh
trên schema CÒN cột, rồi 252 test xanh trên schema ĐÃ XOÁ cột**. Mã mới sống
được với cả hai, nên cửa sổ giữa hai bước không có trạng thái nào hỏng.

Đây cũng là lần đầu quy trình "xoá cột" được chạy trọn vẹn ở dự án này. Lần sau
xoá cột khác thì lặp lại đúng ba bước; đảo lại là trang trống, không phải trang
lỗi.

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

---

## 2. Nợ có đăng ký, KHÔNG phải việc cần làm

- **Storybook không nằm trong CI** và root còn ghim `react@18.3.1` cho nó. App
  thật chạy React 19. Đợt này thêm prop `inputRef` cho `Input` thay vì dựa vào
  `ref` đi lọt qua `...props` - chính vì khoảng cách đó.
- **`documents-tsudev.md` là ĐẶC TẢ, không phải hiện trạng.** Mã nguồn là hiện
  trạng. §2.2 của nó đã được cập nhật 19/08 để ghi nhánh xác thực ĐÃ CHỌN (tự
  xây), nhưng phần còn lại vẫn là đích đến chứ không phải mô tả cái đang chạy.
