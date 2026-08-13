# Phiếu bàn giao — đợt "website dự án cá nhân"

> Đọc file này **sau** `CLAUDE.md`, trước khi động vào việc. Nó là **trạng thái
> bàn giao**, không phải tài liệu vận hành: xong việc thì xoá, đừng để nó trở
> thành tầng tài liệu thứ hai nói khác `docs/`.
>
> Nguồn sự thật về đợt tái cấu trúc này:
> [`docs/refactor-personal-site.md`](docs/refactor-personal-site.md).

**Trạng thái:** nhánh `refactor/network-topology` @ `a4ea028`, **đã push**, cây
làm việc sạch. Bảy giai đoạn GĐ 0–7 đã xong ở local.

---

## 1. Việc kế tiếp, theo thứ tự

### 1.1 Mở PR — **BẮT BUỘC, và gấp hơn vẻ ngoài**

**PR đã mở: https://github.com/b4djl1h/tsudev/pull/9**

`.github/workflows/ci.yml` chỉ chạy `on.push` với `[main, master, 'feat/**']`.
Nhánh này tên `refactor/…` nên **push xong CI không chạy** — chỉ `on.pull_request`
(không lọc nhánh) mới kích hoạt. Nhớ điều này nếu sau này push thêm commit và
tưởng CI im lặng nghĩa là xanh.

Lần chạy đầu: 3/4 job xanh, `E2E` đỏ — test hồ sơ uy tín phụ thuộc dữ liệu demo
mà CI không tạo. Đã sửa (thêm `seed-demo.js` vào bước seed). `npm ci` với
`package-lock.json` vừa dựng lại **qua được** — đây từng là chỗ tôi đoán dễ đỏ
nhất, đoán sai.

```bash
gh run list --branch refactor/network-topology --limit 3
gh run view <id> --log-failed
```

Bốn job phải xanh: `Lint & format` · `Migrate & test services` · `E2E — smoke
các trang được giữ` · `Build frontends`.

### 1.2 Deploy migration DROP lên Neon — **cửa một chiều**

Chưa làm, **cố ý**. Hai migration mới đang nằm trong repo, mới chỉ áp dụng lên
DB local:

| Migration                                    | Việc                                   |
| -------------------------------------------- | -------------------------------------- |
| `20260812224401_drop_forum_market_messaging` | DROP 14 bảng, 6 enum, 2 cột của `User` |
| `20260812225340_add_project_copyright`       | thêm bảng `Project` + 3 enum           |

**Trình tự bắt buộc, không đảo:**

```bash
# 1. XUẤT DỮ LIỆU PRODUCTION TRƯỚC. Không có bước này thì không có đường lùi.
DATABASE_URL='<chuỗi kết nối Neon>' node scripts/export-legacy-data.js

# 2. Đọc backup/legacy-<ngày>/manifest.json, xác nhận số bản ghi hợp lý.

# 3. Chỉ khi đó mới deploy.
DATABASE_URL='<Neon>' npm run db:migrate
```

`backup/legacy-2026-08-12/` hiện có **chỉ là 10 bản ghi máy local**. Nó **KHÔNG**
là đường lùi cho dữ liệu thật. `backup/` đã bị gitignore — đừng commit.

Nếu `export-legacy-data.js` in "DB này đã qua migration DROP" thì DB đó đã bị áp
rồi; dừng lại và tìm hiểu vì sao, đừng chạy tiếp.

### 1.3 Sau khi merge

- Deploy `frontend-main` lên Cloudflare Workers và ba service lên Render.
  `render.yaml` đã bỏ `tsudev-user` — **xoá service `tsudev-user` trên
  dashboard Render bằng tay**, blueprint không tự dọn service đã gỡ khỏi file.
- Kiểm `/projects`, `/trust/org/<id>` trên production.

---

## 2. Nợ có đăng ký — biết rồi, chưa trả

Xếp theo mức đau nếu bỏ qua.

### 2.1 `REQUIRE_ROLE_ENFORCEMENT` vẫn không bật được — 🔴

Chỉ **4/46** route khai `requireRole`, và **không realm Keycloak nào khai một
vai trò nào**. Bật lên là bốn route đó 403 vĩnh viễn: `/api/posts` (mất blog),
presign ×2, upload.

Phải thiết kế chính sách vai trò trong realm trước. Xem
`docs/refactor-network-topology.md` §2B.

**Hệ quả cho mọi việc mới:** đường ghi phải **tự kiểm vai trò từ DB**, đừng dựa
vào `requireRole`. Khuôn mẫu: `requireAdmin` trong
`services/content-service/src/index.js`.

### 2.2 Root `package.json` còn ghim `react@18.3.1` — 🟠

Di sản của `frontend-forum` đã xoá. Nay chỉ Storybook lấy từ đó; app thật chạy
React 19.

Gỡ mù là **hỏng âm thầm**: `packages/ui` khai react là `peerDependency`, và
**Storybook không nằm trong CI** (đã kiểm: `ci.yml` không có job nào chạy
Storybook). Việc dọn đúng:

1. Chuyển `react`/`react-dom` xuống `devDependencies` của `packages/ui`.
2. Chạy `npm --workspace packages/ui run build-storybook` và xác nhận xanh.
3. Cân nhắc thêm job Storybook vào CI, nếu không lần sau vẫn mù.

Ghi chú đã đặt sẵn trong `apps/frontend-main/next.config.js`.

### 2.3 `npm run db:migrate` hỏng từ shell sạch — 🟡

```
Error: Environment variable not found: DATABASE_URL
```

`packages/db/prisma/seed.js` tự nạp `.env` ở gốc repo, nhưng `prisma migrate
deploy` thì không. Phải tự truyền:

```bash
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-) npm run db:migrate
```

CI không dính vì nó đặt `DATABASE_URL` tường minh. Chỉ đau ở máy dev, nhưng đau
mỗi lần.

### 2.4 `.env.bak-*` còn trên đĩa — 🟡

`.env.bak-1786550933` ở thư mục gốc là **bản sao nguyên văn** `.env`, gồm cả
`TRUST_SIGNING_KEY`. Đã thêm `.env.bak*` vào `.gitignore` (commit `894229f`) nên
không lọt vào git nữa, nhưng file vẫn nằm đó. Xoá hay giữ là quyết định của chủ
dự án — **đừng tự xoá**.

---

## 3. Hai cái bẫy đã trả giá trong đợt này

### 3.1 `next build` và `next dev` dùng chung `.next/`

Chạy `npm --workspace apps/frontend-main run build` trong lúc một `next dev` còn
sống sẽ **làm hỏng tiến trình dev đó**. Playwright (`reuseExistingServer`) sau đó
**dùng lại** nó và báo hàng loạt trang 500 — trông y hệt lỗi mã nguồn. Đã mất
một vòng chẩn đoán vì chuyện này.

Dọn cổng trước khi chạy E2E:

```bash
fuser -k 8080/tcp 3000/tcp 4001/tcp 4002/tcp 4003/tcp
cd e2e && npx playwright test --project=app
```

### 3.2 `git commit` cuốn cả index

`git rm` từ trước để lại 64 file xoá **đã staged**. `git add <một-file>` rồi
`git commit` sẽ commit **toàn bộ index**, không chỉ file vừa add. Kết quả: một
commit mang nhãn `chore: gitignore` nhưng xoá cả app diễn đàn. Đã `git reset` và
làm lại.

Trước mỗi commit: `git diff --cached --stat` và đọc con số cuối.

---

## 4. Bối cảnh để không phá nhầm

Ba thứ trông như rác nhưng **không phải**:

- **`User.credits`** — trust-service thu phí nộp đơn cấp dấu bằng cột này
  (`services/trust-service/src/index.js` — hàm nộp đơn, quanh dòng 666). Nhìn tên thì tưởng là
  ví của chợ ký quỹ đã xoá. Xoá theo là hỏng luồng nộp đơn, và **không test nào
  bắt được**.
- **`TrustCertificate.signature`** — chữ ký Ed25519, khác hẳn `User.signature`
  (chữ ký chân bài diễn đàn) đã DROP. Tên trùng, nghĩa khác.
- **`packages/brand` bộ avatar đầy đủ** — nay không trang nào dùng cỡ >48px,
  nhưng nó sinh từ ảnh gốc chứ không chép tay. Giữ.

Và một thứ **cố ý không sửa**: `docs/refactor-network-topology.md` là biên bản
đợt trước, cổng ghi trong đó đúng tại thời điểm đó. `documents-tsudev.md` là đặc
tả **yêu cầu**, không phải mô tả hiện trạng.

---

## 5. Chạy lại bộ kiểm

```bash
npm run db:up                                   # Postgres user-space :5433
export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)

npm run topology:check                          # 66 literal cổng, 20 file miễn trừ
npm run lint && npx prettier --check .
npm --workspace services/content-service test   # 6
npm --workspace services/storage-service test   # 9
npm --workspace services/trust-service  test    # 20
npm --workspace apps/frontend-main run build    # 27 tuyến

fuser -k 8080/tcp 3000/tcp 4001/tcp 4002/tcp 4003/tcp
cd e2e && npx playwright test --project=app     # 11/11
```

Toàn bộ đã xanh tại `a4ea028` trên máy local, chạy nguội.
