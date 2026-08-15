# Triển khai production

Hai nhà cung cấp, hai đường deploy khác nhau. Biết mình đang đổi cái nào.

| Thành phần       | Nền tảng           | Định nghĩa ở đâu                                    |
| ---------------- | ------------------ | --------------------------------------------------- |
| `frontend-main`  | Cloudflare Workers | `apps/frontend-main/wrangler.jsonc`                 |
| `backend-bundle` | Render (Docker)    | `render.yaml` + `docker/backend-service.Dockerfile` |
| Keycloak (SSO)   | Render (Docker)    | `render.yaml` + `docker/keycloak.Dockerfile`        |
| PostgreSQL       | ngoài (Neon)       | `DATABASE_URL`, `KC_DB_*` (secret Render)           |

## Frontend — Cloudflare Workers

`frontend-main` build qua `@opennextjs/cloudflare` (không phải Pages):

```bash
npm --workspace apps/frontend-main run preview   # build + chạy thử local
npm --workspace apps/frontend-main run deploy    # build + deploy
npm --workspace apps/frontend-main run cf-typegen  # sinh lại cloudflare-env.d.ts
```

Worker tên `tsudev`. `wrangler.jsonc` có **service binding tự trỏ về chính nó**
(`WORKER_SELF_REFERENCE`) mà OpenNext cần cho tầng cache — tên binding phải khớp
đúng tên worker, đổi tên worker mà quên sửa binding thì cache hỏng lặng lẽ.

### Bẫy: `.env.local` thắng `.env.production` — đã từng thành lỗ hổng thật

`NEXT_PUBLIC_*` được Next **nội suy lúc build**, không đọc lúc chạy — nên không
đặt được từ dashboard Cloudflare. Giá trị production nằm ở
`apps/frontend-main/.env.production` (sinh từ `config/topology.json`).

Nhưng Next xếp **`.env.local` CAO HƠN `.env.production`**, mà
`apps/frontend-main/.env.local` là **bản sao nguyên văn `.env` gốc** (do
`scripts/write-env-local.js` sinh), và lệnh deploy chạy **trên máy dev**.

Ngày 16/08/2026 điều này đã thành lỗ hổng thật trên production: bản dựng mang
theo `E2E_BYPASS_KEYCLOAK=1`, nên NextAuth bật provider `e2e-dev` và **bất kỳ ai
cũng đăng nhập được vào tài khoản ADMIN bằng mật khẩu `devpass`**. Cùng đường đó
còn kéo theo `NEXTAUTH_SECRET=change-me-secret`, `KEYCLOAK_CLIENT_SECRET=dev-secret`
và khoá ký dev. Site vẫn chạy bình thường; không có gì báo lỗi.

Vì thế `deploy`/`preview`/`upload` **không gọi thẳng `opennextjs-cloudflare`**
nữa mà đi qua `scripts/deploy-frontend.js`. Script đó **dời `.env.local` ra khỏi
đường trong suốt lúc dựng** rồi trả lại (kể cả khi bị Ctrl-C; lần chạy sau còn
tự dọn tàn dư). Chặn từng biến một là trò đuổi bắt — mỗi biến dev mới thêm vào
`.env` lại là một lỗ mới.

```bash
npm --workspace apps/frontend-main run deploy
```

**Nghiệm thu sau mỗi lần deploy** — một lệnh, đáng chạy mọi lần:

```bash
curl -s https://tsudev.com/api/auth/providers   # phải CHỈ có "keycloak"
```

Thấy `e2e-dev` trong đó là bản dựng đã nhiễm giá trị dev — dừng và tìm nguồn.

## Backend — Render

Blueprint `render.yaml` khai báo **2** web service, cả hai `plan: free`,
`region: singapore`: `tsudev-backend` (ba service gộp) và `tsudev-sso`
(Keycloak, `healthCheckPath: /health/ready`).

### Ngân sách giờ chạy — quyết định thiết kế, không phải chi tiết vặt

Gói free cấp **750 giờ instance/tháng cho CẢ TÀI KHOẢN**, không phải cho mỗi
service. Một service chạy liên tục tiêu 720 giờ. Nên chỉ giữ ấm được **đúng
một** service, và đó phải là `tsudev-backend` — nó nằm trên mọi đường đọc của
site. `tsudev-sso` buộc phải được ngủ; cái giá là cold start ở lần đăng nhập
đầu tiên, và đó là đánh đổi có chủ ý. Thêm service thứ ba chạy liên tục là vỡ
ngân sách và Render dừng hết.

### Region là bất biến

Đổi `region` trong `render.yaml` **không** di chuyển service đang chạy — phải
xoá và dựng lại. Trước đây file này không khai region nên cả bốn service nằm ở
Oregon (mặc định của Render), cách Việt Nam ~180ms mỗi lượt gọi SSR; singapore
còn ~40ms.

Hai service dùng **chung một image** (`docker/backend-service.Dockerfile`);
Render chọn service bằng cách override `dockerCommand`. Vì vậy:

- **Build context phải là gốc repo.** Các service phụ thuộc package nội bộ
  `@tsudev/db`, `@tsudev/types` — không có trên npm registry, `npm install` cô
  lập trong `services/<tên>` sẽ 404.
- Image cài cả devDependencies vì cần prisma CLI để `prisma generate`.
- `--ignore-scripts` để bỏ qua `prepare` (husky) — image production không có
  `.git`.

Đổi cấu trúc package/workspace là đổi cả Dockerfile này. Đọc phần chú thích ở
đầu file trước khi sửa.

## Chế độ gộp — `services/backend-bundle`

**Production chạy ba service backend trong MỘT tiến trình.** Đây là hình trạng
thật, không phải tối ưu tuỳ chọn:

- Render free cấp **750 giờ instance/tháng cho cả tài khoản**. Ba service chạy
  liên tục cần 2160 giờ ⇒ không giữ ấm được cái nào ⇒ khách đầu tiên sau 15 phút
  vắng phải chờ ~50s cold start. Một tiến trình cần 720 giờ — vừa đủ để ping giữ
  ấm.
- Một pool kết nối Prisma thay vì ba, đáng kể với giới hạn kết nối của Neon free.

Nó **không phải API gateway**: không định tuyến lại, không đổi đường dẫn, không
thêm lớp xác thực. Mỗi app con giữ nguyên middleware, cổng chặn và quy tắc auth
của chính nó.

Điều phối bằng **bảng tiền tố đường dẫn** trong `services/backend-bundle/src/index.js`.
Vì sao không mount thẳng ba app chồng lên nhau: request `/api/trust/*` sẽ đi vào
app content trước và dính cổng chặn `INTERNAL_API_TOKEN` của nó — huy hiệu SVG,
trang xác minh và JWKS (bắt buộc công khai cho bên thứ ba) trả 401, **không có
gì báo lỗi**. `services/backend-bundle/test/routing.test.js` canh đúng chỗ này.

⚠️ **Thêm route mới với tiền tố chưa có trong bảng ⇒ route đó 404 ở production**
dù chạy service riêng vẫn thấy nó sống. Sửa route thì sửa bảng.

Chạy ở local đúng hình prod:

```bash
npm run dev:merged     # một tiến trình, cổng 4000
```

## Ba service cũ ở tài khoản Render KHÁC — chưa dọn

`tsudev-content`, `tsudev-storage`, `tsudev-trust` (Oregon) **vẫn đang chạy** và
**không nằm trong tài khoản Render hiện tại** — API key của tài khoản mới không
thấy chúng. Chúng thuộc tài khoản Render cũ, phải đăng nhập tài khoản đó để xoá.

Vì sao đáng dọn dù không tiêu giờ chạy của tài khoản mới:

- Chúng nối vào **đúng DB Neon đang chạy production**.
- `tsudev-trust` cũ dùng **khoá ký khác** (`tsu-2026-08-13e2a3`; bản mới là
  `tsu-2026-08-efdb94`). Chứng chỉ cấp qua bản cũ ký bằng khoá không có trong
  vòng khoá của bản mới ⇒ `tsudev.com/trust` **không xác minh nổi**, và không có
  gì báo lỗi.
- Chúng chạy **mã cũ** trên dữ liệu production.

Tính tới 16/08/2026 chưa có thiệt hại: 0 chứng chỉ, 0 đơn, 0 tổ chức.

Nếu mất quyền vào tài khoản cũ, đường thay thế là **xoay mật khẩu Neon** — đổi
mật khẩu role rồi cập nhật đồng bộ `DATABASE_URL` của `tsudev-backend` và
`KC_DB_PASSWORD` của `tsudev-sso`. Có gián đoạn ngắn.

## Keycloak trên Render — những vết đã trả giá

Free tier giới hạn **512MB RAM**. Bốn lần sửa liên tiếp (commit #3–#7) đều xoay
quanh chỗ này; đừng lặp lại:

- `start-dev` build lúc container khởi động → **OOM ngay bước đầu**. Phải
  `kc.sh build` lúc `docker build`, runtime chỉ `start --optimized`.
- `--cache=local` là **build-time option**, chỉ hợp lệ ở `kc.sh build`. Đặt nó
  vào `start` thì Keycloak **treo cứng** chờ cluster JGroups.
- `dev-mem` (H2 trong RAM) **sai**: free tier ngủ rồi khởi động lại thường
  xuyên, mỗi lần là xoá sạch toàn bộ tài khoản. Phải trỏ Postgres thật.
- Chỉ chọn `KC_DB=postgres` lúc build; URL/user/pass là runtime option đọc từ
  secret của Render, **không bake vào image**.
- Render tiêm `PORT` lúc chạy ⇒ `CMD` phải qua shell để giãn `${PORT}`, không
  dùng exec-form.
- Giới hạn heap JVM: `-Xms64m -Xmx320m -XX:MaxMetaspaceSize=128m`.

Realm production: `apps/sso-auth/keycloak/realm-export.prod.json` (khác bản dev).

⚠️ **`--import-realm` chỉ import khi realm CHƯA tồn tại.** Sửa file realm trong
repo rồi deploy lại **không** đổi được realm đang chạy — Keycloak bỏ qua trong im
lặng. Muốn đổi cấu hình realm đã chạy thì phải sửa qua Admin console/API, hoặc
xoá realm rồi cho import lại (mất toàn bộ user của realm đó).

Lấy client secret bằng API thay vì mò console:

```bash
KC=https://auth.tsudev.com
TOK=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d client_id=admin-cli -d username=tsudev-admin \
  --data-urlencode "password=$KEYCLOAK_ADMIN_PASSWORD" -d grant_type=password \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).access_token")
curl -s -H "Authorization: Bearer $TOK" \
  "$KC/admin/realms/tsudev/clients?clientId=tsudev-frontend"
```

Service ngủ dậy mất tới ~2 phút. Lệnh đăng nhập trả `invalid_grant` ngay sau khi
Render vừa khởi động **không có nghĩa là sai mật khẩu** — đợi rồi thử lại.

## Hợp đồng cổng & tên miền

Nguồn sự thật là **`config/topology.json`**. Nó khai cả hình trạng dev lẫn tên
miền production; `npm run topology:check` (chạy trong CI và `.husky/pre-push`)
chặn cổng hardcode mọc lại. Đổi cổng ⇒ sửa file đó rồi `npm run topology:gen`.

| Tên miền          | Trỏ về        | Nền tảng                         |
| ----------------- | ------------- | -------------------------------- |
| `tsudev.com`      | frontend-main | Cloudflare Workers               |
| `auth.tsudev.com` | Keycloak      | Render                           |
| _(không có)_      | R2 object     | Cloudflare R2 — xem ghi chú dưới |

Ba service backend **không** có tên miền công khai và cũng **không giấu được
sau mạng nội bộ Render**: `frontend-main` chạy trên Cloudflare Workers, ngoài
mạng đó, nên SSR/BFF của nó buộc phải gọi qua Internet công cộng. Lớp bù là
`INTERNAL_API_TOKEN` (§dưới).

**Không dựng `cdn.tsudev.com`.** Kế hoạch cũ định trỏ nó vào bucket R2, nhưng
`S3_PUBLIC_ENDPOINT` chỉ phục vụ một việc: làm endpoint **ký URL presign**. Tên
miền tuỳ chỉnh của R2 phục vụ object qua CDN chứ không cài đặt giao thức chữ ký
S3, nên URL presign ký cho host đó bị từ chối — và gắn tên miền tuỳ chỉnh còn
làm bucket thành **công khai**, đọc được mọi file riêng tư nếu biết khoá. Endpoint
S3 API của R2 vốn đã công khai với trình duyệt, nên `S3_ENDPOINT` và
`S3_PUBLIC_ENDPOINT` **trùng nhau ở production** — khác với dev, nơi
`S3_ENDPOINT` trỏ vào `minio:9000` trong mạng docker.

Muốn có hostname CDN thật cho tài nguyên công khai thì đó là một quyết định
riêng: phải tách bucket công khai khỏi bucket riêng tư trước.

## Cổng chặn `INTERNAL_API_TOKEN`

`content` và `storage` từ chối mọi request tới `/api` nếu thiếu header
`x-internal-token` khớp giá trị. **Tự nguyện**: biến không đặt ⇒ middleware là
no-op, nên local và CI không đổi hành vi. Bật ở production bằng cách đặt cùng
một giá trị cho ba service **và** cho frontend-main.

`/health` đứng ngoài cổng chặn để health check của Render vẫn chạy.

**`trust-service` cố ý KHÔNG có cổng chặn này** — nhiều endpoint của nó phải
công khai cho bên thứ ba: huy hiệu SVG, trang xác minh, JWKS. Thêm vào là làm
hỏng chính chức năng của nó.

## Biến môi trường

Mẫu: `.env.production.example` ở gốc. Secret đặt trong dashboard Render
(`sync: false` trong blueprint nghĩa là "Render hỏi giá trị, không lưu vào git").

Bắt buộc theo service:

| Nơi chạy                   | Biến bắt buộc                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsudev-backend` (Render)  | `KEYCLOAK_ISSUER`, `DATABASE_URL`, `INTERNAL_API_TOKEN`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `TRUST_SIGNING_KEY`, `TRUST_SIGNING_KEY_ID` |
| `tsudev-sso` (Render)      | `KEYCLOAK_ADMIN_PASSWORD`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD`                                                                                                               |
| Worker — `vars`            | `*_SERVICE_URL` ×3, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `NEXTAUTH_URL`, `NEXTAUTH_COOKIE_DOMAIN` — khai trong `wrangler.jsonc`                                                      |
| Worker — `wrangler secret` | `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_SECRET`, `INTERNAL_API_TOKEN` — **không** commit                                                                                                     |

`KEYCLOAK_ISSUER` thiếu ở bất kỳ đâu là rơi về mặc định local, JWKS trỏ vào hư
vô, **mọi token thật bị 401**.

⚠️ **Production tuyệt đối không đặt `E2E_BYPASS_KEYCLOAK` hay `AUTH_DEV_BYPASS`.**
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

- `initSentry.js` — bật khi có `SENTRY_DSN` (cả server lẫn browser).
- `notify.js` — gửi cảnh báo tới Telegram (`TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`) và email (`ALERT_EMAIL_WEBHOOK`, `ALERT_EMAIL_TO`). Chưa
  cấu hình thì chỉ log `would send` — an toàn cho dev.
- New Relic: `newrelic.js` ở gốc + `NEW_RELIC_LICENSE_KEY`.

Nghiệm thu đường cảnh báo: `GET /debug/boom` trên content-service (chỉ có ngoài
production) → 500 → cảnh báo phải tới trong 30 giây (§6.3 của TSD).

Kế hoạch Cloudflare CDN/WAF/R2/Zero Trust: [../infrastructure/README.md](../infrastructure/README.md).

## Đưa lên nhánh main

`main` **không** có branch protection — GitHub Free không hỗ trợ cho repo
private. Lớp chắn duy nhất là hook client `.husky/pre-push`, tự cài khi
`npm install`. Máy mới clone mà chưa `npm install` thì **không có** lớp chắn nào.

Làm việc trên nhánh feature, mở PR. Thật sự cần vượt: `ALLOW_MAIN_FORCE=1 git push`.
