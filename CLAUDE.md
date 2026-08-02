# CLAUDE.md — ubndxanuicamnoibo

Hệ thống điều hành công việc UBND xã Núi Cấm (monorepo backend + frontend).
Repo GitHub **canonical = `xanuicam/ubnd`** (private; repo cũ
`dieuhanhcongviecxanuicam/ubndxanuicamnoibo` đã bỏ). Làm việc trên nhánh
feature/refactor, **PR về `main`**; có pre-push hook bảo vệ `main`
(`scripts/install-hooks.sh`). KHÔNG push thẳng `main`.
**Production ĐÃ LIVE**: https://www.xanuicam.vn — kiến trúc PaaS không-VPS:
Cloudflare Pages (frontend + Pages Functions proxy `/api|/uploads|/socket.io`) →
Render (`ubnd-backend.onrender.com`, Express) → Neon (PostgreSQL) + Upstash
(Redis, `rediss://`) + Cloudflare R2 (uploads, `STORAGE_DRIVER=r2`). **Push lên
`main` → Render + Pages TỰ deploy** (không qua GitHub Actions). Dựng lại/biến môi
trường: `docs/DEPLOYMENT/PAAS_SETUP.md`. Gotcha deploy: memory `paas-deploy-gotchas`.
Local dev vẫn CHỈ localhost, khởi động thủ công (mục dưới).

> File này là NGỮ CẢNH TĨNH được Claude Code tự nạp + cache ở đầu MỌI phiên.
> TUYỆT ĐỐI không sửa file này giữa phiên (sửa = bust cache toàn bộ phía sau).
> Đọc kỹ 1 lần, tuân thủ trong suốt phiên.

## Stack
- `backend/` — Express + TypeScript (ts-node/nodemon) · PostgreSQL 18 (raw SQL qua
  tầng repository, KHÔNG ORM) · Redis · Socket.IO · JWT cookie-only · port **8080**.
- `frontend/` — React + Vite + TypeScript · Vitest · Playwright · port **3001**.
- `frontend-kiosk/` — MPA Vanilla TS/Vite (13 trang dịch vụ công), cổng
  Vite mặc định **5173**; `npm run serve` dùng **8005**. Có `CLAUDE.md` riêng đã
  gắn banner ĐÃ HỢP NHẤT — quy tắc phối hợp theo FILE NÀY, không theo file đó.
- `packages/shared-types/` — `@ubnd/shared-types`: **PHẢI build TRƯỚC** khi
  typecheck/build backend hoặc frontend (thiếu → TS2307 hàng loạt).

## Chạy local & lệnh chuẩn (CHỈ localhost, khởi động thủ công)
- **Khởi động, cổng bị chiếm, đổi cổng → `docs/development.md`** (đã kiểm chứng
  bằng chạy thật). Đọc file đó khi cần dựng môi trường; ĐỪNG tự dò lại.
- Tóm tắt: Postgres/Redis KHÔNG tự chạy (`sudo service postgresql start` +
  `redis-server --daemonize yes`) → build `packages/shared-types` → `npm run dev`
  ở `backend/` (:8080) và `frontend/` (:3001), mỗi cái một terminal.
- Port bận: `fuser -k 3001/tcp 8080/tcp` (KHÔNG fuser-kill 5432/6379 — restart
  bằng `sudo service ... restart`). Thủ phạm quen: vite cũ của clone
  `~/projects/ubndxanuicam`. Đổi cổng backend KHÔNG dùng được biến shell
  (`backend/.env` nạp với `override:true` đè ngược) — xem tài liệu trên.
- Mỗi workspace: `npm run type-check` · `npm run lint` · `npm test`.
- DB (trong `backend/`): `db:migrate` · `db:seed` · `db:bootstrap-test` ·
  `db:bootstrap-superadmins`. Test `*.real.test.ts` cần chuỗi:
  `database.sql → db:migrate → db:bootstrap-test → db:seed`.
- Đăng nhập API: GET `/api/csrf-token` → POST `/api/auth/login` header
  `X-CSRF-Token`, body dùng trường **`identifier`**. Tài khoản dev: `admin` +
  `test_a..d` (A/B/C/D) — mật khẩu trong `.env` (`SUPERADMIN_*`, `TEST_*`),
  reset bằng `db:bootstrap-superadmins` + `scripts/reset-test-passwords.ts`.

## Tài liệu tĩnh cốt lõi (đọc CHỌN LỌC theo task — KHÔNG nạp tất cả)
Mục lục: `docs/README.md`. Theo vùng task:
- Kiến trúc/DB → `docs/ARCHITECTURE/CODEBASE_ARCHITECTURE.md` · `DATA_MODEL_REFERENCE.md`
- API/envelope → `docs/API/API_PATTERNS_AND_ERRORS.md` · `API_REFERENCE.md`
- Pattern backend → `docs/BACKEND/` (controller, middleware, database)
- RBAC → `docs/ARCHITECTURE/ADRS/004_RBAC_4_TIER_HIERARCHY.md`

⚠️ `docs/` có thể ASPIRATIONAL/lỗi thời (mô tả DDD, coverage… không khớp code
thật). Coi docs là TUYÊN BỐ cần đối chiếu source, không phải chân lý.

## Quy ước code (đã kiểm chứng theo source — tuân thủ khi sửa)
- **Response**: controller chỉ `res.json(data)` — middleware `responseEnvelope`
  tự bọc `{data, message?, pagination?}`. KHÔNG tự lắp envelope; lỗi thì
  `throw AppError` qua `errorMiddleware`, không hand-roll `res.status().json()`.
- **SQL**: LUÔN parameterized (`$1,$2…`) — cấm nối chuỗi vào SQL.
- **Route bảo vệ**: `verifyToken` + `hasPermission([...])`; quyền chưa đủ thì
  kiểm tra sở hữu (IDOR) trong controller — mẫu `assertTaskAccess` (taskController).
- **Task assignee**: bảng `task_assignees` (nhiều-nhiều) — đừng tái sinh
  `tasks.assignee_id`. `/api/v1/*` là alias rewrite trong `app.ts` — không viết
  route v1 riêng.
- **Frontend**: gọi API qua `apiService` (mở rộng nó, đừng gọi axios thẳng từ
  component). Endpoint PHÂN TRANG đi qua `handleListResponse` → luôn trả
  `{data, pagination}` với `data` CHẮC CHẮN là mảng. ĐỪNG "sửa" `handleResponse`
  cho bóc thẳng `payload.data` — sẽ làm rơi pagination của DocumentsPage/
  ComputerConfigsPage. Test hợp đồng 2 nửa (`responseEnvelope.contract.test.ts`
  + round-trip trong `apiService.test.ts`) khoá lại lớp lỗi này.
  KHÔNG lưu token ở JS/localStorage — `AuthContext` hydrate qua `/auth/me`,
  axios tự refresh single-flight khi 401. UI tiếng Việt — giữ thuật ngữ và
  class dark-mode hiện có.
- **Hệ thống giao diện** (chuẩn hoá 29/07/2026, PR #23): token `.btn-*`,
  `.input-style`, `.page-title`, `.nav-link`/`.nav-link-active` khai báo ở MỘT
  nơi duy nhất là `frontend/src/index.css @layer components` —
  `tailwind.config.js` CHỈ giữ `theme`, đừng thêm plugin `addComponents` (trước
  kia trùng 2 nguồn nên nút lệch padding/màu dark giữa các trang). Tiêu đề trang
  dùng `components/layout/PageHeader.tsx`; câu khẩu hiệu (`PageMotivation`) nằm
  ở `Header` và `LoginPage` — ĐỪNG render lại trong trang con.
- **Mật khẩu**: Argon2id (`utils/passwordHash.ts`, tương thích bcrypt + tự
  rehash khi login). Secrets: KHÔNG commit `.env`; hook `pre-commit` quét secret,
  `pre-push` chặn force-push main (override chủ đích: `ALLOW_MAIN_FORCE=1`).
- **Commit**: Conventional Commits (commitlint trong CI); đang có hậu tố
  `(Pha N)` cho nỗ lực migration nội bộ — theo pattern đó nếu cùng nỗ lực.

## Module kiosk (hợp nhất 29/07/2026, PR #29)
> **Games ĐÃ GỠ 30/07/2026**: `backend/src/modules/games`, `frontend-kiosk/public/games`,
> SDK game và schema DB `games` không còn. Migration `023_drop_games_module.sql` xoá schema
> + quyền `game_manage_registry` (021/022 giữ nguyên vì migration BẤT BIẾN). Trò chơi sẽ làm
> lại thành **webapp độc lập**, tích hợp bằng link — ĐỪNG thêm `/games/` trở lại vào repo này.
- Code MỚI đặt ở `backend/src/modules/kiosk` — auth và điều hành công việc
  GIỮ NGUYÊN ở `controllers/`, `routes/`, `repositories/`. Đọc `src/modules/README.md`.
- Schema DB riêng `kiosk.*`, **không nằm trong search_path** ⇒ SQL phải gọi tên đầy đủ.
  Soft-delete ở đây là cột `deleted_at` ĐƠN GIẢN — KHÔNG có cơ chế VIEW `*_all`, đừng áp
  `resolveBaseTable()` cho chúng.
- **Hợp đồng response**: controller kiosk trả ĐÚNG body cũ (mảng chuỗi, `{data}`,
  camelCase, số dạng CHUỖI); envelope hệ thống bọc ngoài; `frontend-kiosk/public/js/api.ts`
  bóc ra. Đổi hình dạng ở controller = 13 trang MPA hiển thị trống mà không báo lỗi.
- `call_status` đảo chiều: DB `serving` ↔ API `calling` (`kioskMapper.ts`).
- Cột cá nhân (họ tên, CCCD, SĐT, địa chỉ…) **mã hoá** bằng `utils/encryption.ts` ⇒
  `LIKE` trên chúng luôn rỗng. Tìm kiếm làm ở TẦNG ỨNG DỤNG sau khi giải mã (rẻ vì
  mọi truy vấn đã lọc theo đúng một ngày).
- Số quầy = `display_order` trong danh mục sắp xếp theo **thứ tự byte** (SQLite BINARY),
  KHÔNG phải `localeCompare('vi')`. `counter_number` trên phiếu cũ là giá trị LỊCH SỬ.
- Nạp dữ liệu kiosk: `npm run kiosk:load -- --sqlite <file>` (cần `python3`). Chạy TAY,
  không qua git/CI vì chứa dữ liệu công dân thật.

## Gotcha cứng (đọc trước khi sửa vùng liên quan)
- **`index.css`**: comment CSS chứa chuỗi `*/` (vd viết tắt `.btn-*` rồi `/`) sẽ
  ĐÓNG SỚM block comment → PostCSS `Unknown word`. `type-check` và `vitest`
  KHÔNG bắt được, chỉ `npm run build` bắt ⇒ sửa `index.css` thì phải chạy build.
- **Soft-delete VIEW**: 11 entity lõi (`users`, `tasks`, `roles`, `departments`…)
  là VIEW trên bảng `*_all` (migration 014). DDL trên tên entity lỗi 42809 →
  `resolveBaseTable()` (`backend/src/utils/baseTable.ts`); `GROUP BY` cột view
  lỗi 42803 (view không có PK); FK phải trỏ `*_all`; UPDATE trực tiếp bằng SQL
  (vd reset mật khẩu) → ghi bảng `*_all`.
- **`backend/.env` ĐÈ `root/.env`** (`src/config/env.ts` nạp backend/.env với
  override ngoài test): biến trùng tên phải đồng bộ CẢ HAI file, nếu không
  script/app âm thầm dùng giá trị cũ ở backend/.env.
- **RBAC A+/A/B/C/D + scope**: `userScope` chỉ áp ở 3/27 repository; các domain
  khác gate bằng permission toàn org. Mở rộng scoping = quyết định sản phẩm,
  đừng tự ý.
- **CI (cập nhật 31/07/2026)**: 6 check đều XANH trên PR #38 (`label`, `Test Suite`,
  `Quality`, `Build Application`, `commitlint`, `Cloudflare Pages`). `label` từng đỏ
  ở mọi PR (403 "Resource not accessible by integration") — ĐÃ VÁ, nên **`label` đỏ
  từ nay là lỗi thật, phải điều tra**. Gốc rễ: repo đặt
  `default_workflow_permissions: read` ⇒ workflow nào cần GHI lên PR/issue phải TỰ
  khai khối `permissions:`, đừng trông vào mặc định. Muốn biết thiếu quyền gì, đọc
  header `x-accepted-github-permissions` trong log — nó nói thẳng.
  ⚠️ Trong `.github/workflows/*.yml`, khối `script:` được nội suy TRƯỚC khi chạy,
  kể cả phần trong chú thích JS. Viết literal dấu nội suy `${`+`{ }}` vào comment =
  GitHub từ chối CẢ FILE: run hiện dưới sự kiện `push`, chết trong 0 giây, không có
  job nào, và check BIẾN MẤT khỏi PR thay vì đỏ. `yaml.safe_load` vẫn báo hợp lệ vì
  đây là lỗi tầng biểu thức, không phải YAML. Cùng họ bẫy `*/` của `index.css`.
  ⚠️ `Test Suite` chạy `npm run test:coverage`, có **coverageThreshold global 70%**
  (`jest.config.ts`). Jest báo "1095 passed" mà job vẫn ĐỎ = rớt ngưỡng coverage,
  không phải test hỏng. Thêm code thì phải thêm test, đừng hạ ngưỡng.
- **Migration là BẤT BIẾN**: sửa file đã áp dụng (kể cả một dòng comment) làm lệch
  checksum → `db:migrate` dừng → Render `db:migrate && npm start` KHÔNG BOOT. Hook
  `pre-commit` chặn sẵn. Lỡ rồi: `npm run db:migrate:repair` (xem trước; `-- --yes`
  mới ghi).
- Auth (đợt hardening 07/2026): access+refresh cookie-only, rotation + reuse-detect, idle 30
  phút / tối đa 5 phiên, lockout luỹ tiến sau 5 lần sai (login thành công reset);
  Turnstile CAPTCHA mặc định TẮT tới khi có key.

## Nhiều agent song song (điều phối nhẹ, tiết kiệm token)
Mỗi terminal = 1 agent. TRẠNG THÁI SỐNG ở `AGENTS_BOARD.md` (xem qua `./agents.sh`);
quyết định/gotcha ở `AGENTS_LOG.md` (chỉ `grep`, ĐỪNG đọc cả file).
- **Claim TRƯỚC khi sửa**: `./agents.sh lock "agent-N · file · việc"`. File có LOCK
  của agent khác → TUYỆT ĐỐI KHÔNG đụng.
- Xong: `./agents.sh unlock <file>`. Ghi quyết định: `./agents.sh log "…"`;
  cảnh báo còn hiệu lực: `./agents.sh note "…"`.
- Board > 30 dòng → `./agents.sh clean` + BÁO người dùng.
- KHÔNG `git add -A` khi có agent khác đang sửa — chỉ `git add <file cụ thể>`.

## Chiến lược phiên — tối ưu token/chi phí (BẮT BUỘC)

### 1. Context window
- Đọc CÓ MỤC TIÊU: đúng file/đoạn cần cho task, KHÔNG nạp cả project — ngữ cảnh
  càng dài càng "loãng" thông tin + chi phí tăng phi mã. Grep/tìm trước, đọc sau.
- TUYỆT ĐỐI không đọc: `node_modules/`, `.git/`, `build/`, `dist/`, `coverage/`,
  `uploads/`, `logs/`, file media/nhị phân (`.gitignore` đã chặn — tôn trọng nó).
- Dữ liệu TĨNH xếp lên ĐẦU phiên (file này + tài liệu cốt lõi đúng vùng task) và
  giữ NGUYÊN trong phiên — sửa file "đầu dòng" giữa chừng là vô hiệu (bust) toàn
  bộ cache phía sau. Cần sửa CLAUDE.md/tài liệu kiến trúc → dồn về CUỐI phiên.

### 2. Chế độ chạy — CHỈ Standard
- Dùng **Standard cho MỌI tác vụ**. KHÔNG gợi ý, KHÔNG bật `/fast`: Fast Mode
  đốt token nhanh hơn nhiều mà không giúp gì cho loại việc ở repo này (sửa code,
  chạy test, build, deploy). Người dùng tự bật nếu cần — đừng chủ động đề xuất.
- Thay vào đó, tiết kiệm bằng CÁCH LÀM VIỆC:
  - Gộp các lệnh độc lập vào MỘT lượt (nhiều tool call song song) thay vì hỏi–đáp
    từng bước; mỗi lượt qua lại là một lần trả tiền cho toàn bộ ngữ cảnh.
  - `grep`/`rg` để định vị TRƯỚC, chỉ `Read` đúng đoạn cần (dùng offset/limit);
    đừng đọc lại file vừa sửa để "kiểm tra" — tool đã báo lỗi nếu sửa hỏng.
  - Sửa hàng loạt theo khuôn mẫu lặp lại → viết script biến đổi + chạy thử
    (dry-run) rồi mới `--apply`, thay vì sửa tay từng file.
  - Chạy cổng kiểm tra MỘT lần ở cuối cụm thay đổi, không chạy sau mỗi file.
  - Đừng tóm tắt lại việc vừa làm ở mỗi lượt; chỉ báo cáo khi xong một pha.

### 3. Cổng an toàn git/deploy
- **Xin xác nhận TRƯỚC khi `git push` / deploy** (chống vòng lặp lỗi đốt token
  vô ích). CHỈ commit/push khi người dùng yêu cầu. Trước commit: build
  `@ubnd/shared-types` → `npm run type-check` + `npm run lint` sạch ở workspace
  đã sửa.

### 4. Session refresh (tóm tắt & đóng phiên)
- Sau khi sửa + test + commit THÀNH CÔNG: chạy `./agents.sh cleanup` (quét
  `_tmp_*`, `*.log`, `*.zip/.tar`, `__pycache__`, `.venv` — mặc định xem trước,
  `--force` để xóa thật) → xác nhận thư mục sạch → `./agents.sh unlock` các file
  đã khóa → GỢI Ý người dùng ĐÓNG terminal, mở phiên mới cho task kế tiếp.
- TUYỆT ĐỐI không kéo dài một hội thoại từ ngày này qua ngày khác — bối cảnh cũ
  là chi phí chết. Tri thức cần giữ lại → ghi `AGENTS_LOG.md` / `./agents.sh note`.
