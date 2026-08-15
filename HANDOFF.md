# Phiếu bàn giao — đợt "website dự án cá nhân"

> **Trạng thái tạm.** Xong hai việc ở §1 thì **xoá file này** và xoá cả đoạn
> cảnh báo ở đầu `CLAUDE.md`. Để lâu nó thành tầng tài liệu thứ hai nói khác
> `docs/`.
>
> Nguồn sự thật về đợt tái cấu trúc:
> [`docs/refactor-personal-site.md`](docs/refactor-personal-site.md).

**Mã nguồn xong.** `main` @ `b00d71a`, cây sạch, CI xanh cả bốn job. PR #9 đã
merge, nhánh `refactor/network-topology` đã xoá, service `tsudev-user` đã xoá
khỏi Render. Bảy giai đoạn GĐ 0–7 hoàn tất.

**Còn đúng hai việc, cả hai nằm NGOÀI repo, và THỨ TỰ QUAN TRỌNG.**

---

## 1. Hai việc còn lại

### 1.1 Migration lên Neon — ✅ **XONG 16/08/2026**

Hoá ra không phải cửa một chiều: chủ dự án đã chuyển Neon sang tài khoản mới và
**database đích trống hoàn toàn** (0 bảng, 0 enum). Không có dữ liệu để mất, nên
bước export mất ý nghĩa và toàn bộ rủi ro DROP biến mất.

Đã làm:

- Soi DB bằng SQL thô trước khi đụng vào. **`scripts/export-legacy-data.js`
  KHÔNG dùng được nữa**: nó kiểm tra `prisma[model]`, mà Prisma client đã sinh
  từ schema ĐÃ xoá các bảng đó — nên nó luôn in _"DB này đã qua migration DROP"_
  bất kể DB thật ra sao. Đừng tin nó; hỏi thẳng `pg_class`.
- `prisma migrate deploy`: cả 6 migration áp dụng sạch. Kết quả 13 bảng +
  10 enum, có `Project`, không còn bảng diễn đàn/chợ/tin nhắn.
- Seed: 3 bài viết, 2 tài liệu, 4 chương trình dấu, 4 dự án, 1 admin.
- **Đã xoá `alice`/`bob`** — fixture dev, không gì tham chiếu tới (bài viết dùng
  `authorId` của admin). Để lại là hai tài khoản giả đăng nhập được ở production.
- Tạo database `keycloak` riêng trên cùng project Neon, tách khỏi `neondb` để
  Keycloak không đổ ~90 bảng của nó vào chung schema với Prisma.

**Hai câu hỏi treo bấy lâu đã có đáp án:**

| Câu hỏi                    | Đáp án                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Đã cấp chứng chỉ nào chưa? | **0** — nên `TRUST_ISSUER=https://tsudev.com` an toàn tuyệt đối, không có link rot |
| Neon ở region nào?         | **ap-southeast-1 (Singapore)** — khớp với Render Singapore                         |

**Đã tiền kiểm chứng** `services/backend-bundle` chạy thẳng trên DB Neon thật
với `NODE_ENV=production`: 4 dự án, 3 bài, 2 tài liệu, 4 chương trình dấu đều
trả đúng; `/api/trust/directory` trả 200 dù `INTERNAL_API_TOKEN` đang bật, còn
`/api/posts` trả 401 khi thiếu token. Bất biến quan trọng nhất đứng vững trên
dữ liệu thật.

### 1.2 Dựng lại hạ tầng — **làm SAU §1.1**

Không còn là "đẩy theo blueprint như thường lệ". Ba thứ đã đổi cùng lúc:

- Repo chuyển sang `tsudev-tsudev/tsudev`; **Render vẫn đang nối với repo cũ**
  `b4djl1h/tsudev`, nên push vào repo mới KHÔNG kích hoạt deploy nào. Điều này
  vô tình là lớp bảo vệ: không có gì tự chạy trước khi bạn xong §1.1.
- Ba service backend đã gộp thành một (`services/backend-bundle`).
- **Region là bất biến trên Render** — bốn service cũ nằm ở Oregon; muốn sang
  Singapore phải XOÁ và DỰNG LẠI, không có nút đổi.

Vì cả ba lý do, đây là dựng mới chứ không phải deploy lại.

```
1. Render → New → Blueprint → chọn repo tsudev-tsudev/tsudev
   Blueprint tạo 2 service: tsudev-backend, tsudev-sso (đều region singapore).
   Render sẽ hỏi mọi biến `sync: false` — chuẩn bị sẵn giá trị cũ.
2. Đối chiếu URL Render cấp cho tsudev-backend với 3 biến *_SERVICE_URL
   trong apps/frontend-main/wrangler.jsonc. Khác thì sửa file rồi mới deploy.
3. Keycloak: gắn custom domain auth.tsudev.com cho tsudev-sso.
4. wrangler secret put NEXTAUTH_SECRET / KEYCLOAK_CLIENT_SECRET / INTERNAL_API_TOKEN
5. npm --workspace apps/frontend-main run deploy
   (routes custom_domain trong wrangler.jsonc tự tạo bản ghi DNS cho
    tsudev.com và www.tsudev.com — không phải thêm tay)
6. Xoá 4 service Oregon cũ. Làm SAU CÙNG: xoá trước là mất đường lùi.
```

**Vì sao phải sau §1.1:** mã mới đọc bảng `Project`. Chạy trước khi migrate thì
`/projects` rỗng và `/projects/<slug>` trả 404. Trang chủ vẫn sống — `lib/api.js`
nuốt lỗi thành `[]` — nên **triệu chứng là trang trống, không phải trang lỗi**.
Đừng đi tìm bug ở chỗ khác.

**Ngân sách giờ chạy:** free tier cho 750 giờ instance/tháng cho CẢ tài khoản.
Giữ ấm `tsudev-backend` tiêu 720 giờ ⇒ `tsudev-sso` buộc phải được ngủ. Đừng
đặt ping giữ ấm cho cả hai, vỡ ngân sách là Render dừng hết.

**Nghiệm thu trên production, sau cả hai bước:**

- `/projects` hiện 4 dự án, `/projects/tsudev-trust-seal` hiện số giấy chứng nhận
- `/trust/directory` hiện chứng chỉ, bấm tên tổ chức ra `/trust/org/<id>`
- `/blog`, `/docs` còn nguyên

---

## 2. Nợ có đăng ký — biết rồi, chưa trả

### 2.1 `REQUIRE_ROLE_ENFORCEMENT` vẫn không bật được — 🔴

Chỉ **4/46** route khai `requireRole`, và **không realm Keycloak nào khai một
vai trò nào**. Bật lên là bốn route đó 403 vĩnh viễn: `/api/posts` (mất blog),
presign ×2, upload. Phải thiết kế chính sách vai trò trong realm trước — xem
`docs/refactor-network-topology.md` §2B.

**Hệ quả cho MỌI việc mới:** đường ghi phải **tự kiểm vai trò từ DB**, đừng dựa
vào `requireRole`. Khuôn mẫu: `requireAdmin` trong
`services/content-service/src/index.js`.

### 2.2 Root `package.json` còn ghim `react@18.3.1` — 🟠

Di sản của `frontend-forum` đã xoá; nay chỉ Storybook lấy từ đó, app thật chạy
React 19. Gỡ mù là **hỏng âm thầm**: `packages/ui` khai react là
`peerDependency`, và **Storybook không nằm trong CI**.

1. Chuyển `react`/`react-dom` xuống `devDependencies` của `packages/ui`.
2. `npm --workspace packages/ui run build-storybook` — phải xanh.
3. Cân nhắc thêm job Storybook vào CI, nếu không lần sau vẫn mù.

Ghi chú đã đặt sẵn trong `apps/frontend-main/next.config.js`.

### 2.3 `npm run db:migrate` hỏng từ shell sạch — 🟡

`Error: Environment variable not found: DATABASE_URL`. `seed.js` tự nạp `.env` ở
gốc repo, `prisma migrate deploy` thì không. Phải tự truyền:

```bash
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-) npm run db:migrate
```

CI không dính vì nó đặt biến tường minh. Chỉ đau ở máy dev, nhưng đau mỗi lần.

### 2.4 `.env.bak-*` còn trên đĩa — 🟡

`.env.bak-1786550933` ở thư mục gốc là bản sao nguyên văn `.env`, gồm cả
`TRUST_SIGNING_KEY`. Đã thêm `.env.bak*` vào `.gitignore` nên không lọt vào git,
nhưng file vẫn nằm đó. **Đừng tự xoá** — quyết định của chủ dự án.

---

## 3. Bẫy đã trả giá — đọc trước khi mất thời gian chẩn đoán

### 3.1 CI im lặng KHÔNG có nghĩa là xanh

`.github/workflows/ci.yml` chỉ chạy `on.push` cho `main`, `master`, và nhánh
khớp mẫu `feat/` + hai dấu sao. Nhánh tên khác (`refactor/…`, `fix/…`) push lên
thì **CI không chạy gì hết**. Chỉ `on.pull_request` (không lọc nhánh) mới kích
hoạt. Đặt tên nhánh `feat/…`, hoặc mở PR sớm.

`.husky/pre-push` **chặn push thẳng lên `main`**. Cửa thoát có chủ đích:
`ALLOW_MAIN_FORCE=1 git push` — không phải force push, chỉ bỏ chốt "phải qua PR".

### 3.2 Test có thể phụ thuộc dữ liệu bạn seed bằng tay

Test "hồ sơ uy tín tổ chức" xanh ở local, đỏ ở CI: `db:seed` chỉ tạo chương
trình dấu, **không tạo chứng chỉ nào**. Nó xanh ở local chỉ vì
`services/trust-service/scripts/seed-demo.js` đã được chạy tay lúc dựng tính
năng. Đã sửa bằng cách thêm script đó vào bước seed của job E2E.

Bài học rộng hơn: **trạng thái máy dev không phải mặc định.**

### 3.3 `next build` và `next dev` dùng chung `.next/`

Chạy build trong lúc một `next dev` còn sống sẽ **làm hỏng tiến trình dev đó**.
Playwright (`reuseExistingServer`) sau đó dùng lại nó và báo hàng loạt trang 500
— trông y hệt lỗi mã nguồn. Dọn cổng trước khi chạy E2E.

### 3.4 `git commit` cuốn cả index

`git rm` từ trước để lại file xoá **đã staged**; `git add <một-file>` rồi
`git commit` sẽ commit **toàn bộ index**. Trước mỗi commit:
`git diff --cached --stat`, đọc con số cuối.

---

## 4. Ba thứ trông như rác nhưng KHÔNG phải

- **`User.credits`** — trust-service thu phí nộp đơn cấp dấu bằng cột này
  (`services/trust-service/src/index.js`, hàm nộp đơn, quanh dòng 666). Nhìn tên
  thì tưởng là ví của chợ ký quỹ đã xoá. Xoá theo là hỏng luồng nộp đơn, và
  **không test nào bắt được**.
- **`TrustCertificate.signature`** — chữ ký Ed25519. Khác hẳn `User.signature`
  (chữ ký chân bài diễn đàn) đã DROP. Tên trùng, nghĩa khác.
- **Bộ avatar đầy đủ trong `packages/brand`** — nay không trang nào dùng cỡ trên
  48px, nhưng nó sinh từ ảnh gốc chứ không chép tay. Giữ.

**Hai file cố ý không sửa:** `docs/refactor-network-topology.md` là biên bản đợt
trước (cổng ghi trong đó đúng tại thời điểm đó); `documents-tsudev.md` là đặc tả
**yêu cầu**, không phải mô tả hiện trạng.

---

## 5. Chạy lại bộ kiểm

```bash
npm run db:up
export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)

npm run topology:check                          # 66 literal cổng, 20 file miễn trừ
npm run lint && npx prettier --check .
npm --workspace services/content-service test   # 6
npm --workspace services/storage-service test   # 9
npm --workspace services/trust-service  test    # 20
npm --workspace apps/frontend-main run build    # 27 tuyến

fuser -k 8080/tcp 3000/tcp 4001/tcp 4002/tcp 4003/tcp   # xem §3.3
cd e2e && npx playwright test --project=app     # 11/11
```

Muốn E2E chạm được dữ liệu con dấu thì seed thêm — script idempotent:

```bash
node services/trust-service/scripts/seed-demo.js
```

Toàn bộ đã xanh tại `b00d71a`, cả trên máy local lẫn trên CI.
