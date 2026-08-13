# Kế hoạch tái cấu trúc: từ hệ sinh thái cộng đồng về website dự án cá nhân

Bỏ Diễn đàn và các chức năng cộng đồng đi kèm; giữ và làm sâu Con dấu tín nhiệm;
thêm mục Dự án/Bản quyền làm trọng tâm mới. Đích đến là **một website dự án cá
nhân hoàn chỉnh**, không phải một diễn đàn bị cắt bớt.

Tài liệu này là **kế hoạch**. Hiện trạng vẫn là `CLAUDE.md` và
[refactor-network-topology.md](refactor-network-topology.md).

---

## 1. Bốn quyết định đã chốt

| #   | Quyết định                                                                   |
| --- | ---------------------------------------------------------------------------- |
| 1   | Bỏ **cả ba** chức năng cộng đồng còn lại: Chợ ký quỹ, Tin nhắn, Thành viên   |
| 2   | Thay Diễn đàn bằng mục **Dự án + Bản quyền**                                 |
| 3   | Uy tín chuyển thành **hồ sơ tổ chức gắn con dấu**, bỏ điểm uy tín thành viên |
| 4   | **Migration mới xoá bảng**, kèm script export ra JSON trước khi xoá          |

## 2. Quy mô thật — đo được, không ước lượng

### 2.1 Route: 32 trên 36 của content-service bị gỡ

| Tiền tố         | Số route | Số phận |
| --------------- | -------- | ------- |
| `/api/mod`      | 12       | gỡ      |
| `/api/market`   | 8        | gỡ      |
| `/api/forum`    | 7        | gỡ      |
| `/api/messages` | 5        | gỡ      |
| `/api/posts`    | 2        | **giữ** |
| `/api/docs`     | 2        | **giữ** |

`content-service/src/index.js` từ **1022 dòng** còn khoảng một phần năm.

### 2.2 user-service còn đúng 0 route

Hai route duy nhất của nó — `GET /api/users` và `GET /api/users/:username` —
**chính là** chức năng Thành viên vừa bị bỏ. Còn lại `/health`.

Đây không phải một lựa chọn kiến trúc mà là hệ quả số học: **user-service bị xoá**.
Kéo theo:

- bớt **một cổng** (4000) — đúng yêu cầu "loại bỏ các cổng port không cần thiết"
- bớt một mục trong `render.yaml`, một `Dockerfile`, một node trong topology
- bớt **một trong bốn `authMiddleware.js` gần trùng nhau** mà `CLAUDE.md` cảnh báo

Model `User` **vẫn giữ**: nó là tài khoản quản trị và là tác giả của bài viết.
Chỉ có _service_ biến mất, không phải dữ liệu người dùng.

### 2.3 Model Prisma: 12 trên 24 bị xoá

| Nhóm       | Model                                              | Ghi chú                               |
| ---------- | -------------------------------------------------- | ------------------------------------- |
| Diễn đàn   | `Category` `Board` `Thread` `ForumPost` `Reaction` | `Reaction` phụ thuộc cứng `ForumPost` |
| Chợ        | `Listing` `Order`                                  |                                       |
| Tin nhắn   | `Conversation` `ConversationParticipant` `Message` |                                       |
| Kiểm duyệt | `Report` `ModAction` `Ban`                         | **hệ quả bắt buộc**, xem §2.4         |
| Uy tín     | `ReputationEvent` + cột `User.reputation`          | chuyển sang hồ sơ tổ chức (§3.3)      |

Enum bị xoá: `ReportTargetType` `ReportStatus` `ModActionType` `ListingStatus`
`OrderStatus` `ReactionType`.

**Giữ nguyên**: `User` `Post` `Doc` `FileObject` và **toàn bộ 8 model `Trust*`**.

### 2.4 Kiểm duyệt chết theo, không phải lựa chọn

`ReportTargetType` chỉ có `THREAD` và `POST`. Năm trên chín giá trị
`ModActionType` là hành vi diễn đàn (`PIN` `UNPIN` `LOCK` `UNLOCK` `DELETE_POST`).
Bỏ diễn đàn thì hệ kiểm duyệt **không còn đối tượng nào để kiểm duyệt** — nó
không "nên" bị bỏ, nó đã rỗng nghĩa. Trang `/admin/moderation` gỡ theo.

### 2.5 Trang

| Gỡ                                                     | Giữ                                                      |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `market/` (4 trang) · `messages/` (1) · `members/` (2) | `blog/` · `docs/` · `trust/` (6) · `admin/{index,trust}` |
| `admin/moderation.js`                                  | `index` `privacy` `terms` `rules` `profile` `products`   |
| **toàn bộ `apps/frontend-forum/`**                     |                                                          |

---

## 3. Kiến trúc đích

### 3.1 Hình trạng sau tái cấu trúc

```
tsudev.vn                 frontend-main   (app DUY NHẤT)
auth.tsudev.vn            Keycloak
cdn.tsudev.vn             R2 / MinIO
  └── nội bộ: content-service · storage-service · trust-service
```

Cổng đi từ **11 xuống 7**: bỏ 3001 (frontend-forum) và 4000 (user-service).

| Trước              | Sau    | Thành phần               |
| ------------------ | ------ | ------------------------ |
| 3000               | 3000   | frontend-main            |
| ~~3001~~           | —      | ~~frontend-forum~~       |
| ~~4000~~           | —      | ~~user-service~~         |
| 4001               | 4001   | content-service          |
| 4002               | 4002   | storage-service          |
| 4003               | 4003   | trust-service            |
| 4100               | 4100   | Keycloak                 |
| 5433 · 6379 · 9000 | như cũ | Postgres · Redis · MinIO |

### 3.2 Điều hướng mới

```
Trang chủ · Dự án · Blog · Tài liệu · Con dấu
```

Từ 8 mục xuống 5. Bỏ: Diễn đàn, Chợ, Tin nhắn, Thành viên. Thêm: Dự án.

### 3.3 Mục Dự án + Bản quyền — trọng tâm mới

Model mới `Project`:

| Trường                                                                    | Vì sao                                       |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| `slug` `name` `summary` `descriptionMd`                                   | trang giới thiệu từng dự án                  |
| `kind` (APP·TOOL·LIBRARY·SERVICE)                                         | phân loại dự án/tools/phần mềm               |
| `status` (WIP·BETA·STABLE·ARCHIVED)                                       | trạng thái phát triển                        |
| `version` `releasedAt` `repoUrl` `downloadUrl`                            | phát hành                                    |
| `license` (SPDX)                                                          | giấy phép mã nguồn                           |
| `copyrightStatus` (NONE·PENDING·REGISTERED) + `copyrightNo` `copyrightAt` | **đăng ký bản quyền**                        |
| `trustProgramSlug`?                                                       | nối dự án với chương trình cấp dấu tương ứng |

Trường bản quyền là thứ bạn nêu là hướng tương lai, và nó cũng chính là cầu nối
tự nhiên sang Con dấu tín nhiệm: _dự án có bản quyền_ → _website dùng dự án đó_
→ _được cấp huy hiệu_.

### 3.4 Uy tín chuyển sang tổ chức

Bỏ `ReputationEvent` và `User.reputation`. "Uy tín" từ nay là thuộc tính của
`TrustOrganization`, dẫn ra từ dữ liệu **đã có sẵn** trong 8 model `Trust*`:

- chứng chỉ đang hiệu lực / đã thu hồi
- lịch sử `TrustCheck` (giám sát tên miền định kỳ)
- thâm niên kể từ lần cấp đầu

Không cần model mới cho phần này — chỉ cần một trang hồ sơ tổ chức và vài truy
vấn tổng hợp. Đúng mục đích bạn nêu: **cấp huy hiệu cho website dùng source code
tsudev, và chứng nhận cho website do đội ngũ tsudev thực hiện.**

---

## 4. Lộ trình bảy giai đoạn

Nguyên tắc như đợt trước: mỗi giai đoạn tự đứng được, một nhánh cho cả chuỗi,
cổng kiểm chạy ở cuối mỗi giai đoạn.

### GĐ 0 — Lưới an toàn & xuất dữ liệu ✅ **xong**

- `scripts/export-legacy-data.js` xuất Diễn đàn/Chợ/Tin nhắn ra JSON trong
  `backup/` trước khi có bất kỳ lệnh DROP nào. **Đây là đường lùi duy nhất.**
- Thay lưới an toàn cũ: E2E `cross-origin-session` mất ý nghĩa khi chỉ còn một
  app (§6.1). Viết `smoke.spec.js` thay thế: trang chủ · blog · docs · trust ·
  đăng nhập · `/admin` — phải xanh **trước** khi gỡ gì.

**Nghiệm thu — đã đạt:**

```
✓ export-legacy-data.js: 15 bảng, số bản ghi khớp psql từng bảng
    category 2 · board 2 · thread 1 · forumPost 2 · user.reputation 3 · còn lại 0
✓ smoke.spec.js: 8/8 xanh (trang chủ · blog · docs · trust · đăng nhập · admin · điều hướng)
✓ negative control: cắt CONTENT_SERVICE_URL ⇒ ĐÚNG 2 test phụ thuộc nội dung đỏ,
  6 test còn lại vẫn xanh — chứng minh test khẳng định nội dung thật, không phải HTTP 200
✓ topology:check · lint · prettier · 41/41 unit test
```

Ba điều chốt thêm khi làm:

- `backup/` vào `.gitignore` **và** `.prettierignore` — bản xuất có thể chứa dữ
  liệu production, tuyệt đối không commit.
- Job CI `e2e-app` nay có **Postgres + migrate + seed**. Không có DB thì
  `getServerSideProps` nuốt lỗi, trang rỗng vẫn trả 200 và smoke xanh vô nghĩa.
- Project Playwright đổi `session` → **`app`** (`npm run e2e:app`): tên cũ sai
  nghĩa ngay khi `frontend-forum` biến mất.

### GĐ 1 — Gỡ tầng trình bày ✅ **xong**

`apps/frontend-forum/` (toàn bộ) · `pages/{market,messages,members}` ·
`admin/moderation.js` · route BFF `pages/api/{market,mod}` ·
`SiteHeader`/`SiteFooter`/`siteUrls` bỏ `forum` · trang chủ bỏ khối diễn đàn.

**Nghiệm thu — đã đạt:** 55 file xoá, 34 file sửa.

```
✓ build frontend-main: 10 trang tĩnh (trước 15)
✓ smoke 7/7 — gồm test "điều hướng chính không có link chết"
✓ topology:check (72 literal cổng) · lint · prettier · 41/41 unit test
```

Ba việc phải kéo sớm hơn kế hoạch, vì để lại là hỏng ngay:

- **Node `forum` khỏi `config/topology.json`** (kế hoạch xếp GĐ 3). Giữ một node
  trỏ vào app đã xoá thì `run-dev`, `verify-stack` và `playwright` đều nổ.
- **Service `frontend-forum` khỏi `docker-compose.yml`** — Dockerfile của nó
  không còn.
- **Redirect URI của forum khỏi cả hai realm Keycloak** — để lại là mở sẵn một
  origin không còn ai sở hữu.

Gỡ theo luôn vì mất hết đối tượng: `ThreadRow` (component chỉ dùng cho diễn đàn),
`siteUrl()` và `FORUM_URL` (một site thì link tương đối mới đúng — `MAIN_URL`
giữ lại cho canonical/OG), `scripts/check-session-sharing.js` và
`cross-origin-session.spec.js` (không còn hai origin để kiểm), và
`pages/products.js` — trang mồ côi không ai liên kết, chính là bản thô của
`/projects` sẽ dựng ở GĐ 5.

**Trang chủ và trang pháp lý viết lại**: khối "Hoạt động diễn đàn" + "Thành viên
tích cực" thay bằng khối "Website mang dấu tsudev" đọc từ `trust.directory()`;
số liệu hero đổi từ _thành viên/bài viết/chủ đề_ sang _bài viết/tài liệu/website
đã cấp dấu_; `terms` `rules` `privacy` bỏ mô tả diễn đàn/chợ/tin nhắn.

**`/admin` viết lại**: nó lấy số liệu từ `/api/mod/summary` — toàn bộ là số đo
diễn đàn. Nay thành cổng vào Con dấu tín nhiệm (+ ô Dự án đánh dấu "sắp có").

> **Nợ ghi nhận, chưa làm:** root `package.json` còn ghim `react@18.3.1` — thứ
> tồn tại **chỉ vì** frontend-forum. Gỡ được về lý thuyết, nhưng Storybook của
> `packages/ui` khai react là peerDependency và đang lấy từ root, mà Storybook
> **không nằm trong CI** nên gỡ mù là hỏng âm thầm. Việc dọn: chuyển
> `react`/`react-dom` xuống devDependencies của `packages/ui` rồi kiểm
> `build-storybook`. Ghi chú đã đặt trong `next.config.js`.

### GĐ 2 — Gỡ tầng service ✅ **xong**

32 route của content-service · **xoá hẳn user-service** · gỡ `awardReputation`.

**Đã làm:**

- `content-service/src/index.js`: **1022 → 162 dòng**. Còn `/health` +
  `/api/{posts,posts/:slug,docs,docs/:slug}`. Gỡ theo cả `slugify`,
  `currentUser`, `requireModerator`, `logModAction`, `activeBanFor`,
  `awardReputation` — hết đối tượng dùng.
- **`services/user-service/` bị xoá cả thư mục.** Hai route của nó
  (`/api/users`, `/api/users/:username`) chính là chức năng Thành viên đã bỏ, và
  route thứ hai còn đếm `thread`/`forumPost` — hai model sắp DROP ở GĐ 4.
- `authorCard` bỏ `reputation`/`rank` (quyết định #3). Đã kiểm: không file nào
  trong `apps/frontend-main` hay `packages/ui` còn đọc hai trường này.
- Xoá `apps/frontend-main/pages/profile.js` — trang mồ côi, dữ liệu cứng
  `{ name: 'Guest' }`, cùng loại với `products.js` đã xoá ở GĐ 1.

**Kéo GĐ 3 vào đây** (để lại là hỏng lúc chạy, không phải hỏng sau): node `user`
khỏi `config/topology.json` và `config/topology.allow`; `render.yaml` bỏ
`tsudev-user`; `docker-compose.yml` bỏ service + `depends_on`; `package.json`,
`scripts/run-dev.js`, `scripts/verify-stack.js`, `Makefile`,
`.github/workflows/ci.yml` bỏ mọi nhắc đến workspace đã xoá; `USER_SERVICE_URL`
biến mất khỏi `.env`, `.env.example`, `.env.production.example` qua
`topology:gen`.

Phần còn lại của GĐ 3 đã xong từ GĐ 1 (node `forum`, tuyến `forum.` của
dev-proxy, redirect URI trong hai realm, `FORUM_URL`). **GĐ 3 khép lại, không
còn việc.**

**Nghiệm thu (đo được):**

```
✓ topology:check — 68 literal cổng (GĐ 1: 72), 20 file miễn trừ (GĐ 1: 22)
✓ lint · prettier --check toàn repo
✓ content 6 · storage 9 · trust 20 = 35/35 unit test
✓ build frontend-main: 22 tuyến, không tuyến nào lỗi
✓ e2e smoke 7/7
```

Cổng trong topology còn **8**: 3000 · 4001 · 4002 · 4003 · 4100 · 5433 · 6379 · 9000. (Bảng ở §3.1 ghi "7" — đếm sót Redis 6379; con số đúng là 8.)

### GĐ 4 — Migration xoá bảng _(cửa một chiều)_ ✅ **xong ở local**

`packages/db/prisma/migrations/20260812224401_drop_forum_market_messaging/`.
Migration **mới**, không sửa file cũ nào — bốn migration trước giữ nguyên
checksum.

**Con số đúng là 14 bảng, không phải 12.** §2.3 liệt kê đủ 14 model nhưng tiêu
đề ghi "12 trên 24"; thực tế lược đồ có **26 model**, xoá 14, **giữ 12**. Đếm
xong trên DB trống: `Doc FileObject Post SealApplication SealEvidence
SealProgram TrustAuditLog TrustCertificate TrustCheck TrustDomain
TrustOrganization User`.

**Ba cột của `User`, ba số phận khác nhau:**

| Cột          | Số phận | Vì sao                                                                                                           |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `reputation` | DROP    | theo kế hoạch (quyết định #3)                                                                                    |
| `signature`  | DROP    | chữ ký chân bài diễn đàn. Không nhầm với `TrustCertificate.signature` — tên trùng, nghĩa khác hẳn                |
| `credits`    | **GIỮ** | `trust-service/src/index.js:588-596` thu phí nộp đơn cấp dấu bằng cột này, trong cùng transaction đổi trạng thái |

`credits` là bẫy thật: nhìn tên thì đó là ví của chợ ký quỹ đã xoá, xoá theo là
hỏng luồng nộp đơn — và test hiện có sẽ **không** bắt được, vì không test nào
chạm đường thu phí. Đã ghi chú ngay trên trường trong `schema.prisma`.

**Gỡ theo:**

- `packages/types`: bỏ `REP`, `RANK_TIERS`, `rankFor` — hết nơi dùng.
  `hasAtLeastRole` **giữ**, trust-service gọi ở 5 chỗ.
- `seed.js`: bỏ khối diễn đàn (65 dòng) và ba giá trị `reputation`.
- `export-legacy-data.js`: thêm cửa vào — DB đã qua migration này thì in một
  dòng và thoát 0, thay vì báo "15 bảng không xuất được" khiến người chạy tưởng
  hỏng.

**Nghiệm thu (đo được):**

```
✓ backup/legacy-2026-08-12/ — 10 bản ghi, 15 bảng, xuất TRƯỚC khi DROP
✓ migrate deploy trên DB trống: 5/5 migration, còn đúng 12 bảng
✓ db:seed trên DB trống: 3 user · 3 post · 2 doc · 4 chương trình dấu
✓ content 6 · storage 9 · trust 20 = 35/35 · lint · prettier · topology:check
✓ build 22 tuyến · e2e smoke 7/7
```

> **Chưa chạm production.** Migration mới nằm trong repo, chưa `migrate deploy`
> lên Neon. Đó là một lần deploy riêng, cần xác nhận riêng — và cần chạy
> `export-legacy-data.js` trỏ vào `DATABASE_URL` của production **trước**, vì
> bản xuất hiện có chỉ là dữ liệu máy local.

### GĐ 5 — Dựng mục Dự án + Bản quyền ✅ **xong**

Model `Project` (migration `20260812225340_add_project_copyright`) · 6 route ·
`/projects`, `/projects/[slug]`, `/admin/projects` · vào điều hướng và chân
trang · seed 4 dự án thật.

**Đường ghi KHÔNG dựa vào `requireRole()`.** Hàm đó là no-op trừ khi
`REQUIRE_ROLE_ENFORCEMENT=true`, mà biến đó hiện không bật được ở production
(§GĐ 4 của kế hoạch mạng). Dùng nó để gác `/api/admin/projects` là để cửa mở ở
cả local lẫn production. `requireAdmin` vì thế đọc vai trò **lưu trong DB**.
Đo được: ẩn danh → 401, `alice` (MEMBER) → 403, `tsudev` (ADMIN) → 200.

**`copyrightStatus=REGISTERED` bắt buộc có `copyrightNo`,** và PATCH kiểm trên
giá trị **sau khi ghép** chứ không trên phần thân request — gửi mỗi
`copyrightStatus` vẫn phải thoả. Đây là khẳng định pháp lý; để trống là công bố
một thứ không có gì chống lưng.

BFF mới `pages/api/content/[...path].js` dùng **danh sách trắng tiền tố** (chỉ
`admin`). Đọc công khai không đi qua đây — nó chạy trong `getServerSideProps`,
phía server, nên không có CORS để vướng.

### GĐ 6 — Hồ sơ uy tín tổ chức ✅ **xong**

`GET /api/trust/profile/:orgId` (công khai) + trang `/trust/org/[id]`; danh bạ
liên kết sang hồ sơ; trang chương trình dấu liệt kê dự án tsudev thuộc chương
trình đó (liên kết hai chiều Dự án ↔ Chương trình).

**Cố ý không có "điểm uy tín".** Một con số kiểu 87/100 trông có thẩm quyền hơn
nhiều so với thứ nó thật sự đo được, và người đọc không kiểm chứng được cách
tính. Thay bằng bốn chỉ số thô, mỗi cái truy về được nguồn: chứng chỉ hiệu lực ·
tên miền đã xác minh · năm mang dấu đầu tiên · tỉ lệ vượt giám sát.

`checkPassRate` trả **`null`** khi chưa có lần kiểm nào, và trang in "Chưa đo"
chứ không phải "100%". "Chưa đo" và "hoàn hảo" là hai chuyện khác nhau.

Hồ sơ hiện cả **lịch sử** — chứng chỉ hết hạn, đình chỉ, thu hồi. Một hồ sơ tín
nhiệm chỉ khoe phần đẹp thì không đáng tin. Đã kiểm: endpoint không lộ
`contactEmail`, `ownerUserId` hay đơn đang chờ duyệt; org không tồn tại → 404.

Hàng trong danh bạ đổi từ một thẻ `<a>` bọc ngoài thành `<div>` chứa hai link:
`<a>` lồng trong `<a>` là HTML không hợp lệ, trình duyệt tự gỡ và **cả hai** link
cùng hỏng.

### GĐ 7 — Tài liệu ✅ **xong**

`docs/*` · `README.md` · mọi `README.md` con · `AGENTS.md` · `.claude/agents/*`
· `CLAUDE.md` **sau chót** (đúng luật của chính nó về cache).

Ba chỗ chỉ sửa được sau khi đo lại, không suy ra được:

- `CLAUDE.md` nói "5/75 route có `requireRole`" — nay là **4/46**, và route bị
  403 nếu bật cưỡng chế là blog/presign/upload, không còn "danh sách thành viên".
- `docs/architecture.md` nói 12 model — đếm thật là **13** (`Project` mới).
- `packages/brand/README.md` nói avatar 80px/64px dùng bộ đầy đủ — grep ra chỉ
  còn 22px và 32px, nghĩa là bộ đầy đủ nay **chỉ phục vụ Storybook**.

**Hai file cố ý không sửa:** `refactor-network-topology.md` là biên bản của đợt
trước (cổng ghi trong đó đúng tại thời điểm đó — sửa là làm sai lịch sử), và
`documents-tsudev.md` là **đặc tả yêu cầu**, không phải mô tả hiện trạng.

### Nghiệm thu cuối (đo được, chạy nguội)

```
✓ topology:check — 66 literal cổng, 20 file miễn trừ
✓ lint · prettier --check toàn repo
✓ content 6 · storage 9 · trust 20 = 35/35 unit test
✓ build frontend-main: 24 tuyến
✓ e2e smoke 11/11
```

> **Bẫy khi tự chạy lại bộ E2E:** `next build` và `next dev` dùng chung thư mục
> `.next/`. Chạy build trong lúc một `next dev` còn sống sẽ làm hỏng tiến trình
> dev đó, và Playwright (`reuseExistingServer`) sẽ **dùng lại** nó rồi báo hàng
> loạt trang 500 — trông y hệt lỗi mã nguồn. Dọn cổng trước khi chạy:
> `fuser -k 8080/tcp 3000/tcp 4001/tcp 4002/tcp 4003/tcp`.

### Việc còn lại, thuộc về người vận hành

1. **Chưa deploy migration DROP lên Neon.** Trước khi deploy phải chạy
   `export-legacy-data.js` với `DATABASE_URL` của production — bản xuất hiện có
   chỉ là dữ liệu máy local, nó **không** là đường lùi cho dữ liệu thật.
2. **Nợ React 18** ở root `package.json` (xem GĐ 1).
3. `.gitignore` vừa được bổ sung `.env.bak*`: script sinh ra
   `.env.bak-<timestamp>` chứa **nguyên văn** mọi secret kể cả
   `TRUST_SIGNING_KEY`, mà trước đó không khớp mẫu nào nên `git add -A` sẽ nuốt
   gọn. File đang có trên máy vẫn còn — xoá hay giữ là tuỳ bạn.

---

## 5. Cửa một chiều

| Việc                      | Vì sao không quay lại được                | Chặn bằng                               |
| ------------------------- | ----------------------------------------- | --------------------------------------- |
| DROP 12 bảng              | dữ liệu mất hẳn                           | GĐ 0 export JSON + xác nhận DB Neon     |
| Xoá `apps/frontend-forum` | git giữ lại được, nhưng dựng lại tốn công | commit riêng, dễ revert                 |
| `TRUST_ISSUER`            | URL đã ký vào chứng chỉ (đã hạ mức 🟠)    | đã đặt `https://tsudev.vn` từ đợt trước |

Migration đã áp dụng **bất biến** — mọi thay đổi là migration mới.

---

## 6. Nói thẳng: hai thứ đợt trước làm nay mất giá trị

### 6.1 Lưới an toàn E2E xuyên origin

`e2e/tests/cross-origin-session.spec.js` kiểm phiên đăng nhập đi từ main sang
forum. **Còn một app thì không còn "xuyên origin" để kiểm.** File này bị thay
bằng smoke test ở GĐ 0, không phải giữ cho có.

### 6.2 Luận điểm mạnh nhất của dev-proxy

Lý do số một khi dựng `dev-proxy` là để cookie `.tsudev.localhost` chia sẻ được
giữa hai app — điều không kiểm chứng được ở local trước đó. **Lý do đó biến mất
cùng frontend-forum.**

Proxy vẫn nên giữ, nhưng vì ba lý do còn lại, yếu hơn: subdomain `auth.` và
`cdn.` vẫn cần, một cổng vào vẫn tiện, và hình trạng dev vẫn khớp production.
Nếu sau này thấy không đáng, `DEV_PROXY=0` đã có sẵn và gỡ hẳn cũng dễ.

Hệ thống `config/topology.json` thì **tăng** giá trị: nó chính là thứ khiến việc
rút từ 11 cổng xuống 7 ở GĐ 3 là sửa một file thay vì truy lùng khắp repo.

---

## 7. Việc cố ý KHÔNG làm

- **Không** đổi tên `content-service` dù nó chỉ còn blog/docs/projects — đổi tên
  service kéo theo Dockerfile, render.yaml, topology, biến môi trường, để lấy về
  đúng một cái tên đẹp hơn.
- **Không** đụng 8 model `Trust*`. Đó là phần được giữ và làm sâu, không phải
  phần bị dọn.
- **Không** gộp `storage-service` vào `content-service`, dù nó nhỏ: nó có phụ
  thuộc S3 riêng và vòng đời phát hành riêng.
- **Không** bật `REQUIRE_ROLE_ENFORCEMENT` — vẫn vướng đúng lý do cũ (không realm
  nào khai vai trò nào), xem [refactor-network-topology.md](refactor-network-topology.md) §2B.
