# Triển khai production

Hai nhà cung cấp, hai đường deploy khác nhau. Biết mình đang đổi cái nào.

| Thành phần        | Nền tảng           | Định nghĩa ở đâu                                    |
| ----------------- | ------------------ | --------------------------------------------------- |
| `frontend-main`   | Cloudflare Workers | `apps/frontend-main/wrangler.jsonc`                 |
| 4 service backend | Render (Docker)    | `render.yaml` + `docker/backend-service.Dockerfile` |
| Keycloak (SSO)    | Render (Docker)    | `render.yaml` + `docker/keycloak.Dockerfile`        |
| PostgreSQL        | ngoài (Neon)       | `DATABASE_URL`, `KC_DB_*` (secret Render)           |
| `frontend-forum`  | **chưa có**        | —                                                   |

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

`frontend-forum` chưa có đường deploy. Thêm thì phải đối chiếu phiên bản Next
(forum đang ở Next 13, main ở Next 15) — `@opennextjs/cloudflare` hỗ trợ theo
phiên bản Next.

## Backend — Render

Blueprint `render.yaml` khai báo 5 web service, tất cả `plan: free`,
`healthCheckPath: /health` (Keycloak dùng `/health/ready`).

Bốn service backend dùng **chung một image**
(`docker/backend-service.Dockerfile`); Render chọn service bằng cách override
`dockerCommand`. Vì vậy:

- **Build context phải là gốc repo.** Các service phụ thuộc package nội bộ
  `@tsudev/db`, `@tsudev/types` — không có trên npm registry, `npm install` cô
  lập trong `services/<tên>` sẽ 404.
- Image cài cả devDependencies vì cần prisma CLI để `prisma generate`.
- `--ignore-scripts` để bỏ qua `prepare` (husky) — image production không có
  `.git`.

Đổi cấu trúc package/workspace là đổi cả Dockerfile này. Đọc phần chú thích ở
đầu file trước khi sửa.

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

## Hợp đồng cổng & tên miền

Nguồn sự thật là **`config/topology.json`**. Nó khai cả hình trạng dev lẫn tên
miền production; `npm run topology:check` (chạy trong CI và `.husky/pre-push`)
chặn cổng hardcode mọc lại. Đổi cổng ⇒ sửa file đó rồi `npm run topology:gen`.

| Tên miền          | Trỏ về         | Nền tảng           |
| ----------------- | -------------- | ------------------ |
| `tsudev.vn`       | frontend-main  | Cloudflare Workers |
| `forum.tsudev.vn` | frontend-forum | **chưa có đường**  |
| `auth.tsudev.vn`  | Keycloak       | Render             |
| `cdn.tsudev.vn`   | R2 public      | Cloudflare R2      |

Bốn service backend **không** có tên miền công khai và cũng **không giấu được
sau mạng nội bộ Render**: `frontend-main` chạy trên Cloudflare Workers, ngoài
mạng đó, nên SSR/BFF của nó buộc phải gọi qua Internet công cộng. Lớp bù là
`INTERNAL_API_TOKEN` (§dưới).

## Cổng chặn `INTERNAL_API_TOKEN`

`user`, `content`, `storage` từ chối mọi request tới `/api` nếu thiếu header
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

| Service       | Biến bắt buộc                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------- |
| cả bốn        | `KEYCLOAK_ISSUER` — thiếu là rơi về mặc định local, JWKS trỏ vào hư vô, **mọi token thật bị 401**  |
| user, content | `DATABASE_URL`                                                                                     |
| storage       | `DATABASE_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| trust         | `DATABASE_URL`, `TRUST_SIGNING_KEY`, `TRUST_SIGNING_KEY_ID`, `TRUST_ISSUER`                        |
| Keycloak      | `KEYCLOAK_ADMIN_PASSWORD`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD`                         |

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
