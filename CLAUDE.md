# CLAUDE.md — tsudev

Website dự án cá nhân: dự án & bản quyền, blog, tài liệu, xác thực, object
storage, con dấu tín nhiệm. Monorepo npm workspaces.
Repo: private, `github.com/tsudev-tsudev/tsudev`.

> File này là NGỮ CẢNH TĨNH được nạp + cache ở đầu MỌI phiên. Đọc kỹ một lần,
> tuân thủ suốt phiên. **Đừng sửa file này giữa phiên** — sửa là bust cache toàn
> bộ phía sau. Cần sửa thì dồn về cuối phiên.

🔴 **Đọc [`HANDOFF.md`](HANDOFF.md) §0.5 TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ.**
Đợt TypeScript/Rust + xác thực tự quản lý + tái cấu trúc giao diện đã phát hành
lên production. Nhưng **tài khoản ADMIN duy nhất trên production chưa có mật
khẩu**, nên hiện KHÔNG đăng nhập được và không nghiệm thu được gì. Đó là việc
chặn. Phiếu đó cũng liệt kê việc còn dở (rà giao diện bằng mắt, đổi mật khẩu
trong ứng dụng, ping giữ ấm, `npm audit`, CSP thật). Xong hết thì xoá file và
xoá cả đoạn này.

## Bản đồ

**Nguồn sự thật về cổng/tên miền là `config/topology.json`**, không phải bảng
này. Đổi cổng ⇒ sửa ở đó rồi `npm run topology:gen`. `npm run topology:check`
(trong CI và `.husky/pre-push`) chặn hardcode mọc lại.

Ở dev chỉ có **một cổng công khai**: `scripts/dev-proxy.js` nghe 8080 và phân
biệt bằng subdomain, đúng hình trạng production.

| Thành phần                | Địa chỉ dev                        | Cổng nội bộ | Ghi chú                          |
| ------------------------- | ---------------------------------- | ----------- | -------------------------------- |
| `apps/frontend-main`      | `tsudev.localhost:8080`            | 3000        | Next 15 · app DUY NHẤT: dự án, blog, docs, trust, admin |
| MinIO / R2                | `cdn.tsudev.localhost:8080`        | 9000        | đích của URL presign             |
| `services/content-service`| *(chỉ SSR/BFF)*                    | 4001        | blog, docs, dự án & bản quyền    |
| `services/storage-service`| *(chỉ SSR/BFF)*                    | 4002        | presign S3/R2, upload            |
| `services/trust-service`  | *(chỉ SSR/BFF)*                    | 4003        | con dấu tín nhiệm                |
| `services/auth-service`   | *(chỉ SSR/BFF)*                    | 4004        | mật khẩu, 2FA, passkey — RANH GIỚI BẢO MẬT |
| PostgreSQL                | —                                  | 5433        | cluster user-space, **không** phải 5432 |

⚠️ **Production KHÔNG chạy bốn tiến trình như bảng trên.** Bốn service backend
gộp thành MỘT tiến trình `services/backend-bundle` (cổng 4000, `npm run
dev:merged`). Render free chỉ cho 750 giờ instance/tháng cho cả tài khoản; nhiều
tiến trình chạy liên tục thì không giữ ấm được cái nào. Dev vẫn bốn cổng cho dễ lặp.

`packages/`: `@tsudev/db` (Prisma) · `@tsudev/auth` (kiểm danh tính + phân quyền
dùng chung) · `@tsudev/identity-token` (hợp đồng khẳng định danh tính BFF→service,
dùng chung giữa Workers và Node) · `@tsudev/trust-crypto` (Ed25519 bằng Rust→WASM)
· `@tsudev/ui` (design system) ·
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

Đăng nhập dev: `tsudev`=ADMIN · `alice`=MEMBER · `bob`=VIP, mật khẩu
`tsudev-dev-2026!` (do `npm run db:seed:dev` đặt — hash Argon2id THẬT, đi qua
đúng đường của production). **Không còn** "bất kỳ username + devpass".

⚠️ Vào bằng `localhost:3000` hay `127.0.0.1:3000` thì **đăng nhập không chạy**:
cookie phiên mang `Domain=.tsudev.localhost` nên không gắn được vào host khác.

Test theo workspace, **không** có lệnh test ở gốc:
`npm --workspace services/<tên> test`. `packages/ui` cũng có test — đó là cổng
tương phản của hệ token màu. Cổng chung: `npm run format:check` · `npm run lint`
· `npm run typecheck` · `npm run topology:check`.

Chi tiết → `docs/development.md`.

## Tài liệu — đọc CHỌN LỌC theo task

Mục lục: `docs/README.md`. Theo vùng: kiến trúc → `docs/architecture.md` ·
chạy local → `docs/development.md` · auth/RBAC → `docs/auth.md` · test/CI →
`docs/testing.md` · giao diện → `docs/design-system.md` · production →
`docs/deployment.md` · con dấu → `docs/trust-seal.md`.

`documents-tsudev.md` là **đặc tả yêu cầu**, không phải mô tả hiện trạng. Mã
nguồn là hiện trạng; TSD là đích đến.

## Quy ước code

- **TypeScript ở khắp nơi.** Services là `.ts` biên dịch ra `dist/` với
  `module: commonjs` (KHÔNG phải ESM — giữ nguyên ngữ nghĩa `require()` và bảng
  tiền tố của backend-bundle). App là `.ts`/`.tsx`. `npm run typecheck` chạy cả
  hai. Đổi `.ts` mới nhớ thêm vào `references` của `tsconfig.json` gốc, thiếu là
  workspace đó **không được kiểm kiểu và không có gì báo lỗi**.
- **Service**: **không dấu chấm phẩy** (`.prettierrc.json` ghi đè `semi:false`
  cho `services/**/*.js`, `services/**/*.ts`, `packages/db/**`). App/package
  khác: **có** chấm phẩy, nháy đơn.
- **Backend dựng bằng `tsconfig.services.json`**, không phải `tsconfig.json`
  gốc: image Docker không COPY `apps/`, nên không có `@types/react` để dựng
  `packages/ui`.
- **DB**: chỉ qua `@tsudev/db`. Một database, một schema, bốn service dùng chung.
- **Trình duyệt KHÔNG gọi thẳng cổng service.** Mọi lời gọi qua route proxy
  `apps/*/pages/api/<domain>/[...path].js` (kể cả storage: `/api/storage/*`).
  Thêm endpoint ⇒ phải mở rộng proxy, nếu không CORS chặn.
- **Địa chỉ service lấy từ `apps/*/lib/services.js`**, đừng khai lại
  `process.env.X_SERVICE_URL || 'http://…'` trong file mới — `topology:check`
  sẽ bắt.
- **Điều hướng trong site dùng href tương đối** — tsudev chỉ còn MỘT origin.
  `MAIN_URL` của `@tsudev/ui` chỉ cho URL tuyệt đối thật sự cần (canonical, OG,
  mã nhúng huy hiệu).
- **Giao diện có HAI chế độ, Sáng là mặc định.** `:root` = bảng sáng,
  `:root[data-theme='dark']` ghi đè. KHÔNG dùng `prefers-color-scheme` — lựa
  chọn hiển thị là quyết định của sản phẩm, không phải của hệ điều hành. Thứ bậc
  chủ yếu bằng độ sáng nền (`--surface` < `--panel` < `--panel-2`); card có thêm
  viền hairline vì ở chế độ sáng hai tầng đó chênh nhau quá ít để mắt dựng ra
  cạnh. Đừng cắm cứng mã hex: `--on-vivid` đảo theo chế độ, mã hex thì không.
  Mọi cặp màu bị `packages/ui/test/contrast.test.ts` canh ở ngưỡng WCAG AA —
  đổi mã màu làm tụt tương phản là CI đỏ.
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
- **`requireRole()` (từ `@tsudev/auth`) đọc `User.role` trong DB và FAIL CLOSED.**
  Không còn biến môi trường nào tắt được nó. `role` là union `Role` nên gõ sai là
  lỗi biên dịch, không phải một cổng lặng lẽ cho qua.
- **trust-service gắn auth theo NHÁNH, không cho cả `/api`** (khác hai service
  kia). Mặc định là công khai — thêm nhánh riêng tư mà quên khai thì nó lộ ra.
  Danh sách nhánh nay là hằng `AUTH_PREFIXES` được xuất ra, và
  `test/authCoverage.test.ts` bắt mọi route không nằm rõ ràng ở một bên của ranh
  giới. Route mới buộc phải chọn một bên, không còn im lặng.
- **`TRUST_ISSUER` được ký vào chứng chỉ**; `TRUST_SIGNING_KEY` thiếu ở
  production ⇒ service từ chối khởi động (cố ý). Xoay khoá phải chuyển khoá cũ
  vào `TRUST_SIGNING_KEYS_RETIRED` trước.
- **`packages/trust-crypto/pkg/trust_crypto.wasm` là artifact ĐƯỢC COMMIT.**
  Render dựng image Docker từ git và image không có Rust, nên không thể dựng lúc
  phát hành. Sửa `src/lib.rs` ⇒ chạy
  `npm --workspace packages/trust-crypto run build:wasm` rồi **commit lại
  `.wasm`**; quên là job "WASM con dấu" của CI đỏ vì artifact không khớp nguồn.
  Cần Rust ở máy dev (`rustup`, target `wasm32-unknown-unknown`) — chỉ để sửa
  mảnh đó, mọi thứ còn lại không cần.
- **`REQUIRE_ROLE_ENFORCEMENT` ĐÃ BỊ GỠ. Đừng đặt lại.** Nó từng gác một nhánh
  đọc vai trò từ claim Keycloak — nhánh chưa bao giờ chạy ở production vì cả hai
  realm khai `"roles": {}`. Cờ mặc định tắt nên 4 route trông như được bảo vệ mà
  mở toang; bật lên thì chúng 403 vĩnh viễn (một trong bốn là `GET /api/posts`,
  đường đọc blog công khai). `.env.production.example` từng khuyến nghị đúng giá
  trị nguy hiểm đó.
  Phân quyền nay chỉ có MỘT nguồn: cột `User.role` trong DB, qua `@tsudev/auth`.
  Claim `role` trong khẳng định danh tính CHỈ ĐỂ THAM KHẢO và không nâng được
  quyền — có test canh. Đừng dựng lại hệ thứ hai chạy song song.
- **`INTERNAL_API_TOKEN` gác `/api` của content/storage** khi được đặt
  (không đặt = no-op). `trust-service` cố ý đứng ngoài — endpoint của nó phải
  công khai cho bên thứ ba.
- **`INTERNAL_IDENTITY_SECRET` phải GIỐNG NHAU ở Cloudflare Workers và Render.**
  BFF ký khẳng định danh tính bằng nó, service kiểm bằng nó. Lệch nhau ⇒ mọi
  đường ghi đã xác thực trả 401, và triệu chứng là "đăng nhập rồi mà vẫn 401" —
  đúng lỗi mà cơ chế này ra đời để chấm dứt. Thiếu hẳn ⇒ service trả 503 kèm log
  nói rõ lý do, cố ý ồn ào.
- **`TOTP_ENCRYPTION_KEY` đổi = MỌI thiết bị 2FA đang dùng hỏng.** Bí mật TOTP
  không băm được (kiểm mã cần chính giá trị đó) nên nó được mã hoá bằng khoá
  này. Sao lưu cùng chỗ với `TRUST_SIGNING_KEY`.
- **auth-service là service DUY NHẤT đọc `User.passwordHash`.** Nó tách riêng vì
  `frontend-main` chạy trên Cloudflare Workers — không có kết nối Postgres, không
  nạp được native module, nên Argon2id KHÔNG THỂ chạy ở tầng biên. Đừng "tối ưu"
  bằng cách đưa việc kiểm mật khẩu lên đó.

- **Docker build context phải là gốc repo** — service phụ thuộc package nội bộ
  không có trên npm registry.
- **`S3_ENDPOINT` và `S3_PUBLIC_ENDPOINT` khác nhau Ở DEV, TRÙNG NHAU ở
  production.** `S3_PUBLIC_ENDPOINT` chỉ phục vụ một việc: làm endpoint **ký URL
  presign**. Ở dev phải tách vì `S3_ENDPOINT` trỏ `minio:9000` trong mạng docker,
  trình duyệt không với tới. Ở production dùng R2 thì endpoint S3 API của R2 vốn
  đã công khai, nên cả hai cùng một giá trị. **Đừng đặt thành `cdn.tsudev.com`**
  — tên miền tuỳ chỉnh R2 không cài đặt giao thức chữ ký S3 (URL presign bị từ
  chối) và còn làm bucket thành công khai.
- **Xác thực nằm ở MỘT chỗ: `packages/auth`.** Ba bản `authMiddleware.js` gần
  trùng nhau đã bị gộp; ba bản tra-cứu-người-dùng (`resolveUser`, `actingUser`,
  `currentUser`) cũng vậy — và hai bản cục bộ chính là hai nơi phép so sánh
  `sessionVersion` bị bỏ sót, nên thu hồi phiên không có tác dụng ở đó. Đừng
  dựng lại bản cục bộ trong service.
- **Tín dụng ĐÃ BỊ GỠ. Đừng dựng lại.** `User.credits`, `SealProgram.feeCredits`
  và `SealApplication.feeCharged` đã bị xoá — mọi chương trình dấu nay miễn phí,
  theo quyết định "dự án cá nhân miễn phí". Trước đây `credits` là bẫy thật:
  nhìn tên tưởng là ví của chợ ký quỹ đã xoá, nhưng trust-service dùng nó để thu
  phí nộp đơn, và **không test nào bắt được** nếu xoá nhầm. Nay đường nộp đơn
  được canh bởi `services/trust-service/test/applicationSubmit.test.ts` — thêm
  lại cơ chế thu phí thì phải sửa test đó trước, không sửa lén được.
- **`main` không có branch protection** (GitHub Free + repo private). Lớp chắn
  duy nhất là `.husky/pre-push`, chỉ có sau khi `npm install`. Vượt có chủ đích:
  `ALLOW_MAIN_FORCE=1 git push`.
- **`backend-bundle` điều phối theo BẢNG TIỀN TỐ đường dẫn**, không mount chồng
  bốn app. Mount thẳng thì `/api/trust/*` đi vào app content trước và dính cổng
  chặn `INTERNAL_API_TOKEN` của nó ⇒ huy hiệu SVG, trang xác minh và JWKS (bắt
  buộc công khai) trả 401, **không có gì báo lỗi**. Thêm route có tiền tố chưa
  nằm trong bảng ⇒ route đó **404 ở production** dù chạy service riêng vẫn sống.
  Sửa route thì sửa bảng trong `services/backend-bundle/src/index.js`.
- **`/api` của content-service dùng XÁC THỰC TUỲ CHỌN, không phải chặn cứng.**
  Blog/tài liệu/dự án là nội dung công khai và BFF gọi SSR không mang Bearer
  token. Chặn cứng từng làm production **trống trơn** — `lib/api.js` nuốt 401
  thành `[]` nên triệu chứng là trang trống, không phải trang lỗi, và local
  không lộ ra vì `.env` bật `AUTH_DEV_BYPASS`. Đường ghi an toàn vì nằm dưới
  `/api/admin` và tự gọi `requireAdmin()` (đọc vai trò từ DB, fail closed).
  Thêm route ghi mới thì phải theo khuôn đó, đừng dựa vào middleware.
- **`.env.local` THẮNG `.env.production` trong Next — đã từng thành lỗ hổng.**
  `apps/*/.env.local` là bản sao nguyên văn `.env` gốc, và lệnh deploy chạy trên
  máy dev. Ngày 16/08/2026 bản production đã mang theo `E2E_BYPASS_KEYCLOAK=1`:
  **ai cũng đăng nhập được vào tài khoản ADMIN bằng `devpass`**, site vẫn chạy
  bình thường, không có gì báo lỗi. Provider đó nay đã bị gỡ, nhưng LỖ HỔNG
  KHÔNG PHẢI LÀ NÓ: lỗ hổng là việc giá trị dev đi được vào bản dựng production,
  và biến dev tiếp theo sẽ mang tên khác. Vì thế deploy đi qua
  `scripts/deploy-frontend.js` — nó **dời `.env.local` ra khỏi đường lúc dựng**.
  Đừng gọi thẳng `opennextjs-cloudflare deploy`. Nghiệm thu mỗi lần:
  `curl -s https://tsudev.com/api/auth/providers` phải CHỈ liệt kê provider đã
  cấu hình thật.
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
