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

### 1.1 Migration DROP lên Neon — **cửa một chiều, làm TRƯỚC**

Hai migration đang nằm trong repo, mới chỉ áp dụng lên DB local:

| Migration                                    | Việc                                   |
| -------------------------------------------- | -------------------------------------- |
| `20260812224401_drop_forum_market_messaging` | DROP 14 bảng, 6 enum, 2 cột của `User` |
| `20260812225340_add_project_copyright`       | thêm bảng `Project` + 3 enum           |

**Trình tự bắt buộc, không đảo:**

```bash
# 1. XUẤT DỮ LIỆU PRODUCTION. Không có bước này thì không có đường lùi.
DATABASE_URL='<chuỗi kết nối Neon>' node scripts/export-legacy-data.js

# 2. Mở backup/legacy-<ngày>/manifest.json. Số bản ghi có hợp lý không?
#    `failures` phải rỗng. Nếu không, DỪNG.

# 3. Chỉ khi đó mới deploy migration.
DATABASE_URL='<Neon>' npm run db:migrate
```

`backup/legacy-2026-08-12/` hiện có **chỉ là 10 bản ghi máy local** — **KHÔNG**
phải đường lùi cho dữ liệu thật. `backup/` đã gitignore, đừng commit.

Nếu bước 1 in _"DB này đã qua migration DROP"_ thì DB đó đã bị áp rồi. Dừng lại
và tìm hiểu vì sao, đừng chạy tiếp.

### 1.2 Deploy — **làm SAU §1.1**

```bash
npm --workspace apps/frontend-main run deploy   # Cloudflare Workers
```

Ba service backend trên Render: đẩy theo blueprint như thường lệ.

**Vì sao phải sau:** mã mới đọc bảng `Project`. Deploy trước khi migrate thì
`/projects` rỗng và `/projects/<slug>` trả 404. Trang chủ vẫn sống — `lib/api.js`
nuốt lỗi thành `[]` — nên **triệu chứng là trang trống, không phải trang lỗi**.
Đừng đi tìm bug ở chỗ khác.

Nếu Render đã tự deploy theo merge (blueprint không khai `autoDeploy`, mặc định
của Render là bật) thì bạn đang ở đúng tình huống đó rồi; chạy §1.1 là hết.

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
