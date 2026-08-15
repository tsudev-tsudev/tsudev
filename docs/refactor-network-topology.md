# Kế hoạch tái cấu trúc cổng & tên miền

Mục tiêu: gỡ mười cổng `localhost` rải rác thành **một hợp đồng mạng duy nhất**,
để hình trạng lúc dev trùng khớp hình trạng production (`tsudev.com` +
subdomain), và mọi giá trị cổng/hostname chỉ tồn tại ở **một** file.

Tài liệu này là **kế hoạch**, chưa phải hiện trạng. Hiện trạng vẫn là bảng cổng
trong `CLAUDE.md`.

> **Ghi chú lịch sử (16/08/2026).** Tên miền production đã đổi từ `tsudev.vn`
> (dự kiến, chưa từng đăng ký) sang **`tsudev.com`** — tên miền thật, đăng ký
> tại Spaceship. Chuỗi tên miền trong tài liệu này đã được cập nhật theo. Mọi
> nhắc tới **diễn đàn / `forum.*`** là bối cảnh của thời điểm viết: app đó đã bị
> xoá ở PR #9, tsudev nay chỉ còn một app trên một origin.

---

## 1. Hiện trạng đo được

### 1.1 Bản đồ cổng đang dùng

| Cổng | Thành phần              | Trình duyệt thấy? | Khai ở đâu                                          |
| ---- | ----------------------- | ----------------- | --------------------------------------------------- |
| 3000 | frontend-main           | ✅                | `apps/frontend-main/package.json`, `run-dev.js`     |
| 3001 | frontend-forum          | ✅                | `apps/frontend-forum/package.json`, `run-dev.js`    |
| 4000 | user-service            | ❌ (chỉ SSR)      | `services/user-service/src/index.js:26`             |
| 4001 | content-service         | ❌ (chỉ SSR/BFF)  | `services/content-service/src/index.js:26`          |
| 4002 | storage-service         | ⚠️ **có**         | `services/storage-service/src/index.js:29`          |
| 4003 | trust-service           | ❌ (chỉ BFF)      | `services/trust-service/src/index.js:35`            |
| 5433 | PostgreSQL (local)      | ❌                | `.env`                                              |
| 5432 | PostgreSQL (compose/CI) | ❌                | `docker-compose.yml`, `.github/workflows/ci.yml:37` |
| 6379 | Redis                   | ❌                | `docker-compose.yml`                                |
| 8080 | Keycloak                | ✅                | `docker-compose.yml`                                |
| 9000 | MinIO                   | ✅ (presign)      | `docker-compose.yml`                                |

Mười một dòng, bảy nguồn khai báo, không nguồn nào là nguồn sự thật.

### 1.2 Điểm hardcode `localhost:<port>`

17 vị trí có giá trị mặc định cứng, mỗi vị trí là một cơ hội lệch:

- `packages/ui/src/lib/siteUrls.js:10-11` — `:3000` / `:3001`
- `apps/frontend-main/lib/api.js:3-4`, `lib/bff.js:6`, `lib/trust.js:8`
- `apps/frontend-main/pages/api/trust/[...path].js:16`, `pages/api/trust/jwks.js:4`, `pages/api/mod/[...path].js:6`
- `apps/frontend-forum/lib/api.js:2-3`, `pages/api/forum/[...path].js:5`
- Bốn `services/*/src/authMiddleware.js:4` — `http://localhost:8080/realms/tsudev-local`
- Bốn `services/*/Dockerfile:7` — HEALTHCHECK
- `scripts/verify-stack.js:70-77`, `scripts/keycloak-*.js`, `scripts/test-presign.js`, `e2e/playwright.config.js:8`

### 1.3 Bảy khiếm khuyết phát hiện kèm theo

| #   | Khiếm khuyết                                                                                                                                                                                                                                                                                                                | Bằng chứng                                                                                                                   | Mức |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | ✅ _(đã khai vào `render.yaml`)_ **Production không có `KEYCLOAK_ISSUER`.** Bốn service rơi về mặc định `http://localhost:8080/...` ⇒ `createRemoteJWKSet` trỏ vào hư vô ⇒ mọi JWT thật bị 401.                                                                                                                             | `render.yaml` không khai biến này cho service nào; `services/*/src/authMiddleware.js:4`                                      | 🔴  |
| 2   | **Production không có `REQUIRE_ROLE_ENFORCEMENT`** ⇒ `requireRole()` là no-op trên production, đúng như cảnh báo trong `CLAUDE.md` nhưng chưa ai đặt biến.                                                                                                                                                                  | `render.yaml`; `services/*/src/authMiddleware.js:75-79`                                                                      | 🔴  |
| 3   | 🟠 _(hạ mức — xem §5.1)_ **`TRUST_ISSUER` có ba giá trị khác nhau** và nó **được ký vào chứng chỉ**: `.env` = `http://localhost:3000`, `render.yaml` = `...workers.dev`, mặc định trong mã = `https://tsudev.com`. Không có cơ chế "issuer đã nghỉ hưu" (khác với khoá ký).                                                 | `.env`; `render.yaml`; `services/trust-service/src/certificates.js:7`                                                        | 🔴  |
| 4   | **Realm dev chỉ cho phép redirect về hostname Docker** (`http://frontend-main:3000`) ⇒ đăng nhập Keycloak thật từ `localhost:3000` không bao giờ chạy; đó là lý do tồn tại `E2E_BYPASS_KEYCLOAK`. Realm prod **không có** redirect URI nào cho forum.                                                                       | `apps/sso-auth/keycloak/realm-export.json:8-10`, `realm-export.prod.json:8-10`                                               | 🟠  |
| 5   | **`storage-service` là service duy nhất trình duyệt gọi thẳng, và nó bật `cors()` mở toàn bộ.** Không có route BFF `/api/storage/*` ở app nào.                                                                                                                                                                              | `services/storage-service/src/index.js:37`; `apps/*/pages/api/` không có `storage`                                           | 🟠  |
| 6   | ✅ _(đã xử lý)_ **Một biến môi trường chết**: `NEXT_PUBLIC_STORAGE_URL` và `STORAGE_SERVICE_URL` được khai ở `.env.example`, `.env.production.example`, `docker-compose.yml` nhưng **không dòng mã nào đọc**.                                                                                                               | `grep` toàn repo: 0 lượt đọc                                                                                                 | 🟡  |
| 8   | ✅ _(đã xử lý — xem §1.5)_ **Toàn bộ bộ E2E không chạy được ở đâu.** `e2e/` không nằm trong `workspaces`, `@playwright/test` chưa từng được cài, không có trình duyệt Playwright, và CI không có job E2E. `e2e/tests/sso-upload.spec.js` sẽ ném lỗi ngay ở dòng `require`.                                                  | `package.json` (`workspaces`); `node -e "require.resolve('@playwright/test')"` → lỗi; `~/.cache/ms-playwright` không tồn tại | 🟠  |
| 9   | ✅ _(đã xử lý)_ **`.prettierignore` thiếu `.open-next`** ⇒ sau khi build frontend-main, `npm run format:check` cục bộ đỏ 70 file build output. CI không thấy vì checkout sạch.                                                                                                                                              | `.prettierignore`; `apps/frontend-main/.gitignore:2`                                                                         | 🟡  |
| 10  | **Hai realm Keycloak không khai một vai trò nào.** `realm-export.json` và `realm-export.prod.json` chỉ có client `tsudev-frontend`, không có `roles`. Nhưng mã lại đòi `content:read`, `user:read`, `storage:presign`, `storage:upload`. Bật `REQUIRE_ROLE_ENFORCEMENT=true` ⇒ 5 route đó **403 với mọi người, vĩnh viễn**. | `grep '"name"' apps/sso-auth/keycloak/realm-export*.json` → chỉ ra `tsudev-frontend`                                         | 🔴  |
| 7   | ✅ _(đã xử lý)_ **Postgres ba giá trị cổng** (5433 local / 5432 compose / 5432 CI) trong khi `CLAUDE.md` khẳng định "5433, **không** phải 5432".                                                                                                                                                                            | `.env`; `docker-compose.yml`; `.github/workflows/ci.yml:37`                                                                  | 🟡  |

Khiếm khuyết 1–3 **không phải** hệ quả của việc nhiều cổng, nhưng chúng sống
được vì cùng một nguyên nhân gốc: **không ai có bảng đối chiếu giữa dev và
production.** Tái cấu trúc này tạo ra bảng đó, nên sửa chúng luôn trong cùng
chuỗi việc.

### 1.4 Vì sao hình trạng dev sai lệch là đắt

`packages/ui/src/lib/siteUrls.js` tồn tại **chỉ để** bắc cầu hai origin. Nhưng
hai app hồi đó nằm trên cùng host `localhost` khác cổng nên **dùng chung kho
cookie** (cookie không phân biệt cổng), còn hai subdomain thật thì **không** — chúng cần
`NEXTAUTH_COOKIE_DOMAIN=.tsudev.com`. Nghĩa là:

> Lớp chia sẻ phiên đăng nhập giữa hai app **không thể kiểm chứng ở dev** với
> hình trạng hiện tại. Nó chỉ lộ đúng/sai lần đầu trên production.

Đó là chi phí thật của mười cổng, không phải chuyện thẩm mỹ URL.

---

## 1.5 Trạng thái thực hiện

| Giai đoạn                      | Trạng thái                                                      |
| ------------------------------ | --------------------------------------------------------------- |
| 0 — Lưới an toàn               | ✅ xong                                                         |
| 1 — Nguồn sự thật              | ✅ xong                                                         |
| 2 — Dọn nợ môi trường          | ⬜ chưa bắt đầu                                                 |
| 3 — Dev-proxy + subdomain      | ⬜ chưa bắt đầu                                                 |
| 4 — Đóng đường tắt trình duyệt | ✅ xong                                                         |
| 5 — Hình trạng production      | 🟡 phần mã xong; phần dashboard Cloudflare/Render chưa làm được |
| 6 — Tài liệu                   | ✅ xong                                                         |

**Đã thêm ở giai đoạn 3:**

| File                   | Vai trò                                                   |
| ---------------------- | --------------------------------------------------------- |
| `scripts/dev-proxy.js` | cổng vào duy nhất, định tuyến theo Host, có nhánh upgrade |

Keycloak chuyển 8080 → **4100**; `config/topology.json` đặt `dev.mode = "proxy"`;
`run-dev.js` dựng proxy trước rồi mới tới Next (bind `127.0.0.1`);
`write-env-local.js`, `e2e/playwright.config.js`, ba script `keycloak-*.js` đọc
topology; realm dev nhận thêm hai origin mới mà **vẫn giữ** hostname Docker.

**Kết quả spike 3a — ĐẠT, không cần phương án B:**

| Trình duyệt | cookie có `Domain=.tsudev.localhost` | cookie host-only |
| ----------- | ------------------------------------ | ---------------- |
| Chromium    | forum thấy ✅                        | forum KHÔNG thấy |
| Firefox     | forum thấy ✅                        | forum KHÔNG thấy |

Vế phải là điều làm cho vế trái có ý nghĩa: phiên dùng chung được **chỉ có thể**
nhờ thuộc tính `Domain`, không phải nhờ hai app tình cờ chung kho cookie như hồi
còn `localhost:3000`/`:3001`.

**Đo được sau giai đoạn 3:**

```
✓ Set-Cookie: next-auth.session-token=…; Domain=.tsudev.localhost; Path=/
✓ check-session-sharing qua proxy: main → forum giữ nguyên phiên (tsudev)
✓ e2e:session qua proxy: 1 passed
✓ WebSocket upgrade (/_next/webpack-hmr): 101 qua proxy — HMR còn sống
✓ host lạ → 404 kèm danh sách địa chỉ hợp lệ; upstream chết → 502 nêu rõ node
```

**Đã thêm ở giai đoạn 4–6:**

| Thay đổi                                            | Vì sao                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| `apps/frontend-main/pages/api/storage/[...path].js` | đóng đường tắt trình duyệt → storage-service          |
| `apps/*/lib/services.js`                            | 6 literal địa chỉ service → **1 mỗi app**             |
| `cors()` mở toàn bộ → whitelist theo topology       | storage là service duy nhất trình duyệt chạm tới      |
| `BIND_HOST` (4 service, mặc định `0.0.0.0`)         | dev nghe loopback; container/production không đổi     |
| `S3_PUBLIC_ENDPOINT` sinh từ topology               | presign hết trỏ vào host nội bộ của MinIO             |
| `INTERNAL_API_TOKEN` (user/content/storage)         | 3 service nằm ở URL Render công khai, không giấu được |
| 12 test mới cho cổng chặn token                     | thêm cổng chặn thì phải có test cho nó                |
| `topology:check` quét thêm `docs/`, `README.md`     | drift tài liệu ở giai đoạn 3 không cổng nào bắt       |

**Đo được sau giai đoạn 4–6:**

```
✓ storage-service LISTEN 127.0.0.1:4002 (trước là 0.0.0.0)
✓ CORS: origin main → cấp header · origin lạ → không cấp + có log · không Origin → 200
✓ BFF /api/storage/*: chưa đăng nhập 401 · đã đăng nhập 200 · presign OK
✓ presign host = cdn.tsudev.localhost:8080 (trước: host nội bộ của MinIO)
✓ 41/41 unit test · build cả hai app · e2e:session · lint · prettier · topology:check
```

**Đã thêm ở giai đoạn 0–1:**

| File                                     | Vai trò                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `config/topology.json`                   | nguồn sự thật về cổng/tên miền                     |
| `config/topology.allow`                  | nợ hardcode có đăng ký, mỗi mục ghi giai đoạn gỡ   |
| `scripts/topology/load.js`               | dẫn xuất URL ba tầng từ topology                   |
| `scripts/topology/gen-env.js`            | đồng bộ `.env` + `.env.example`, có `--check`      |
| `scripts/topology/check.js`              | cổng chặn hồi quy (3 quy tắc)                      |
| `scripts/check-session-sharing.js`       | lưới an toàn — phiên xuyên origin, tầng HTTP       |
| `e2e/tests/cross-origin-session.spec.js` | lưới an toàn — bản trình duyệt, chạy được trong CI |

`scripts/verify-stack.js` và `e2e/playwright.config.js` đã chuyển sang đọc
topology (hết hardcode). `npm run topology:check` đã gắn vào job `lint` của CI và
`.husky/pre-push`.

**Bộ E2E đã được nối dây** (khiếm khuyết #8): `@playwright/test` vào
devDependencies gốc, `playwright.config.js` tự dựng hai frontend qua `webServer`,
và tách làm hai project:

| Project      | Test                        | Cần gì            | Ở CI |
| ------------ | --------------------------- | ----------------- | ---- |
| `session`    | `cross-origin-session.spec` | hai frontend      | ✅   |
| `full-stack` | `sso-upload.spec`           | + MinIO, Keycloak | ❌   |

Chạy: `npm run e2e:session` (lưới an toàn) hoặc `npm run e2e` (tất cả).
Job CI `e2e-session` chạy mọi push — chỉ cài chromium, không cần Postgres.

**Kết quả đo được:**

```
✓ topology:check — 59 literal cổng, tất cả khớp topology (30 file miễn trừ)
✓ .env / .env.example khớp topology
✓ check-session-sharing: main → forum giữ nguyên phiên (tsudev)
✓ e2e:session — 1 passed (bấm link "Diễn đàn", sang đúng origin, còn phiên)
✓ 4 bộ test service: 29/29 (đã thử với REQUIRE_ROLE_ENFORCEMENT=true)
✓ npm run lint · npx prettier --check .
```

`gen-env` chỉ **thêm** ba khoá vào `.env`/`.env.example`
(`USER_SERVICE_URL`, `CONTENT_SERVICE_URL`, `STORAGE_SERVICE_URL`, giá trị trùng
đúng fallback đang có trong mã) — **không giá trị nào bị đổi**. Giai đoạn 1 giữ
đúng cam kết không đổi hành vi.

---

## 2. Kiến trúc đích

### 2.1 Ba tầng URL — đặt tên tách bạch

Nguyên nhân lẫn lộn hiện nay là ba khái niệm khác nhau dùng chung một kiểu tên
biến. Tách rõ:

| Tầng         | Ai đọc                      | Ví dụ dev                         | Ví dụ prod                  | Đổi được không          |
| ------------ | --------------------------- | --------------------------------- | --------------------------- | ----------------------- |
| **PUBLIC**   | trình duyệt                 | `http://tsudev.localhost:8080`    | `https://tsudev.com`        | có, nhưng cần đổi realm |
| **INTERNAL** | SSR / BFF / service↔service | `http://127.0.0.1:4001`           | `https://tsudev-content...` | tự do                   |
| **IDENTITY** | ký vào token/chứng chỉ      | `TRUST_ISSUER`, `KEYCLOAK_ISSUER` | —                           | **cửa một chiều** (§5)  |

Quy tắc bất di bất dịch sau tái cấu trúc:

- Mã phía **server** không bao giờ gọi hostname công khai — luôn dùng tầng
  INTERNAL (`127.0.0.1:<port>`). Gọi vòng qua proxy là tự thêm một điểm hỏng.
- Mã phía **trình duyệt** không bao giờ thấy tầng INTERNAL. Không có ngoại lệ
  cho `storage-service` (xem giai đoạn 4).

### 2.2 Hình trạng dev sau tái cấu trúc

Một cổng vào duy nhất, subdomain đúng như production:

```
                    http://*.tsudev.localhost:8080
                                 │
                        scripts/dev-proxy.js
                     (định tuyến theo Host header)
                                 │
    ┌──────────────┬─────────────┼─────────────┬──────────────┐
    │              │             │             │              │
tsudev.        forum.        auth.         cdn.          (không có
localhost      tsudev.       tsudev.       tsudev.        subdomain)
    │          localhost      localhost     localhost          │
127.0.0.1:3000  :3001        :4100         :9000       (4000-4003)
frontend-main  frontend-     Keycloak      MinIO        4 service —
               forum                                    chỉ SSR/BFF gọi
```

**Vì sao `*.localhost` chứ không sửa `/etc/hosts`:** `localhost` không nằm trong
Public Suffix List, nên trình duyệt coi `tsudev.localhost` là một registrable
domain — cookie `.tsudev.localhost` chia sẻ được giữa các subdomain, **đúng
hành vi của `.tsudev.com` trên production**. Và không máy nào phải sửa file hệ
thống.

Đã kiểm chứng trên máy này:

```
$ getent hosts tsudev.localhost
::1             tsudev.localhost
```

⚠️ **Phân giải ra `::1` (IPv6), không phải `127.0.0.1`.** Hệ quả bắt buộc:
proxy phải `server.listen(port)` **không truyền host** (Node mặc định bind `::`
dual-stack); upstream trong bảng định tuyến phải ghi `127.0.0.1:<port>` chứ
không ghi hostname, nếu không mỗi lượt chuyển tiếp lại tốn một vòng phân giải
DNS và có thể trượt sang `::1` của chính proxy → vòng lặp.

### 2.3 Bảng cổng đích

Nguyên tắc: **cổng công khai giảm từ 5 xuống 1**; các cổng còn lại bind
`127.0.0.1` và không ai gõ tay nữa.

| Thành phần      | Cổng cũ   | Cổng mới | Đổi?       | Lý do                                                                                               |
| --------------- | --------- | -------- | ---------- | --------------------------------------------------------------------------------------------------- |
| **dev-proxy**   | —         | **8080** | mới        | cổng vào duy nhất; 8080 không cần quyền root                                                        |
| frontend-main   | 3000      | 3000     | giữ        | ổn định, đã ăn vào thói quen                                                                        |
| frontend-forum  | 3001      | 3001     | giữ        | —                                                                                                   |
| user-service    | 4000      | 4000     | giữ        | —                                                                                                   |
| content-service | 4001      | 4001     | giữ        | —                                                                                                   |
| storage-service | 4002      | 4002     | giữ        | —                                                                                                   |
| trust-service   | 4003      | 4003     | giữ        | —                                                                                                   |
| **Keycloak**    | 8080      | **4100** | ĐỔI        | nhường 8080 cho proxy ⇒ **không cần `sudo`**. 8080 cũng là cổng bị va chạm nhiều nhất trên máy dev. |
| PostgreSQL      | 5433/5432 | **5433** | thống nhất | khớp `CLAUDE.md`; sửa compose + CI                                                                  |
| Redis           | 6379      | 6379     | giữ        | —                                                                                                   |
| MinIO           | 9000      | 9000     | giữ        | ra ngoài qua `cdn.tsudev.localhost`                                                                 |

Chỉ **một** thành phần đổi số cổng. Đây là chủ ý: tái cấu trúc này thắng nhờ
_bỏ được việc gõ cổng_, không nhờ đánh số lại.

> Muốn URL sạch không có `:8080`? Đặt `DEV_PROXY_PORT=80` và cấp quyền một lần:
> `sudo setcap cap_net_bind_service=+ep $(readlink -f $(which node))`. Mặc định
> **không** làm điều này — 8080 chạy được ngay, zero-friction.

### 2.4 Hình trạng production

| Tên miền            | Trỏ về            | Nền tảng           | Trạng thái           |
| ------------------- | ----------------- | ------------------ | -------------------- |
| `tsudev.com`        | frontend-main     | Cloudflare Workers | ✅ đã chạy (URL tạm) |
| `forum.tsudev.com`  | frontend-forum    | **chưa có đường**  | ❌ giai đoạn 5       |
| `auth.tsudev.com`   | Keycloak          | Render             | 🟠 cần custom domain |
| `cdn.tsudev.com`    | R2 public bucket  | Cloudflare R2      | 📋 kế hoạch          |
| _(không công khai)_ | 4 service backend | Render             | ⚠️ hiện đang public  |

**Về việc "giấu" 4 service:** không thể chuyển sang Render private service —
`frontend-main` chạy trên Cloudflare Workers, **nằm ngoài mạng nội bộ Render**,
nên SSR/BFF của nó bắt buộc gọi qua Internet công cộng. Phương án thực tế:

1. Giữ URL Render, **thêm cổng chặn `INTERNAL_API_TOKEN`** — middleware từ chối
   request không mang header đúng. Rẻ, làm được ngay. → giai đoạn 5.
2. _(Tuỳ chọn, sau)_ Gộp về một `api.tsudev.com` bằng một Worker router định
   tuyến theo tiền tố đường dẫn. Đẹp hơn, nhưng thêm một tầng phải bảo trì —
   **không** nằm trong phạm vi kế hoạch này.

---

## 3. Nguồn sự thật duy nhất

### 3.1 `config/topology.json`

Một file mô tả toàn bộ hình trạng mạng, cho cả ba môi trường:

```jsonc
{
  "domains": { "dev": "tsudev.localhost", "prod": "tsudev.com" },
  "devProxy": { "port": 8080 },
  "nodes": [
    { "id": "main", "port": 3000, "sub": "@", "public": true, "workspace": "apps/frontend-main" },
    {
      "id": "forum",
      "port": 3001,
      "sub": "forum",
      "public": true,
      "workspace": "apps/frontend-forum"
    },
    { "id": "auth", "port": 4100, "sub": "auth", "public": true },
    { "id": "cdn", "port": 9000, "sub": "cdn", "public": true },
    { "id": "user", "port": 4000, "public": false, "envUrl": "USER_SERVICE_URL" },
    { "id": "content", "port": 4001, "public": false, "envUrl": "CONTENT_SERVICE_URL" },
    { "id": "storage", "port": 4002, "public": false, "envUrl": "STORAGE_SERVICE_URL" },
    { "id": "trust", "port": 4003, "public": false, "envUrl": "TRUST_SERVICE_URL" },
    { "id": "db", "port": 5433, "public": false },
    { "id": "cache", "port": 6379, "public": false }
  ]
}
```

### 3.2 Bốn thứ sinh ra từ nó

| Sinh ra                       | Bằng                                                    | Thay cho                       |
| ----------------------------- | ------------------------------------------------------- | ------------------------------ |
| Khối biến mạng trong `.env`   | `scripts/topology/gen-env.js`                           | gõ tay `.env` + `.env.example` |
| `apps/*/.env.local`           | `scripts/write-env-local.js` (viết lại để đọc topology) | logic `NEXTAUTH_URL` hiện tại  |
| Bảng định tuyến của dev-proxy | `scripts/dev-proxy.js`                                  | — (mới)                        |
| Cổng kiểm tra CI              | `scripts/topology/check.js`                             | — (mới)                        |

`gen-env.js` ghi vào `.env` **giữa hai dấu mốc**, không đụng phần người dùng tự
sửa:

```
# >>> topology: sinh tự động, đừng sửa tay >>>
NEXT_PUBLIC_MAIN_URL=http://tsudev.localhost:8080
...
# <<< topology <<<
```

### 3.3 `topology:check` — cổng chặn hồi quy

Chạy trong job `lint` của CI và trong `.husky/pre-push`. Ba khẳng định:

1. Không có literal `localhost:<4 chữ số>` trong `apps/`, `packages/`,
   `services/` ngoài danh sách cho phép (`config/topology.allow`).
2. Mọi `*_SERVICE_URL` xuất hiện trong mã đều có node tương ứng trong topology.
3. Cổng khai trong `docker-compose.yml`, `.github/workflows/ci.yml`,
   `render.yaml` khớp topology (hoặc được đánh dấu override có chú thích).

Không có cổng chặn này thì cả kế hoạch chỉ mua được vài tháng.

---

## 4. Lộ trình sáu giai đoạn

Mỗi giai đoạn tự đứng được: dừng ở bất kỳ ranh giới nào cũng để lại hệ thống
chạy được. Một nhánh git cho một giai đoạn (giao thức 3 của `AGENTS.md`).

### Giai đoạn 0 — Lưới an toàn (trước khi đụng gì)

**Agent chủ trì:** `qa-test`

Refactor này dễ làm gãy nhất đúng thứ **chưa có test nào phủ**: phiên đăng nhập
đi qua hai origin.

- Viết E2E `e2e/tests/cross-origin-session.spec.js`: đăng nhập ở main → điều
  hướng sang forum bằng link của `SiteHeader` → phiên **vẫn còn**.
- `scripts/verify-stack.js` đọc danh sách endpoint từ tham số thay vì hardcode
  (chưa đổi giá trị).

**Nghiệm thu:** cả hai xanh trên cấu hình **cũ**. Nếu E2E mới đỏ ngay từ đầu ⇒
đã có lỗi tồn sẵn, ghi nhận rồi mới đi tiếp.

**Không có bước này thì không có cách nào biết giai đoạn 3 làm hỏng gì.**

---

### Giai đoạn 1 — Dựng nguồn sự thật (chưa đổi giá trị nào)

**Agent chủ trì:** `infra-deploy`

- Thêm `config/topology.json` **mô tả đúng hiện trạng** (Keycloak vẫn 8080,
  chưa có proxy).
- Thêm `scripts/topology/{load,gen-env,check}.js`, script npm
  `topology:gen` / `topology:check`.
- Gắn `topology:check` vào CI job `lint` và `.husky/pre-push`.
- Nạp `config/topology.allow` bằng đúng 17 vị trí hardcode hiện có — mỗi dòng
  một chú thích "sẽ gỡ ở giai đoạn N".

**Nghiệm thu:** `npm run dev:local` hành vi **không đổi**; `topology:check`
xanh; thử thêm một cổng không có trong topology vào mã ⇒ check phải đỏ.

**Rollback:** xoá thư mục, gỡ hai script. Không ảnh hưởng runtime.

---

### Giai đoạn 2 — Dọn nợ môi trường

**Agent chủ trì:** `infra-deploy`, phối hợp `backend-api` + `qa-test`

Sửa khiếm khuyết 1, 2, 6, 7 ở §1.3 — độc lập với việc đổi cổng, làm trước để
giai đoạn sau không phải gánh:

- Xoá `NEXT_PUBLIC_STORAGE_URL` (chết) khỏi `.env.example`,
  `.env.production.example`, `docker-compose.yml` (2 chỗ).
- Giữ `STORAGE_SERVICE_URL` nhưng **cho nó có tác dụng** ở giai đoạn 4; tạm ghi
  chú "chưa ai đọc".
- Thống nhất Postgres về **5433** trong `docker-compose.yml`. CI giữ 5432 (service
  container của GitHub) nhưng đánh dấu override tường minh trong topology.
- `render.yaml`: bổ sung cho **cả bốn** service `KEYCLOAK_ISSUER` và
  `REQUIRE_ROLE_ENFORCEMENT=true`.

**Nghiệm thu phần A:** `grep -r NEXT_PUBLIC_STORAGE_URL` = 0 lượt; `topology:check`
xanh với override `docker` đã gỡ; 4 bộ test service xanh (29/29).

### 2B — `REQUIRE_ROLE_ENFORCEMENT=true`: **KHÔNG bật, đang bị chặn** 🔴

Kế hoạch ban đầu định bật cờ này cho production. **Khảo sát cho thấy làm vậy sẽ
gây mất dịch vụ, không phải siết bảo mật.** Bằng chứng:

Chỉ **5 trên 75** route có `requireRole` — phần còn lại chưa từng được gác:

| Service | Route có `requireRole`                            | Vai trò đòi hỏi                     |
| ------- | ------------------------------------------------- | ----------------------------------- |
| content | `GET /api/posts` (1/38)                           | `content:read`                      |
| user    | `GET /api/users` (1/3)                            | `user:read`                         |
| storage | `GET/POST /api/presign`, `POST /api/upload` (3/5) | `storage:presign`, `storage:upload` |
| trust   | — (0/29)                                          | —                                   |

Và **không realm nào khai một vai trò nào** (khiếm khuyết #10). Nên bật cờ lên
thì năm route đó trả **403 cho mọi người, vĩnh viễn** — kể cả quản trị viên,
vì không ai có cách nào lấy được vai trò không tồn tại. Cụ thể là mất: danh sách
bài blog, danh sách thành viên, và toàn bộ luồng tải tệp.

Thêm nữa, hai route đầu là **đọc công khai**. Gác `GET /api/posts` sau một vai
trò Keycloak là sai về thiết kế cho một trang blog công khai, độc lập với chuyện
vai trò có tồn tại hay không — nó cho thấy ba lời gọi `requireRole` này là giàn
giáo mẫu, chưa phải chính sách thật.

**Điều kiện tiên quyết trước khi bật:**

1. Quyết định route nào công khai / cần đăng nhập / cần vai trò — hiện chưa có
   tài liệu nào nói.
2. Khai vai trò tương ứng vào `realm-export.json` **và** `realm-export.prod.json`,
   gán vào group/user mặc định.
3. Gỡ `requireRole` khỏi các route đọc công khai.
4. Chỉ khi đó mới đặt `REQUIRE_ROLE_ENFORCEMENT=true`.

Đây là việc **thiết kế chính sách xác thực**, không phải việc cổng/tên miền —
nên tách khỏi kế hoạch này thành hạng mục riêng.

---

### Giai đoạn 3 — Dev-proxy + subdomain _(giai đoạn trọng tâm)_

**Agent chủ trì:** `infra-deploy` → `frontend-web`

**3a. Spike bắt buộc trước khi viết mã** _(nửa ngày, chặn cả giai đoạn)_

Kiểm chứng trình duyệt chấp nhận cookie `Domain=.tsudev.localhost` và chia sẻ
được sang subdomain. Dựng trang tĩnh tối giản sau proxy, `Set-Cookie` trên
`tsudev.localhost`, đọc lại ở `forum.tsudev.localhost`, thử **cả Chrome và
Firefox**.

- **Đạt** ⇒ đi tiếp toàn bộ 3b–3e.
- **Không đạt** ⇒ phương án B: giữ subdomain (vẫn thắng về hình trạng + một
  cổng), nhưng để `NEXTAUTH_COOKIE_DOMAIN` trống và chấp nhận **dev vẫn phải
  đăng nhập hai lần**. Ghi rõ giới hạn vào `docs/development.md`. Không huỷ
  giai đoạn.

**3b. Keycloak 8080 → 4100**

`docker-compose.yml` (`KC_HTTP_PORT`), `scripts/keycloak-*.js`
(`KEYCLOAK_BASE`), `KEYCLOAK_ISSUER` ở mọi nơi, bốn `authMiddleware.js:4`.

**3c. `scripts/dev-proxy.js`**

Node thuần (`node:http` + `undici`), không thêm dependency nặng. Định tuyến theo
`Host`, upstream ghi `127.0.0.1:<port>`, chuyển tiếp cả WebSocket (HMR của Next
dùng WS — **bỏ sót là mất hot-reload**, triệu chứng dễ chẩn nhầm thành lỗi
Next).

**3d. `run-dev.js` + `write-env-local.js`**

Proxy khởi động **trước**; frontend bind `127.0.0.1`; `NEXTAUTH_URL` mỗi app lấy
từ topology (`http://tsudev.localhost:8080`, `http://forum.tsudev.localhost:8080`).

**3e. Realm dev**

`realm-export.json`: `redirectUris` / `webOrigins` thêm hai origin mới, **giữ
lại** hostname Docker (`http://frontend-main:3000`) cho compose và E2E.

**Nghiệm thu:**

- E2E của giai đoạn 0 xanh trên URL mới.
- Sửa một file React ⇒ hot-reload vẫn chạy qua proxy (kiểm chứng 3c).
- `verify-stack` xanh.
- `curl -I http://tsudev.localhost:8080` → 200.

**Rollback:** một biến `DEV_PROXY=0` trong `.env` bỏ qua proxy và quay về
`localhost:3000/3001`. Giữ đường lui này **ít nhất một tuần** sau khi trộn nhánh.

---

### Giai đoạn 4 — Đóng đường tắt trình duyệt → service

**Agent chủ trì:** `backend-api` → `frontend-web` _(đúng thứ tự chuỗi xuyên vùng
của `AGENTS.md`)_

Sửa khiếm khuyết 5. Sau giai đoạn 3, `storage-service` là chỗ duy nhất còn phá
quy tắc "trình duyệt không gọi thẳng cổng service".

- `backend-api`: `cors()` của storage-service đổi từ mở toàn bộ sang whitelist
  origin sinh từ topology.
- `frontend-web`: thêm `apps/frontend-main/pages/api/storage/[...path].js` bọc
  presign/upload; cân nhắc `pages/api/users/[...path].js` cho các lời gọi
  user-service phía client.
- Bốn service bind `127.0.0.1` ở dev (giữ `0.0.0.0` trong container).

**Nghiệm thu:** presign từ origin lạ bị từ chối; luồng upload trong UI vẫn chạy
đủ; E2E upload xanh.

---

### Giai đoạn 5 — Hình trạng production

**Agent chủ trì:** `infra-deploy`, phối hợp `trust-seal`

**Đọc §5 "Cửa một chiều" TRƯỚC KHI chạm vào `TRUST_ISSUER`.**

- Cloudflare DNS: `@`, `forum`, `auth`, `cdn` cho zone `tsudev.com`.
- Render: custom domain `auth.tsudev.com` cho `tsudev-sso`; cập nhật
  `KEYCLOAK_ISSUER` của cả bốn service theo đó.
- `realm-export.prod.json`: thêm redirect URI cho **forum** (hiện chưa có dòng
  nào) và cho domain thật.
- `INTERNAL_API_TOKEN` chặn bốn service Render.
- Đường deploy `frontend-forum` — **hạng mục lớn riêng**: forum ở Next 13, main ở
  Next 15; `@opennextjs/cloudflare` hỗ trợ theo phiên bản Next. Hai lựa chọn:
  nâng forum lên Next 15 rồi dùng chung đường Workers, hoặc deploy forum lên
  Render bằng Docker. **Quyết định này nên tách thành một kế hoạch riêng** — nó
  không phải việc về cổng/tên miền.

**Nghiệm thu:** đăng nhập ở `tsudev.com` → sang `forum.tsudev.com` còn phiên;
`cf-cache-status: HIT` trên asset tĩnh; gọi trực tiếp URL Render không có token
⇒ 401.

---

### Giai đoạn 6 — Tài liệu

**Agent chủ trì:** `docs-curator`

`docs/development.md`, `docs/deployment.md`, `docs/architecture.md`,
`infrastructure/README.md`, `README.md`, và **cuối cùng** bảng cổng trong
`CLAUDE.md`.

`CLAUDE.md` sửa **sau chót, ở cuối phiên** — chính file đó dặn rằng sửa nó giữa
phiên là bust cache toàn bộ phần sau.

---

## 5. Cửa một chiều — đọc trước khi bước qua

### 5.1 `TRUST_ISSUER` 🔴

`services/trust-service/src/certificates.js:42,51` ký `iss` và `verify` URL
**vào bên trong** chứng chỉ.

**Đính chính so với bản đầu của tài liệu này.** Tôi từng xếp mục này 🔴 "không
hồi phục". Đọc mã kỹ hơn thì nhẹ hơn thế: `signing.js:143-152` xác minh chữ ký
theo **`kid`**, không đối chiếu `iss`. Nghĩa là đổi `TRUST_ISSUER` **không** làm
hỏng việc xác minh chứng chỉ cũ.

Cái thật sự vĩnh viễn là **URL nằm trong payload đã ký**: chứng chỉ cũ mãi mang
`iss` và `verify: <domain cũ>/trust/verify/<serial>`. Hệ quả là _link rot_ —
huy hiệu đã phát hành trỏ về domain cũ. Cách vá là **giữ domain cũ redirect**,
chứ không phải sửa cấu hình. Vẫn nên đặt đúng trước lần cấp đầu tiên, nhưng đây
là 🟠 chứ không phải 🔴.

Hiện production đang đặt `https://tsudev.dev-nguyentrangtinhsu.workers.dev` —
một URL tạm, gần như chắc chắn không phải đích cuối.

**Bắt buộc, theo thứ tự:**

1. Đếm chứng chỉ đã cấp trên database production.
2. **Bằng 0** ⇒ đổi `TRUST_ISSUER` sang `https://tsudev.com` **ngay**, trước khi
   cấp cái đầu tiên. Đây là cửa sổ rẻ nhất và nó đang mở.
3. **Lớn hơn 0** ⇒ chứng chỉ cũ vẫn xác minh được, nhưng link trong chúng trỏ
   domain cũ. Giữ domain cũ redirect sang domain mới, hoặc chấp nhận link rot.

**Đã làm:** `render.yaml` đặt `TRUST_ISSUER=https://tsudev.com` (thay URL
`*.workers.dev` tạm). DB local có **0** chứng chỉ. ⚠️ **Chưa kiểm được DB
production (Neon)** — người có quyền truy cập phải chạy
`SELECT count(*) FROM "TrustCertificate"` trên đó trước khi phát hành lần tới.

### 5.2 Realm Keycloak

Đổi domain mà quên `redirectUris` ⇒ đăng nhập gãy **sau khi deploy**, không phải
lúc build. Cập nhật realm **trước** khi chuyển DNS.

### 5.3 Migration Prisma

Kế hoạch này **không đụng** `packages/db`. Nếu phát sinh nhu cầu, migration đã
áp dụng là bất biến — tạo migration mới.

---

## 6. Rủi ro

| Rủi ro                                                    | Xác suất   | Ảnh hưởng          | Chặn bằng                                               |
| --------------------------------------------------------- | ---------- | ------------------ | ------------------------------------------------------- |
| Cookie `.tsudev.localhost` bị trình duyệt từ chối         | trung bình | cao                | spike 3a **trước** khi viết mã; phương án B đã định sẵn |
| Proxy nuốt WebSocket ⇒ mất hot-reload                     | cao        | trung bình         | tiêu chí nghiệm thu riêng ở 3d                          |
| `*.localhost` ra `::1` gây vòng lặp proxy                 | trung bình | cao                | upstream ghi `127.0.0.1` tường minh (§2.2)              |
| `REQUIRE_ROLE_ENFORCEMENT=true` khoá nhầm route đang dùng | trung bình | cao                | tách PR riêng; 4 bộ test bật cờ                         |
| Đổi `TRUST_ISSUER` sau khi đã cấp chứng chỉ               | thấp       | **không hồi phục** | §5.1 — đếm trước, đổi sau                               |
| Kéo dài nửa chừng, repo mang hai hình trạng cùng lúc      | cao        | trung bình         | mỗi giai đoạn tự đứng được; cờ `DEV_PROXY=0`            |

---

## 7. Bảng nghiệm thu tổng

| #   | Tiêu chí                                                                     | Giai đoạn  |
| --- | ---------------------------------------------------------------------------- | ---------- |
| 1   | Chỉ **một** cổng công khai ở dev (`8080`); còn lại bind `127.0.0.1`          | 3          |
| 2   | Mọi cổng/hostname xuất phát từ `config/topology.json`; `topology:check` xanh | 1          |
| 3   | Thêm `localhost:<port>` mới vào mã ⇒ CI đỏ                                   | 1          |
| 4   | Đăng nhập main → sang forum còn phiên, **ở dev**                             | 3          |
| 5   | Trình duyệt không còn gọi thẳng cổng service nào                             | 4          |
| 6   | `render.yaml` đủ `KEYCLOAK_ISSUER`                                           | 2 ✅       |
| 6b  | Chính sách vai trò thiết kế xong, realm khai đủ vai trò, rồi mới bật cờ      | tách riêng |
| 7   | 0 biến môi trường chết                                                       | 2          |
| 8   | Postgres một giá trị cổng duy nhất cho local                                 | 2          |
| 9   | `TRUST_ISSUER` = domain thật, quyết định có bằng chứng số chứng chỉ đã cấp   | 5          |
| 10  | Tài liệu khớp mã; `CLAUDE.md` sửa sau chót                                   | 6          |

---

## 7.5 Còn lại — cần quyền truy cập mà tôi không có

Phần mã của giai đoạn 5 đã xong. Phần dưới đây cần dashboard/tài khoản:

| Việc                                                         | Ai làm được          |
| ------------------------------------------------------------ | -------------------- |
| DNS Cloudflare: `@`, `forum`, `auth`, `cdn` cho `tsudev.com` | chủ tài khoản CF     |
| Custom domain `auth.tsudev.com` cho service `tsudev-sso`     | chủ tài khoản Render |
| Đặt giá trị `INTERNAL_API_TOKEN` (3 service + frontend-main) | chủ tài khoản Render |
| Đặt `KEYCLOAK_ISSUER` thật cho 4 service                     | chủ tài khoản Render |
| Import `realm-export.prod.json` đã cập nhật vào Keycloak     | quản trị Keycloak    |
| `SELECT count(*) FROM "TrustCertificate"` trên Neon (§5.1)   | ai có `DATABASE_URL` |
| Đường deploy `frontend-forum` (Next 13 vs 15)                | tách kế hoạch riêng  |
| Chạy `docker compose up -d` xác nhận Keycloak ở 4100         | máy có Docker        |

Máy làm việc này **không có Docker**, nên mọi thay đổi trong `docker-compose.yml`
(Keycloak `KC_HTTP_PORT=4100`, `postgres` map `5433:5432`, `e2e-runner` chờ cổng
mới) mới chỉ được kiểm bằng parse YAML, chưa chạy thật.

## 8. Việc cố ý KHÔNG làm

- **Không** đánh số lại 3000/3001/400x. Sau proxy chúng vô hình; đánh số lại chỉ
  đổi lấy một đợt sửa lan rộng không có lợi ích tương ứng.
- **Không** dựng gateway `api.tsudev.com` ở vòng này. BFF hiện tại đã đủ và đúng
  hướng; thêm tầng nữa là thêm thứ phải bảo trì.
- **Không** nâng `frontend-forum` lên Next 15 trong kế hoạch này. Đó là việc về
  phiên bản framework, chỉ **giao thoa** với đường deploy chứ không thuộc phạm vi
  cổng/tên miền.
- **Không** ép HTTPS ở dev. Cookie `Secure` cần HTTPS, nhưng `.localhost` là
  secure context sẵn theo chuẩn — dựng CA nội bộ là chi phí không cần thiết.
