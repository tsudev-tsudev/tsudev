# CLAUDE.md — tsudev

Website dự án cá nhân: dự án & bản quyền, blog, tài liệu, SSO, object storage,
con dấu tín nhiệm. Monorepo npm workspaces.
Repo: private, `github.com/tsudev-tsudev/tsudev`.

> File này là NGỮ CẢNH TĨNH được nạp + cache ở đầu MỌI phiên. Đọc kỹ một lần,
> tuân thủ suốt phiên. **Đừng sửa file này giữa phiên** — sửa là bust cache toàn
> bộ phía sau. Cần sửa thì dồn về cuối phiên.

## Bản đồ

**Nguồn sự thật về cổng/tên miền là `config/topology.json`**, không phải bảng
này. Đổi cổng ⇒ sửa ở đó rồi `npm run topology:gen`. `npm run topology:check`
(trong CI và `.husky/pre-push`) chặn hardcode mọc lại.

Ở dev chỉ có **một cổng công khai**: `scripts/dev-proxy.js` nghe 8080 và phân
biệt bằng subdomain, đúng hình trạng production.

| Thành phần                | Địa chỉ dev                        | Cổng nội bộ | Ghi chú                          |
| ------------------------- | ---------------------------------- | ----------- | -------------------------------- |
| `apps/frontend-main`      | `tsudev.localhost:8080`            | 3000        | Next 15 · app DUY NHẤT: dự án, blog, docs, trust, admin |
| Keycloak                  | `auth.tsudev.localhost:8080`       | 4100        | **không** còn 8080 (nhường proxy) |
| MinIO / R2                | `cdn.tsudev.localhost:8080`        | 9000        | đích của URL presign             |
| `apps/sso-auth`           | —                                  | —           | KHÔNG phải app Node, chỉ realm export |
| `services/content-service`| *(chỉ SSR/BFF)*                    | 4001        | blog, docs, dự án & bản quyền    |
| `services/storage-service`| *(chỉ SSR/BFF)*                    | 4002        | presign S3/R2, upload            |
| `services/trust-service`  | *(chỉ SSR/BFF)*                    | 4003        | con dấu tín nhiệm                |
| PostgreSQL                | —                                  | 5433        | cluster user-space, **không** phải 5432 |

⚠️ **Production KHÔNG chạy ba tiến trình như bảng trên.** Ba service backend gộp
thành MỘT tiến trình `services/backend-bundle` (cổng 4000, `npm run dev:merged`).
Render free chỉ cho 750 giờ instance/tháng cho cả tài khoản; ba tiến trình chạy
liên tục cần 2160 giờ nên không giữ ấm được cái nào. Dev vẫn ba cổng cho dễ lặp.

`packages/`: `@tsudev/db` (Prisma) · `@tsudev/ui` (design system) ·
`@tsudev/types` · `@tsudev/utils` · `brand/` (ảnh nguồn) · `observability/`
(thư mục thuần, không phải workspace).

## Chạy local

```bash
npm install && cp .env.example .env
npm run dev:full     # lần đầu: dựng DB + generate + migrate + seed + chạy
npm run dev:local    # các lần sau
```

Mở ở **http://tsudev.localhost:8080**.
`*.localhost` tự trỏ loopback — không phải sửa `/etc/hosts`. Proxy hỏng thì
`DEV_PROXY=0 npm run dev:local` quay về gõ thẳng cổng từng app.

Đăng nhập dev: bất kỳ username + `devpass` (`.env` đã đặt `E2E_BYPASS_KEYCLOAK=1`).
`tsudev`=ADMIN, `alice`=MEMBER, `bob`=VIP.

⚠️ Vào bằng `localhost:3000` hay `127.0.0.1:3000` thì **đăng nhập không chạy**:
cookie phiên mang `Domain=.tsudev.localhost` nên không gắn được vào host khác.

Test theo workspace, **không** có lệnh test ở gốc:
`npm --workspace services/<tên> test`. Cổng chung:
`npm run format:check` · `npm run lint`.

Chi tiết → `docs/development.md`.

## Tài liệu — đọc CHỌN LỌC theo task

Mục lục: `docs/README.md`. Theo vùng: kiến trúc → `docs/architecture.md` ·
chạy local → `docs/development.md` · auth/RBAC → `docs/auth.md` · test/CI →
`docs/testing.md` · giao diện → `docs/design-system.md` · production →
`docs/deployment.md` · con dấu → `docs/trust-seal.md`.

`documents-tsudev.md` là **đặc tả yêu cầu**, không phải mô tả hiện trạng. Mã
nguồn là hiện trạng; TSD là đích đến.

## Quy ước code

- **Service**: CommonJS, **không dấu chấm phẩy** (`.prettierrc.json` ghi đè
  `semi:false` cho `services/**`, `packages/db/**`). App/package khác: **có**
  chấm phẩy, nháy đơn.
- **DB**: chỉ qua `@tsudev/db`. Một database, một schema, ba service dùng chung.
- **Trình duyệt KHÔNG gọi thẳng cổng service.** Mọi lời gọi qua route proxy
  `apps/*/pages/api/<domain>/[...path].js` (kể cả storage: `/api/storage/*`).
  Thêm endpoint ⇒ phải mở rộng proxy, nếu không CORS chặn.
- **Địa chỉ service lấy từ `apps/*/lib/services.js`**, đừng khai lại
  `process.env.X_SERVICE_URL || 'http://…'` trong file mới — `topology:check`
  sẽ bắt.
- **Điều hướng trong site dùng href tương đối** — tsudev chỉ còn MỘT origin.
  `MAIN_URL` của `@tsudev/ui` chỉ cho URL tuyệt đối thật sự cần (canonical, OG,
  mã nhúng huy hiệu).
- **Giao diện chỉ có chế độ tối.** Không thêm nhánh sáng. Thứ bậc bằng độ sáng
  nền (`--surface` < `--panel` < `--panel-2`), không bằng viền/đổ bóng.
- **`apps/*/.env.local` được sinh tự động** — sửa tay vô ích, lần chạy dev sau
  ghi đè. Sửa `.env` gốc.
- **Root `package.json` còn ghim `react@18.3.1`** — di sản của app diễn đàn đã
  xoá, nay chỉ Storybook lấy từ đó. App thật chạy React 19, nhưng API
  chỉ-có-ở-React-19 vẫn làm Storybook hỏng, mà **Storybook không nằm trong CI**.
  Nợ có đăng ký, ghi trong `next.config.js`.
- **Commit**: Conventional Commits.

## Gotcha cứng — đọc trước khi sửa vùng liên quan

- **Migration là BẤT BIẾN.** Sửa file migration đã áp dụng (kể cả comment) làm
  lệch checksum ⇒ `prisma migrate deploy` dừng ⇒ CI đỏ + production không boot.
  Tạo migration mới.
- **Đổi `schema.prisma` ⇒ bắt buộc `npm run db:generate`.** Quên là job "Build
  frontends" của CI đỏ dù không ai đụng frontend — nguyên nhân hay bị chẩn nhầm.
- **`requireRole()` là no-op** trừ khi `REQUIRE_ROLE_ENFORCEMENT=true`. Ở local
  mọi route "được bảo vệ" đều mở. Route nhạy cảm mới phải thử một lần với biến
  đó bật.
- **trust-service gắn auth theo NHÁNH, không cho cả `/api`** (khác hai service
  kia). Mặc định là công khai — thêm nhánh riêng tư mà quên khai thì nó lộ ra và
  **không có gì báo lỗi**.
- **`TRUST_ISSUER` được ký vào chứng chỉ**; `TRUST_SIGNING_KEY` thiếu ở
  production ⇒ service từ chối khởi động (cố ý). Xoay khoá phải chuyển khoá cũ
  vào `TRUST_SIGNING_KEYS_RETIRED` trước.
- **`REQUIRE_ROLE_ENFORCEMENT=true` hiện KHÔNG bật được ở production.** Chỉ 4/46
  route có `requireRole`, và **không realm nào khai một vai trò nào** — bật lên
  là bốn route đó 403 vĩnh viễn (mất blog, presign, upload). Phải thiết kế chính
  sách vai trò trước; xem `docs/refactor-network-topology.md` §2B.
  Vì thế **đường ghi mới phải tự kiểm vai trò từ DB**, đừng dựa vào
  `requireRole` — xem `requireAdmin` trong content-service.
- **`INTERNAL_API_TOKEN` gác `/api` của content/storage** khi được đặt
  (không đặt = no-op). `trust-service` cố ý đứng ngoài — endpoint của nó phải
  công khai cho bên thứ ba.
- **Keycloak trên Render free tier (512MB)**: `--cache=local` là build-time
  option (đặt vào `start` ⇒ treo cứng); `start-dev` ⇒ OOM; H2 in-memory ⇒ mất
  sạch tài khoản mỗi lần dịch vụ ngủ dậy. Bốn commit liên tiếp đã trả giá —
  đọc `docs/deployment.md` trước khi đụng `docker/keycloak.Dockerfile`.
- **Docker build context phải là gốc repo** — service phụ thuộc package nội bộ
  không có trên npm registry.
- **`S3_ENDPOINT` và `S3_PUBLIC_ENDPOINT` khác nhau Ở DEV, TRÙNG NHAU ở
  production.** `S3_PUBLIC_ENDPOINT` chỉ phục vụ một việc: làm endpoint **ký URL
  presign**. Ở dev phải tách vì `S3_ENDPOINT` trỏ `minio:9000` trong mạng docker,
  trình duyệt không với tới. Ở production dùng R2 thì endpoint S3 API của R2 vốn
  đã công khai, nên cả hai cùng một giá trị. **Đừng đặt thành `cdn.tsudev.com`**
  — tên miền tuỳ chỉnh R2 không cài đặt giao thức chữ ký S3 (URL presign bị từ
  chối) và còn làm bucket thành công khai.
- **Ba `authMiddleware.js` gần trùng nhau.** Đổi hành vi xác thực phải sửa cả
  ba.
- **`User.credits` KHÔNG phải di sản của chợ ký quỹ** — trust-service thu phí
  nộp đơn cấp dấu bằng cột này. Xoá theo là hỏng luồng nộp đơn, **không test nào
  bắt được**.
- **`main` không có branch protection** (GitHub Free + repo private). Lớp chắn
  duy nhất là `.husky/pre-push`, chỉ có sau khi `npm install`. Vượt có chủ đích:
  `ALLOW_MAIN_FORCE=1 git push`.
- **`backend-bundle` điều phối theo BẢNG TIỀN TỐ đường dẫn**, không mount chồng
  ba app. Mount thẳng thì `/api/trust/*` đi vào app content trước và dính cổng
  chặn `INTERNAL_API_TOKEN` của nó ⇒ huy hiệu SVG, trang xác minh và JWKS (bắt
  buộc công khai) trả 401, **không có gì báo lỗi**. Thêm route có tiền tố chưa
  nằm trong bảng ⇒ route đó **404 ở production** dù chạy service riêng vẫn sống.
  Sửa route thì sửa bảng trong `services/backend-bundle/src/index.js`.
- **`.env.local` THẮNG `.env.production` trong Next — đã từng thành lỗ hổng.**
  `apps/*/.env.local` là bản sao nguyên văn `.env` gốc, và lệnh deploy chạy trên
  máy dev. Ngày 16/08/2026 bản production đã mang theo `E2E_BYPASS_KEYCLOAK=1`:
  **ai cũng đăng nhập được vào tài khoản ADMIN bằng `devpass`**, site vẫn chạy
  bình thường, không có gì báo lỗi. Vì thế deploy đi qua
  `scripts/deploy-frontend.js` — nó **dời `.env.local` ra khỏi đường lúc dựng**.
  Đừng gọi thẳng `opennextjs-cloudflare deploy`. Nghiệm thu mỗi lần:
  `curl -s https://tsudev.com/api/auth/providers` phải CHỈ có `keycloak`.
- **(cũ, vẫn đúng)** `NEXT_PUBLIC_*` được nội
  suy lúc build; `apps/*/.env.local` sinh tự động mỗi lần chạy dev và trỏ về
  `tsudev.localhost`; lệnh deploy chạy trên máy dev. Vì vậy `deploy`/`preview`/
  `upload` truyền biến thẳng vào shell qua `scripts/topology/prod-url.js` —
  biến shell thì Next không ghi đè. Bỏ đoạn đó là canonical, ảnh OG và
  `sitemap.xml` của production mang URL dev, **không có gì báo lỗi**.
- `.prettierignore` cố ý bỏ qua `documents-tsudev.md` và `CLAUDE.md` — prettier
  đánh số lại danh sách và escape ký tự trong hai file này. Đừng gỡ ra.

## Nhiều agent song song

8 agent chuyên trách định nghĩa ở `.claude/agents/`, sở hữu các vùng đường dẫn
tách rời. Bảng phân vai, thứ tự thay đổi xuyên vùng và giao thức: **`AGENTS.md`**.
Cần đổi file thuộc vùng agent khác ⇒ mô tả và báo lại, đừng tự sửa.

## Kỷ luật token (BẮT BUỘC)

1. **Định vị trước, đọc sau.** `grep -n` tìm dòng → `sed -n 'X,Yp'` đọc đúng
   đoạn. `content-service/src/index.js` hơn 1000 dòng.
2. **Đọc theo bảng định tuyến** ở mục Tài liệu, không nạp cả `docs/`. Mỗi file
   thừa được trả tiền ở **mọi** lượt còn lại của phiên.
3. **Không bao giờ đọc**: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`,
   `coverage/`, `package-lock.json`, file nhị phân.
4. **Gộp lượt**: nhiều lệnh độc lập ⇒ một lượt nhiều tool call.
5. Đừng đọc lại file vừa sửa để kiểm tra; đừng tóm tắt lại ở mỗi lượt; chạy cổng
   kiểm tra một lần ở cuối cụm thay đổi.
6. Dùng **Standard cho mọi tác vụ** — không tự bật/gợi ý `/fast`.
7. Phiên dài thì đóng terminal, mở phiên mới. Ngữ cảnh cũ là chi phí chết.

**Xin xác nhận trước khi `git push` hoặc deploy.** Chỉ commit/push khi được yêu cầu.
