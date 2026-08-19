# Triển khai production

Hai nhà cung cấp, hai đường deploy khác nhau. Biết mình đang đổi cái nào.

| Thành phần       | Nền tảng           | Định nghĩa ở đâu                                    |
| ---------------- | ------------------ | --------------------------------------------------- |
| `frontend-main`  | Cloudflare Workers | `apps/frontend-main/wrangler.jsonc`                 |
| `backend-bundle` | Render (Docker)    | `render.yaml` + `docker/backend-service.Dockerfile` |
| PostgreSQL       | ngoài (Neon)       | `DATABASE_URL` (secret Render)                      |

## Frontend - Cloudflare Workers

`frontend-main` build qua `@opennextjs/cloudflare` (không phải Pages):

```bash
npm --workspace apps/frontend-main run preview   # build + chạy thử local
npm --workspace apps/frontend-main run deploy    # build + deploy
npm --workspace apps/frontend-main run cf-typegen  # sinh lại cloudflare-env.d.ts
```

Worker tên `tsudev`. `wrangler.jsonc` có **service binding tự trỏ về chính nó**
(`WORKER_SELF_REFERENCE`) mà OpenNext cần cho tầng cache - tên binding phải khớp
đúng tên worker, đổi tên worker mà quên sửa binding thì cache hỏng lặng lẽ.

### Bẫy: `.env.local` thắng `.env.production` - đã từng thành lỗ hổng thật

`NEXT_PUBLIC_*` được Next **nội suy lúc build**, không đọc lúc chạy - nên không
đặt được từ dashboard Cloudflare. Giá trị production nằm ở
`apps/frontend-main/.env.production` (sinh từ `config/topology.json`).

Nhưng Next xếp **`.env.local` CAO HƠN `.env.production`**, mà
`apps/frontend-main/.env.local` là **bản sao nguyên văn `.env` gốc** (do
`scripts/write-env-local.js` sinh), và lệnh deploy chạy **trên máy dev**.

Ngày 16/08/2026 điều này đã thành lỗ hổng thật trên production: bản dựng mang
theo một cờ bỏ qua xác thực, nên NextAuth bật provider `e2e-dev` và **bất kỳ ai
cũng đăng nhập được vào tài khoản ADMIN bằng mật khẩu `devpass`**. Cùng đường đó
còn kéo theo `NEXTAUTH_SECRET=change-me-secret`
và khoá ký dev. Site vẫn chạy bình thường; không có gì báo lỗi.

Vì thế `deploy`/`preview`/`upload` **không gọi thẳng `opennextjs-cloudflare`**
nữa mà đi qua `scripts/deploy-frontend.js`. Script đó **dời `.env.local` ra khỏi
đường trong suốt lúc dựng** rồi trả lại (kể cả khi bị Ctrl-C; lần chạy sau còn
tự dọn tàn dư). Chặn từng biến một là trò đuổi bắt - mỗi biến dev mới thêm vào
`.env` lại là một lỗ mới.

```bash
npm --workspace apps/frontend-main run deploy
```

**Nghiệm thu sau mỗi lần deploy** - một lệnh, đáng chạy mọi lần:

```bash
curl -s https://tsudev.com/api/auth/providers   # phải CHỈ có credentials/passkey/oauth đã cấu hình
```

Thấy `e2e-dev` trong đó là bản dựng đã nhiễm giá trị dev - dừng và tìm nguồn.

## Backend - Render

Blueprint `render.yaml` khai báo **1** web service, `plan: free`,
`region: singapore`: `tsudev-backend` - bốn service backend gộp thành một tiến
trình (content, storage, trust, identity).

> `tsudev-sso` - nhà cung cấp danh tính riêng của bản thiết kế cũ - đã được gỡ
> khỏi blueprint. **Gỡ khỏi repo KHÔNG xoá service đang chạy trên Render** - phải
> xoá tay ở dashboard, nếu không nó vẫn tiêu giờ instance của tài khoản.
> ✅ Đã xác nhận trên dashboard 19/08/2026: service không còn tồn tại.
>
> ⚠️ **Đừng chẩn đoán sự tồn tại của một service bằng DNS.** `*.onrender.com` là
> wildcard nên MỌI tên đều phân giải, kể cả tên chưa ai đăng ký; header
> `x-render-routing: no-server` cũng không phân biệt được "đã xoá" với "tồn tại
> mà không khởi động nổi". Chỉ dashboard mới trả lời được. Phiên 4 đã kết luận
> nhầm đúng theo đường này.

### Ngân sách giờ chạy - quyết định thiết kế, không phải chi tiết vặt

Gói free cấp **750 giờ instance/tháng cho CẢ TÀI KHOẢN**, không phải cho mỗi
service. Một service chạy liên tục tiêu 720 giờ. Nên chỉ giữ ấm được **đúng
một** service, và đó là `tsudev-backend` - nó nằm trên mọi đường đọc của site.

Trước đây `tsudev-sso` buộc phải được ngủ, và cái giá là cold start ở lần đăng
nhập đầu tiên. Đưa xác thực về trong chính codebase dồn toàn bộ 750 giờ về một chỗ và xoá luôn đánh đổi
đó. Thêm service thứ hai chạy liên tục là vỡ ngân sách và Render dừng hết.

### ⚠️ Phép chẩn đoán `INTERNAL_IDENTITY_SECRET` - endpoint duy nhất không bị che

Thiếu (hoặc đặt ngắn hơn 32 ký tự) `INTERNAL_IDENTITY_SECRET` ở Render làm **mọi
đường ghi đã xác thực trên toàn site trả 503**. Lỗi này ẩn rất giỏi, vì ba lý do
cộng lại:

- **Đăng nhập vẫn chạy bình thường.** Đăng nhập không dùng khẳng định danh tính,
  nên nó không chứng minh gì về biến này.
- **Ba service kia che mất nó.** `/api/posts`, `/api/presign`,
  `/api/admin/projects` dính cổng `INTERNAL_API_TOKEN` TRƯỚC và trả 401, nên
  request không bao giờ tới được tầng danh tính để lộ 503.
- Không có gì đỏ ở `/health`.

`trust-service` cố ý đứng ngoài `INTERNAL_API_TOKEN` (endpoint của nó phải công
khai cho bên thứ ba), nên nó là đường duy nhất đi thẳng tới tầng danh tính:

```bash
curl -s https://tsudev-backend.onrender.com/api/trust/programs
```

| Trả về                                           | Nghĩa là                                       |
| ------------------------------------------------ | ---------------------------------------------- |
| `503 {"error":"Máy chủ chưa cấu hình xác thực"}` | **thiếu khoá** - sửa ngay                      |
| `401`                                            | khoá đúng, chỉ thiếu danh tính - **lành mạnh** |

Giá trị phải dài **≥ 32 ký tự** và **trùng nguyên văn** secret cùng tên của
Worker. Kiểm phía Worker bằng `npx wrangler secret list` trong
`apps/frontend-main` (chỉ in tên, không in giá trị).

Đã xảy ra thật: đo 19/08/2026 backend trả 503, và lỗi có từ trước - nó chỉ lộ ra
khi đợt gác bề mặt Con dấu đưa `/api/trust/*` ra sau tầng xác thực.

### Region là bất biến

Đổi `region` trong `render.yaml` **không** di chuyển service đang chạy - phải
xoá và dựng lại. Trước đây file này không khai region nên cả bốn service nằm ở
Oregon (mặc định của Render), cách Việt Nam ~180ms mỗi lượt gọi SSR; singapore
còn ~40ms.

Hai service dùng **chung một image** (`docker/backend-service.Dockerfile`);
Render chọn service bằng cách override `dockerCommand`. Vì vậy:

- **Build context phải là gốc repo.** Các service phụ thuộc package nội bộ
  `@tsudev/db`, `@tsudev/types` - không có trên npm registry, `npm install` cô
  lập trong `services/<tên>` sẽ 404.
- Image cài cả devDependencies vì cần prisma CLI để `prisma generate`.
- `--ignore-scripts` để bỏ qua `prepare` (husky) - image production không có
  `.git`.

Đổi cấu trúc package/workspace là đổi cả Dockerfile này. Đọc phần chú thích ở
đầu file trước khi sửa.

## Chế độ gộp - `services/backend-bundle`

**Production chạy ba service backend trong MỘT tiến trình.** Đây là hình trạng
thật, không phải tối ưu tuỳ chọn:

- Render free cấp **750 giờ instance/tháng cho cả tài khoản**. Ba service chạy
  liên tục cần 2160 giờ ⇒ không giữ ấm được cái nào ⇒ khách đầu tiên sau 15 phút
  vắng phải chờ ~50s cold start. Một tiến trình cần 720 giờ - vừa đủ để ping giữ
  ấm.
- Một pool kết nối Prisma thay vì ba, đáng kể với giới hạn kết nối của Neon free.

Nó **không phải API gateway**: không định tuyến lại, không đổi đường dẫn, không
thêm lớp xác thực. Mỗi app con giữ nguyên middleware, cổng chặn và quy tắc auth
của chính nó.

Điều phối bằng **bảng tiền tố đường dẫn** trong `services/backend-bundle/src/index.js`.
Vì sao không mount thẳng ba app chồng lên nhau: request `/api/trust/*` sẽ đi vào
app content trước và dính cổng chặn `INTERNAL_API_TOKEN` của nó - huy hiệu SVG,
trang xác minh và JWKS (bắt buộc công khai cho bên thứ ba) trả 401, **không có
gì báo lỗi**. `services/backend-bundle/test/routing.test.js` canh đúng chỗ này.

⚠️ **Thêm route mới với tiền tố chưa có trong bảng ⇒ route đó 404 ở production**
dù chạy service riêng vẫn thấy nó sống. Sửa route thì sửa bảng.

Chạy ở local đúng hình prod:

```bash
npm run dev:merged     # một tiến trình, cổng 4000
```

## Ba service cũ ở tài khoản Render KHÁC - chưa dọn

`tsudev-content`, `tsudev-storage`, `tsudev-trust` (Oregon) **vẫn đang chạy** và
**không nằm trong tài khoản Render hiện tại** - API key của tài khoản mới không
thấy chúng. Chúng thuộc tài khoản Render cũ, phải đăng nhập tài khoản đó để xoá.

Vì sao đáng dọn dù không tiêu giờ chạy của tài khoản mới:

- Chúng nối vào **đúng DB Neon đang chạy production**.
- `tsudev-trust` cũ dùng **khoá ký khác** (`tsu-2026-08-13e2a3`; bản mới là
  `tsu-2026-08-efdb94`). Chứng chỉ cấp qua bản cũ ký bằng khoá không có trong
  vòng khoá của bản mới ⇒ `tsudev.com/trust` **không xác minh nổi**, và không có
  gì báo lỗi.
- Chúng chạy **mã cũ** trên dữ liệu production.

Tính tới 16/08/2026 chưa có thiệt hại: 0 chứng chỉ, 0 đơn, 0 tổ chức.

Nếu mất quyền vào tài khoản cũ, đường thay thế là **xoay mật khẩu Neon** - đổi
mật khẩu role rồi cập nhật `DATABASE_URL` của `tsudev-backend`. Có gián đoạn ngắn.

## `tsudev-backend-rqkz` - service trùng, mỗi lần push gửi một mail "deploy failed"

Triệu chứng: mỗi lần deploy, hộp thư nhận `deploy failed for tsudev-backend-rqkz`.
**Production không hề hấn gì** - mail đến từ một service THỨ HAI chưa bao giờ
khởi động nổi.

### Đã đo (18/08/2026)

```
tsudev-backend.onrender.com/health       → 200, 0.27s
  {"status":"ok","service":"backend-bundle",
   "bundled":["content","storage","trust","identity"]}

tsudev-backend-rqkz.onrender.com/health  → không phản hồi (timeout)
  nhưng DNS VẪN phân giải ⇒ service TỒN TẠI trong tài khoản,
  chỉ là không có instance nào chạy
```

`backup/production-env-2026-08-16.txt` ghi tiêu đề khối secret là
`RENDER - service "tsudev-backend"`: **secret chỉ được điền cho service không có
hậu tố.**

### Vì sao nó chết, và chết ở đúng một dòng

`render.yaml` khai `NODE_ENV: production` bằng **giá trị literal**, còn 11 biến
kia là `sync: false` (Render hỏi tay, không lấy từ git). Service `-rqkz` vì thế
khởi động với `NODE_ENV=production` mà **không có secret nào**, rồi đâm vào
`services/trust-service/src/signing.ts`:

```ts
if (process.env.NODE_ENV === 'production') {
  throw new Error('Thiếu TRUST_SIGNING_KEY - không thể cấp chứng chỉ ở môi trường production.');
}
```

`backend-bundle` **import** trust-service, nên `throw` này nổ lúc NẠP MODULE,
trước cả `startServer()`. Tiến trình thoát mã 1 ⇒ health check `/health` không
bao giờ xanh ⇒ Render đánh dấu thất bại ⇒ gửi mail. (`DATABASE_URL` thiếu cũng
đủ chết, nhưng cái trên chết sớm hơn.)

Cơ chế đang chạy **đúng như thiết kế** - "thà chết ồn ào còn hơn ký bằng khoá
dev". Nó chỉ đang la ở nhầm service.

### Hậu tố `-rqkz` đến từ đâu (SUY LUẬN, chưa xác nhận trên dashboard)

Render gắn hậu tố ngẫu nhiên khi tên service được yêu cầu **đã bị chiếm** trong
tài khoản. Nghĩa là có thứ gì đó xin tạo service tên `tsudev-backend` SAU khi
cái thật đã tồn tại - gần như chắc chắn là một **Blueprint instance** đọc
`render.yaml`. Blueprint nối vào `main` thì mỗi lần push là một lần tự đồng bộ
và deploy lại, nên mail đến đều đặn.

Chưa kiểm chứng được vì repo không có API key Render.

### Vì sao đáng dọn dù nó không tiêu giờ chạy

Nó **không** tiêu giờ instance (chưa bao giờ chạy), nên ngân sách 750 giờ vẫn
an toàn. Nhưng:

1. Ngày nào đó có người "sửa cho hết lỗi" bằng cách điền secret vào nó ⇒ hai
   service cùng chạy ⇒ vỡ ngân sách ⇒ Render dừng **cả hai**.
2. Nếu nó được cấp `TRUST_SIGNING_KEY` **khác**, lặp lại đúng sự cố ở mục trên:
   chứng chỉ ký bằng khoá không có trong vòng khoá của bản kia ⇒
   `tsudev.com/trust` không xác minh nổi, **không có gì báo lỗi**.
3. Mail thất bại đều đặn làm người vận hành quen bỏ qua - nên lần deploy hỏng
   THẬT cũng sẽ bị bỏ qua.

### Cách dọn - thứ tự quan trọng

1. Xem `tsudev-backend-rqkz` thuộc Blueprint nào (tab _Blueprints_). Có thì
   **xoá Blueprint instance TRƯỚC**. Xoá mỗi service mà để blueprint lại thì lần
   push sau nó dựng lại y nguyên, có khi kèm hậu tố mới.
2. Rồi xoá service `tsudev-backend-rqkz`.
3. Xác nhận `tsudev-backend` vẫn bật **Auto-Deploy** trên `main`. Nếu đường
   deploy tự động lâu nay do blueprint kéo thì gỡ blueprint xong phải bật lại ở
   service thật - không thì lần sau push mà backend **không cập nhật**, và triệu
   chứng là "đã gộp PR rồi mà production vẫn chạy mã cũ".

⚠️ **Đừng làm ngược lại** (xoá `tsudev-backend` để blueprint tiếp quản):
hostname sẽ đổi, kéo theo `*_SERVICE_URL` trong `wrangler.jsonc`, và
`region: singapore` là bất biến - dựng lại có thể rơi về Oregon (+140ms mỗi lượt
gọi SSR).

⚠️ Mail gửi tới `devnguyentrangtinhsu@gmail.com`, **khác** địa chỉ tài khoản chủ
dự án. Xem mục trên: có HAI tài khoản Render. Vào dashboard thì phải chắc đang
đăng nhập đúng tài khoản nhận mail đó.

## Hợp đồng cổng & tên miền

Nguồn sự thật là **`config/topology.json`**. Nó khai cả hình trạng dev lẫn tên
miền production; `npm run topology:check` (chạy trong CI và `.husky/pre-push`)
chặn cổng hardcode mọc lại. Đổi cổng ⇒ sửa file đó rồi `npm run topology:gen`.

| Tên miền     | Trỏ về        | Nền tảng                         |
| ------------ | ------------- | -------------------------------- |
| `tsudev.com` | frontend-main | Cloudflare Workers               |
| _(không có)_ | R2 object     | Cloudflare R2 - xem ghi chú dưới |

Ba service backend **không** có tên miền công khai và cũng **không giấu được
sau mạng nội bộ Render**: `frontend-main` chạy trên Cloudflare Workers, ngoài
mạng đó, nên SSR/BFF của nó buộc phải gọi qua Internet công cộng. Lớp bù là
`INTERNAL_API_TOKEN` (§dưới).

**Không dựng `cdn.tsudev.com`.** Kế hoạch cũ định trỏ nó vào bucket R2, nhưng
`S3_PUBLIC_ENDPOINT` chỉ phục vụ một việc: làm endpoint **ký URL presign**. Tên
miền tuỳ chỉnh của R2 phục vụ object qua CDN chứ không cài đặt giao thức chữ ký
S3, nên URL presign ký cho host đó bị từ chối - và gắn tên miền tuỳ chỉnh còn
làm bucket thành **công khai**, đọc được mọi file riêng tư nếu biết khoá. Endpoint
S3 API của R2 vốn đã công khai với trình duyệt, nên `S3_ENDPOINT` và
`S3_PUBLIC_ENDPOINT` **trùng nhau ở production** - khác với dev, nơi
`S3_ENDPOINT` trỏ vào `minio:9000` trong mạng docker.

Muốn có hostname CDN thật cho tài nguyên công khai thì đó là một quyết định
riêng: phải tách bucket công khai khỏi bucket riêng tư trước.

## Cổng chặn `INTERNAL_API_TOKEN`

`content` và `storage` từ chối mọi request tới `/api` nếu thiếu header
`x-internal-token` khớp giá trị. **Tự nguyện**: biến không đặt ⇒ middleware là
no-op, nên local và CI không đổi hành vi. Bật ở production bằng cách đặt cùng
một giá trị cho ba service **và** cho frontend-main.

`/health` đứng ngoài cổng chặn để health check của Render vẫn chạy.

**`trust-service` cố ý KHÔNG có cổng chặn này** - nhiều endpoint của nó phải
công khai cho bên thứ ba: huy hiệu SVG, trang xác minh, JWKS. Thêm vào là làm
hỏng chính chức năng của nó.

## Biến môi trường

Mẫu: `.env.production.example` ở gốc. Secret đặt trong dashboard Render
(`sync: false` trong blueprint nghĩa là "Render hỏi giá trị, không lưu vào git").

Bắt buộc theo service:

| Nơi chạy                   | Biến bắt buộc                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsudev-backend` (Render)  | `DATABASE_URL`, `INTERNAL_IDENTITY_SECRET`, `TOTP_ENCRYPTION_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_MAIN_URL`, `INTERNAL_API_TOKEN`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `TRUST_SIGNING_KEY`, `TRUST_SIGNING_KEY_ID` |
| Worker - `vars`            | `*_SERVICE_URL` ×4, `NEXTAUTH_URL`, `NEXTAUTH_COOKIE_DOMAIN` - khai trong `wrangler.jsonc`                                                                                                                                                                         |
| Worker - `wrangler secret` | `NEXTAUTH_SECRET`, `INTERNAL_IDENTITY_SECRET`, `INTERNAL_API_TOKEN`, `GITHUB_*`, `GOOGLE_*` - **không** commit                                                                                                                                                     |

Nhánh Toà soạn Agent AI thêm bốn biến ở `tsudev-backend`: `NEWSROOM_ENABLED`,
`NEWSROOM_TICK_TOKEN`, `CF_ACCOUNT_ID`, `CF_AI_TOKEN` (và `GEMINI_API_KEY` tuỳ
chọn). Worker cron `tsudev-newsroom-cron` giữ đúng một secret:
`NEWSROOM_TICK_TOKEN`.

### ⚠️ Ba cặp biến PHẢI TRÙNG NGUYÊN VĂN giữa hai nơi

Đây là bảng đáng nhớ nhất ở tệp này: cả ba cặp đều hỏng **im lặng**, và ba kiểu
hỏng khác nhau nên đừng chẩn đoán bằng cảm giác.

| Cặp                        | Ở đâu                    | Lệch nhau ⇒ triệu chứng                                            | Phép đo                                                            |
| -------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `INTERNAL_API_TOKEN`       | Render + Worker `tsudev` | SSR không đọc được nội dung ⇒ **trang TRỐNG mà vẫn trả 200**       | `curl -s https://tsudev.com/blog \| grep -c 'href="/blog/'`        |
| `INTERNAL_IDENTITY_SECRET` | Render + Worker `tsudev` | **mọi đường ghi đã xác thực trả 401** - "đăng nhập rồi mà vẫn 401" | đăng nhập rồi lưu `/settings/profile`; hoặc §Phép chẩn đoán ở trên |
| `NEWSROOM_TICK_TOKEN`      | Render + Worker cron     | mỗi nhịp giờ trả 401, **toà soạn đứng yên**, không có gì đỏ lên    | `POST /api/newsroom/tick` kèm token: **202** khớp, **401** lệch    |

Không đọc lại được giá trị secret của Cloudflare Worker (`wrangler secret list`
chỉ in TÊN). Nên khi nghi lệch, đừng đi tìm cách so hai chuỗi - **đặt lại một giá
trị mới ở CẢ HAI nơi** là xong, rẻ hơn mọi cách khác.

### Xoay một secret dùng chung - thứ tự để không có cửa sổ hỏng

Ví dụ với `CF_AI_TOKEN` (chỉ nằm ở Render nên đơn giản nhất):

1. Tạo token MỚI ở dashboard, **chưa xoá token cũ**.
2. Kiểm nó gọi được, trước khi đụng vào production:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8-fast \
     -H 'Authorization: Bearer <TOKEN_MỚI>' -H 'content-type: application/json' \
     -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":8}'
   # phải là 200
   ```
3. Dán vào Render → service khởi động lại.
4. Nghiệm thu toà soạn chạy được, **rồi mới** thu hồi token cũ ở dashboard.

Với cặp nằm ở HAI nơi (`INTERNAL_API_TOKEN`, `INTERNAL_IDENTITY_SECRET`,
`NEWSROOM_TICK_TOKEN`) thì có một cửa sổ hỏng không tránh được, vì hai bên không
đổi cùng lúc. Chọn thứ tự theo thứ hỏng nhẹ hơn:

- **Worker trước, Render sau**: cửa sổ hỏng nằm ở phía Worker gọi backend.
- Đặt secret Worker bằng `wrangler secret put` có hiệu lực gần như tức thì và
  **không cần deploy lại**; Render thì khởi động lại service (~1-2 phút).
- Vì thế nên làm **Render trước** rồi Worker ngay sau: cửa sổ hỏng ngắn hơn.

Sau khi xong, cập nhật `backup/production-env-*.txt` **ngay trong cùng lượt**.
Bản 16/08 thiếu `INTERNAL_IDENTITY_SECRET` và `TOTP_ENCRYPTION_KEY`, và chính chỗ
thiếu đó là lý do biến đầu chưa bao giờ được đặt ở Render.

⚠️ Hai cờ bỏ qua xác thực thời dev (`AUTH_DEV_BYPASS` và cờ dành cho E2E) **đã bị gỡ khỏi mã nguồn**; đặt lại không có tác dụng gì.
Chúng cho phép đăng nhập bằng bất kỳ username nào.

Hai biến "một lần rồi thôi":

- **`TRUST_ISSUER` được ký vào chứng chỉ.** Đổi sau khi đã cấp thì chứng chỉ cũ
  vẫn mang URL cũ. Đặt đúng domain thật **trước** lần cấp đầu tiên.
- **`TRUST_SIGNING_KEY` thiếu ở production ⇒ service từ chối khởi động.** Cố ý.
  Quy trình xoay khoá: [trust-seal.md](trust-seal.md).

`S3_ENDPOINT` (nội bộ) và `S3_PUBLIC_ENDPOINT` (qua CDN) phải tách riêng, nếu
không URL presign trả về cho trình duyệt sẽ trỏ vào host nội bộ.

## Migration khi deploy

`prisma migrate deploy` **không** tự chạy khi service khởi động. Chạy nó trước
khi phát hành phiên bản có migration mới, nếu không service boot lên rồi lỗi
runtime vì thiếu cột.

## Giám sát

`packages/observability`:

- `initSentry.js` - bật khi có `SENTRY_DSN` (cả server lẫn browser).
- `notify.js` - gửi cảnh báo tới Telegram (`TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`) và email (`ALERT_EMAIL_WEBHOOK`, `ALERT_EMAIL_TO`). Chưa
  cấu hình thì chỉ log `would send` - an toàn cho dev.
- New Relic: `newrelic.js` ở gốc + `NEW_RELIC_LICENSE_KEY`.

Nghiệm thu đường cảnh báo: `GET /debug/boom` trên content-service (chỉ có ngoài
production) → 500 → cảnh báo phải tới trong 30 giây (§6.3 của TSD).

Kế hoạch Cloudflare CDN/WAF/R2/Zero Trust: [../infrastructure/README.md](../infrastructure/README.md).

## Đưa lên nhánh main

`main` **không** có branch protection - GitHub Free không hỗ trợ cho repo
private. Lớp chắn duy nhất là hook client `.husky/pre-push`, tự cài khi
`npm install`. Máy mới clone mà chưa `npm install` thì **không có** lớp chắn nào.

Làm việc trên nhánh feature, mở PR. Thật sự cần vượt: `ALLOW_MAIN_FORCE=1 git push`.
