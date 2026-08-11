# CLAUDE.md — tsudev

Hệ sinh thái công nghệ cho developer: trang chủ/blog/tài liệu, diễn đàn, chợ có
ký quỹ, SSO, object storage, con dấu tín nhiệm. Monorepo npm workspaces.
Repo: private, `github.com/b4djl1h/tsudev`.

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
| `apps/frontend-main`      | `tsudev.localhost:8080`            | 3000        | Next 15 · blog, docs, market, trust, admin |
| `apps/frontend-forum`     | `forum.tsudev.localhost:8080`      | 3001        | Next 13 · diễn đàn               |
| Keycloak                  | `auth.tsudev.localhost:8080`       | 4100        | **không** còn 8080 (nhường proxy) |
| MinIO / R2                | `cdn.tsudev.localhost:8080`        | 9000        | đích của URL presign             |
| `apps/sso-auth`           | —                                  | —           | KHÔNG phải app Node, chỉ realm export |
| `services/user-service`   | *(chỉ SSR/BFF)*                    | 4000        | hồ sơ, uy tín                    |
| `services/content-service`| *(chỉ SSR/BFF)*                    | 4001        | blog, docs, forum, kiểm duyệt, tin nhắn, chợ |
| `services/storage-service`| *(chỉ SSR/BFF)*                    | 4002        | presign S3/R2, upload            |
| `services/trust-service`  | *(chỉ SSR/BFF)*                    | 4003        | con dấu tín nhiệm                |
| PostgreSQL                | —                                  | 5433        | cluster user-space, **không** phải 5432 |

`packages/`: `@tsudev/db` (Prisma) · `@tsudev/ui` (design system) ·
`@tsudev/types` · `@tsudev/utils` · `brand/` (ảnh nguồn) · `observability/`
(thư mục thuần, không phải workspace).

## Chạy local

```bash
npm install && cp .env.example .env
npm run dev:full     # lần đầu: dựng DB + generate + migrate + seed + chạy
npm run dev:local    # các lần sau
```

Mở ở **http://tsudev.localhost:8080** (diễn đàn: `forum.tsudev.localhost:8080`).
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
- **DB**: chỉ qua `@tsudev/db`. Một database, một schema, bốn service dùng chung.
- **Trình duyệt KHÔNG gọi thẳng cổng service.** Mọi lời gọi qua route proxy
  `apps/*/pages/api/<domain>/[...path].js` (kể cả storage: `/api/storage/*`).
  Thêm endpoint ⇒ phải mở rộng proxy, nếu không CORS chặn.
- **Địa chỉ service lấy từ `apps/*/lib/services.js`**, đừng khai lại
  `process.env.X_SERVICE_URL || 'http://…'` trong file mới — `topology:check`
  sẽ bắt.
- **Link liên-site** dùng `siteUrl()`/`MAIN_URL`/`FORUM_URL` của `@tsudev/ui`.
  `href="/blog"` tương đối bám origin đang mở ⇒ 404 khi bấm từ diễn đàn.
- **Giao diện chỉ có chế độ tối.** Không thêm nhánh sáng. Thứ bậc bằng độ sáng
  nền (`--surface` < `--panel` < `--panel-2`), không bằng viền/đổ bóng.
- **`apps/*/.env.local` được sinh tự động** — sửa tay vô ích, lần chạy dev sau
  ghi đè. Sửa `.env` gốc.
- **Component `@tsudev/ui` phải chạy được trên cả React 19 lẫn React 18** (hai
  app lệch phiên bản lớn).
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
- **trust-service gắn auth theo NHÁNH, không cho cả `/api`** (khác ba service
  kia). Mặc định là công khai — thêm nhánh riêng tư mà quên khai thì nó lộ ra và
  **không có gì báo lỗi**.
- **`TRUST_ISSUER` được ký vào chứng chỉ**; `TRUST_SIGNING_KEY` thiếu ở
  production ⇒ service từ chối khởi động (cố ý). Xoay khoá phải chuyển khoá cũ
  vào `TRUST_SIGNING_KEYS_RETIRED` trước.
- **`REQUIRE_ROLE_ENFORCEMENT=true` hiện KHÔNG bật được ở production.** Chỉ 5/75
  route có `requireRole`, và **không realm nào khai một vai trò nào** — bật lên
  là năm route đó 403 vĩnh viễn (mất blog, danh sách thành viên, upload). Phải
  thiết kế chính sách vai trò trước; xem `docs/refactor-network-topology.md` §2B.
- **`INTERNAL_API_TOKEN` gác `/api` của user/content/storage** khi được đặt
  (không đặt = no-op). `trust-service` cố ý đứng ngoài — endpoint của nó phải
  công khai cho bên thứ ba.
- **Keycloak trên Render free tier (512MB)**: `--cache=local` là build-time
  option (đặt vào `start` ⇒ treo cứng); `start-dev` ⇒ OOM; H2 in-memory ⇒ mất
  sạch tài khoản mỗi lần dịch vụ ngủ dậy. Bốn commit liên tiếp đã trả giá —
  đọc `docs/deployment.md` trước khi đụng `docker/keycloak.Dockerfile`.
- **Docker build context phải là gốc repo** — service phụ thuộc package nội bộ
  không có trên npm registry.
- **`S3_ENDPOINT` (nội bộ) và `S3_PUBLIC_ENDPOINT` (CDN) là hai biến khác nhau.**
  Gộp lại thì URL presign trỏ vào host nội bộ.
- **Bốn `authMiddleware.js` gần trùng nhau.** Đổi hành vi xác thực phải sửa cả
  bốn.
- **`main` không có branch protection** (GitHub Free + repo private). Lớp chắn
  duy nhất là `.husky/pre-push`, chỉ có sau khi `npm install`. Vượt có chủ đích:
  `ALLOW_MAIN_FORCE=1 git push`.
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
