# AGENTS.md - tsudev

> **ĐỌC FILE NÀY ĐẦU TIÊN trong mọi phiên làm việc mới.**

## Phần A - Quy ước chung của hệ sinh thái (KHÔNG SỬA Ở ĐÂY)

Toàn bộ quy ước chung nằm trong bản sao chỉ-đọc tại
[`.standards/AGENTS.md`](.standards/AGENTS.md). `MUST` đọc file đó trước.

Bản quy ước repo này đang dùng: xem [`.standards-version`](.standards-version).

| Cần gì                                 | Đọc file nào                            |
| -------------------------------------- | --------------------------------------- |
| Điểm vào, nguyên tắc chung             | `.standards/AGENTS.md`                  |
| Quy trình phiên, khóa file, bàn giao   | `.standards/docs/AGENT_PROTOCOL.md`     |
| Bảo mật bắt buộc                       | `.standards/docs/SECURITY_BASELINE.md`  |
| Quy tắc `.gitignore`                   | `.standards/docs/GITIGNORE_POLICY.md`   |
| Nhánh, commit, PR, phát hành           | `.standards/docs/GIT_WORKFLOW.md`       |
| Giao diện và token                     | `.standards/docs/DESIGN_SYSTEM.md`      |
| Cấu trúc thư mục                       | `.standards/docs/PROJECT_STRUCTURE.md`  |
| Chọn ngôn ngữ, framework               | `.standards/docs/LANGUAGE_SELECTION.md` |
| Hạ tầng 0 đồng                         | `.standards/docs/FREE_TIER_STACK.md`    |
| Trình soạn thảo nội dung               | `.standards/docs/RICH_TEXT_EDITOR.md`   |
| Tìm kiếm và lọc tiếng Việt             | `.standards/docs/SEARCH_AND_FILTER.md`  |
| Kiểm thử và chất lượng mã              | `.standards/docs/TESTING_QUALITY.md`    |
| Khả năng truy cập                      | `.standards/docs/ACCESSIBILITY.md`      |
| Đăng nhập, đăng ký, xác minh tài khoản | `.standards/docs/AUTH_AND_ACCOUNT.md`   |
| Bảng bản ghi, bộ chọn số bản ghi       | `.standards/docs/DATA_TABLE.md`         |
| Logo, favicon, icon ứng dụng           | `.standards/docs/BRAND_ASSETS.md`       |
| tsudev.com, ảnh đại diện, trang hồ sơ  | `.standards/docs/ECOSYSTEM_IDENTITY.md` |

`MUST NOT` sửa bất kỳ file nào trong `.standards/`. Cần đổi quy ước thì mở đề
xuất tại repo `tsudev-standards` theo `.standards/docs/SYNC.md` mục 1.

## Phần B - Riêng của repo này

> Phần này KHÔNG thuộc bộ quy ước chung. Điền theo thực tế của repo.

### B.1. Repo này là gì

- **Loại**: website
- **Stack**: TypeScript / Next.js (monorepo)
- **Mức phân loại dữ liệu cao nhất**: D2
- **Người liên hệ khi có sự cố**: chủ project tsudev

### B.2. Nợ chuẩn đang mở

Xem hàng đợi trong `logs/STATE.md`.

### B.3. Phân vai agent của repo này

## Tám agent chuyên trách của repo này

Repo này định nghĩa **8 agent chuyên trách** trong `.claude/agents/`. Mỗi agent
sở hữu một vùng đường dẫn tách rời nhau.

Quyền sở hữu đường dẫn và `logs/LOCKS.md` ở §2 giải quyết **hai** việc khác nhau,
cần cả hai:

- **Quyền sở hữu đường dẫn** trả lời "ai được sửa file này" - nó là quy tắc TĨNH,
  đọc một lần là biết, không phải hỏi ai.
- **`logs/LOCKS.md`** trả lời "ngay lúc này có ai đang sửa nó không" - đó là trạng
  thái ĐỘNG, và quyền sở hữu đường dẫn không trả lời được: hai phiên cùng đóng vai
  `frontend-web` trên hai terminal vẫn giẫm chân nhau, và một task xuyên vùng thì
  một agent buộc phải chạm file của vùng khác.

Quyền sở hữu nói ai ĐƯỢC sửa; khoá nói ai ĐANG sửa. Bỏ cái nào cũng hở.

Lưu ý phạm vi: cả hai đều không tránh được xung đột git khi nhiều terminal dùng
chung một working tree. Muốn chạy song song thật thì đọc mục [Chạy song
song](#chạy-song-song) bên dưới.

## Bảng sở hữu

| Agent           | Sở hữu đường dẫn                                                                                          | Thế mạnh                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `backend-api`   | `services/{content,storage,auth}-service/`                                                                | route Express, truy vấn Prisma, hợp đồng API |
| `trust-seal`    | `services/trust-service/`, `apps/frontend-main/pages/{trust,admin/trust}`                                 | ký Ed25519, vòng khoá, quy tắc giám sát      |
| `frontend-web`  | `apps/frontend-main/` (trừ phần của trust-seal)                                                           | trang Next, route proxy, NextAuth            |
| `design-system` | `packages/ui/`, `packages/brand/`, `tokens/`                                                              | token, component dùng chung, a11y, Storybook |
| `data-schema`   | `packages/db/`                                                                                            | schema Prisma, migration, seed               |
| `infra-deploy`  | `docker/`, `render.yaml`, `.github/`, `.husky/`, `scripts/`, `wrangler.jsonc`, `services/backend-bundle/` | build, phát hành, CI, biến môi trường        |
| `qa-test`       | `services/*/test/`, `e2e/`, `packages/ui/test/`                                                           | unit + E2E, cổng tương phản, chẩn đoán CI    |
| `docs-curator`  | `docs/` (trừ file viết HOA), mọi `README.md`, `CHANGELOG.md`                                              | giữ tài liệu đúng và gọn                     |

> **Hai nhóm file KHÔNG agent nào sở hữu vì không agent nào được sửa**: `AGENTS.md`
> phần A, và **toàn bộ cây `.standards/`** (gồm `docs/DESIGN_SYSTEM.md`,
> `docs/PROJECT_STRUCTURE.md`, `tokens/design-tokens.json`, `tokens/tokens.css`).
> Chúng đến từ bộ quy ước dùng chung; muốn đổi thì đổi ở repo trung tâm rồi đồng bộ
> xuống. `design-system` ghi token riêng của repo vào
> `tokens/extensions.tsudev-web.json` - từ 26/08/2026 (QU-STD-1) đó là file token
> DUY NHẤT mà repo này sở hữu, không còn bản sao cục bộ nào của bảng dùng chung.
>
> `logs/STATE.md` và `logs/LOCKS.md` thì ngược lại: **mọi** agent đều ghi, và đó là
> điểm duy nhất trong repo mà việc ghi đồng thời là bình thường - thêm/xoá đúng
> dòng của mình, đừng viết lại cả file.

> **`services/backend-bundle/` là vùng giáp ranh nguy hiểm.** Nó không chứa
> logic nghiệp vụ nào - chỉ mount bốn app Express của `backend-api` và
> `trust-seal` vào một tiến trình, điều phối theo **bảng tiền tố đường dẫn**.
> Thêm route mới có tiền tố chưa nằm trong bảng đó ⇒ route sống khi chạy service
> riêng, nhưng **404 ở production** (nơi chạy chế độ gộp). Sửa route thì sửa
> bảng, và test của bundle sẽ bắt phần lớn - nhưng không bắt được tiền tố hoàn
> toàn mới.

## Gọi agent thế nào

Gõ `/agents` để xem danh sách đã đăng ký. Hai cách gọi, khác nhau ở **chỗ tiêu
tốn context**:

**Cách 1 - giao cho subagent (tiết kiệm context nhất).** Trong phiên đang mở:

```
Dùng subagent backend-api để thêm endpoint GET /api/users/:username/badges
```

Subagent chạy trong **context window riêng**. Việc `grep`, đọc file, chạy test
của nó không đổ vào phiên của bạn - chỉ báo cáo cuối cùng quay về. Một task đọc
20 file mà phiên chính chỉ nhận về vài đoạn kết luận.

Không nêu tên cũng được, Claude tự khớp theo trường `description` của agent. Nêu
tên rõ khi ở vùng giáp ranh (`trust-seal` và `backend-api` đều là service
Express, nhưng luật khác hẳn nhau).

**Cách 2 - cả terminal đóng một vai.** Mở terminal mới, câu đầu tiên:

```
Đọc .claude/agents/frontend-web.md và tuân theo suốt phiên này.
Việc: sửa route proxy /api/market để trả kèm pagination.
```

Hợp khi cần **lặp nhiều vòng có trao đổi** trong cùng một vùng - subagent chạy
một mạch rồi trả kết quả, khó chen ngang giữa chừng. Đánh đổi: mọi thứ nó đọc
đều nằm trong context của bạn.

Với chuỗi xuyên vùng, giao cả chuỗi cho **một** phiên và để nó tự điều phối theo
đúng thứ tự ở giao thức 2:

```
Thêm trường `pinnedAt` cho Thread. Theo đúng thứ tự chuỗi xuyên vùng
trong AGENTS.md, gọi lần lượt data-schema → backend-api → frontend-web.
```

## Ba giao thức

**1. Không tự vượt biên.** Cần đổi file thuộc agent khác thì **mô tả thay đổi
cần thiết và báo lại**, đừng tự sửa. Ngoại lệ duy nhất: người dùng nói rõ "làm
luôn cả phần kia".

**2. Thay đổi xuyên vùng có thứ tự cố định.** Ba chuỗi hay gặp:

| Việc                          | Thứ tự bắt buộc                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Thêm trường dữ liệu           | `data-schema` (migration + generate) → `backend-api` (endpoint) → `frontend-web` (proxy + trang) |
| Thêm endpoint trình duyệt gọi | `backend-api` (route) → `frontend-web` (mở rộng proxy)                                           |
| Đổi hành vi xác thực          | `backend-api` sửa **cả bốn** `authMiddleware.js` → `qa-test` cập nhật test                       |

Đảo thứ tự thì khâu sau đỏ vì khâu trước chưa có.

**3. Một nhánh git cho một chuỗi việc.** `main` không có branch protection phía
server; chỉ có hook `.husky/pre-push` chặn. Nhiều agent cùng commit vào một nhánh
thì `git add <file cụ thể>`, **không** `git add -A` - `-A` sẽ nuốt cả thay đổi
dang dở của agent khác vào commit của bạn.

## Chạy song song

Quyền sở hữu đường dẫn giải quyết xung đột **sửa file**. Nó không giải quyết ba
thứ dùng chung khác: một working tree, một nhánh git đang checkout, và một dải
cổng local. Ba lựa chọn, xếp theo mức an toàn:

### Tuần tự - mặc định

Một terminal một lúc, xong pha này mới mở pha sau. Không có gì để hỏng. Đủ dùng
cho hầu hết việc, kể cả việc chạm nhiều vùng.

### Song song trên cùng working tree

Được, với **cả ba** điều kiện:

- Các agent thật sự không chạm file của nhau (đối chiếu bảng sở hữu trước).
- Mỗi terminal `git add <file cụ thể>`, không `git add -A`.
- **Chỉ một** terminal chạy `npm run dev:local`. Hai tiến trình cùng giành cổng
  3000/3001/4000-4003, cái thứ hai chết hoặc chiếm cổng của cái thứ nhất.

Không hợp cho việc đổi nhánh: `git checkout` ở terminal này đổi luôn file dưới
chân terminal kia.

### Git worktree - song song thật

Mỗi agent một thư mục, một nhánh, không giẫm chân gì cả:

```bash
git worktree add ../tsudev-backend  -b feat/backend-badges
git worktree add ../tsudev-frontend -b feat/frontend-market
```

Rồi mở `claude` trong từng thư mục. Đánh đổi:

- Mỗi worktree cần `npm install` riêng (và `npm run db:generate` nếu đụng
  Prisma) - `node_modules/` không dùng chung được.
- Dùng chung **một** database local (:5433). Hai worktree cùng chạy migration
  khác nhau sẽ đá nhau - chỉ một worktree được sở hữu DB tại một thời điểm, hoặc
  tách bằng `TSUDEV_PGDATA` + `TSUDEV_PGPORT` riêng.
- Vẫn phải chỉ một worktree chạy `dev:local`, trừ khi đổi cổng.
- Cuối cùng phải merge nhiều nhánh.

Dọn khi xong:

```bash
git worktree remove ../tsudev-backend
git worktree list                        # kiểm còn sót không
```

Đáng dùng khi hai chuỗi việc **dài và độc lập thật sự** (ví dụ `design-system`
làm lại token, `infra-deploy` đổi đường deploy). Việc ngắn thì chi phí
dựng worktree lớn hơn lợi ích - làm tuần tự.

## Cổng an toàn

- **Xin xác nhận trước khi `git push` hoặc deploy.** Chỉ commit/push khi người
  dùng yêu cầu.
- Trước commit: `npm run format:check` + `npm run lint`, và test của workspace
  đã sửa.
- Không bao giờ chạy `npm run db:reset` với `DATABASE_URL` trỏ ra ngoài local.
- Không ghi giá trị secret thật vào bất kỳ file nào được theo dõi bởi git.

## Kỷ luật token

Xem **§1 của phần A** - áp dụng nguyên vẹn cho mọi agent. Ba điểm riêng của repo này:

- **Không bao giờ đọc**: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`,
  `coverage/`, `package-lock.json`, file nhị phân/ảnh.
- `content-service/src/index.js` hơn 1000 dòng. `grep -n` tìm dòng, rồi
  `sed -n 'X,Yp'` đọc đúng đoạn - đọc cả file là đốt ngân sách cho 95% thứ không dùng.
- Mỗi agent đã liệt kê sẵn 1-3 file cần nạp trong định nghĩa của mình ở
  `.claude/agents/`. `docs/README.md` là mục lục cho trường hợp còn lại.
