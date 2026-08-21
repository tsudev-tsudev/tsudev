# STATE.md — Trạng thái project (agent đọc đầu phiên, cập nhật cuối phiên)

> **Phiên 15 bắt đầu ở đây**: đọc
> [`logs/handover/20260821-04`](handover/20260821-04_ket-phien-14.md) — phiếu vào
> cửa mới nhất. Hệ AUTHOR/OWNER + trang quản lý tài khoản **đã PHÁT HÀNH prod**
> (backend Live). Việc còn lại: nghiệm thu RBAC bằng MẮT NGƯỜI, trình soạn bài
> cho AUTHOR (follow-up), và các mục chờ nhịp/quyết định cũ.

## Hàng đợi task (làm từ trên xuống)

- [x] **🔴 BƯỚC 3: bấm nút "Hồi sinh việc đã dừng"** — ✅ chủ dự án đã bấm
      (21/08). Nghiệm thu `npm run newsroom:check`: AgentRun **220 → 224** (+4 lượt).
      Toà soạn chạy thật.

- [x] **🔴 GitHub Actions không chạy được — ĐÃ KHẮC PHỤC 21/08 (phiên 13).**
      Nguyên nhân: repo Private + GitHub Free 2.000 phút/tháng, tài khoản vướng
      thanh toán ⇒ mọi job fail 4s (không chạy dòng nào). **Cách sửa: chuyển repo
      `tsudev` sang PUBLIC** (Actions miễn phí không giới hạn phút cho repo công
      khai). Nghiệm thu: chạy lại run `32473196835` → 5/5 job **success** (Lint ·
      E2E smoke · Build frontends · Migrate & test · WASM). Trước khi Public đã
      quét secret cả tree lẫn 164 commit history: sạch (chi tiết phiếu phiên 13).

- [x] **🔴 GỘP PR #37** — ✅ chủ dự án đã MERGED (`a8cfde9`, 20/08). Render tự dựng lại backend.
- [x] **🟠 GỘP PR #38** — ✅ chủ dự án đã MERGED (`a8248a4`, 21/08). Local về
      `main`, nhánh đã xóa.
- [x] **🟠 Gửi hai gói đẩy ngược lên repo quy ước trung tâm** — ✅ 21/08 (phiên 13).
      Repo `tsudev-tsudev/tsudev-standards` đã tạo + bootstrap (10 file, `91038af`);
      hai gói mở thành Issue: [#1](https://github.com/tsudev-tsudev/tsudev-standards/issues/1)
      (token WCAG) · [#2](https://github.com/tsudev-tsudev/tsudev-standards/issues/2)
      (cấu trúc monorepo). Chờ QUYẾT ĐỊNH ở repo trung tâm.
- [x] **🟠 Xoay `NEWSROOM_TICK_TOKEN`** — ✅ HOÀN THÀNH 21/08 (phiên 12). Token cũ
      `mB50…` (lộ scrollback phiên 9) đã vô hiệu. Đổi đồng thời cả ba chỗ (Render
      `tsudev-backend`, Worker `tsudev-newsroom-cron`, backup). Nghiệm thu: curl
      Render 202, `newsroom:check` AgentRun 237 → 240. **Bài học**: base64 có `=`/`-`/`_`
      hay bị form web cắt khi dán → dùng `openssl rand -hex 32` (không ký tự đặc biệt).
- [x] **🟠 PHÁT HÀNH hệ AUTHOR/OWNER + đổi tên nhân sự** — ✅ HOÀN THÀNH 21/08
      (phiên 14), chủ dự án chạy. Migration `20260821200000_add_author_owner_roles`
      áp trên Neon (enum có AUTHOR/OWNER); `seed-newsroom.js` prod (4 agent đổi
      tên); SQL nâng `tsudev`→OWNER; frontend deploy Cloudflare
      (`/api/auth/providers` chỉ credentials+passkey); backend Render **Live**.
      **Hotfix kèm theo (PR #42, `e759dce`)**: nâng OWNER làm lộ regression —
      `auth-service requireAdmin` so `role === 'ADMIN'` bằng đúng nên OWNER bị 403
      ở mã mời Con dấu. Đã đổi sang `hasAtLeastRole`. CÒN LẠI: nghiệm thu RBAC
      bằng mắt (dưới đây).
- [ ] **🟡 Nghiệm thu RBAC bằng MẮT NGƯỜI trên prod** — tsudev (OWNER) tạo tài
      khoản thử từng vai trò qua `/admin/accounts` (mật khẩu tự đặt, xoá sau),
      đối chiếu ma trận: OWNER=mọi thứ · ADMIN=admin nhưng KHÔNG accounts ·
      MODERATOR/AUTHOR/VIP=Con dấu, không admin · MEMBER=không gì. **KHÔNG** bơm
      tài khoản dev (alice/bob, mật khẩu `tsudev-dev-2026!`) vào prod. Kiểm tsudev
      cấp/thu hồi mã mời Con dấu chạy (hết 403 sau khi `e759dce` Live).
- [x] **⚪ Trình soạn/đăng bài cho AUTHOR** — ✅ CODE-COMPLETE 21/08 (phiên 15).
      content-service có `/api/author/posts` (list·create·get·patch·delete) gác
      `requireAuthor` (đọc DB, fail closed), SCOPE cứng `authorId === me`; proxy
      `/api/content/author/*` + prefix `/api/author` trong backend-bundle; trang
      `/author` (editor list+form). Test `author.test.ts` 11 + routing +1. Còn:
      **(a)** link điều hướng tới `/author` ở header — vùng design-system
      (`packages/ui/.../SiteHeader.tsx`), CHƯA làm (handoff); **(b)** phát hành
      prod (deploy); **(c)** e2e tuỳ chọn.
- [ ] **🟡 Rà giao diện bằng MẮT NGƯỜI** — phiên 7 chỉ rà bằng máy (đo tương phản + cỡ chữ). Máy không đọc được "cái này trông cân đối chưa". Nay đã có công
      cụ: `npm --workspace packages/ui run storybook`, nút **Giao diện** đổi ba
      chế độ ngay trên thanh công cụ.

## Đang thực hiện

| Task      | Agent | Bắt đầu |
| --------- | ----- | ------- |
| _(trống)_ |       |         |

## Đã hoàn thành (mới nhất trên cùng)

- 21/08/2026 — **Editor AUTHOR (đăng/sửa bài của chính mình)** (phiên 15). Chuỗi
  `backend-api`→`frontend-web` (kèm chạm `backend-bundle`/test). content-service:
  5 route `/api/author/posts` gác `requireAuthor` (`hasAtLeastRole(role,'AUTHOR')`,
  đọc DB fail closed), MỌI truy vấn kẹp `authorId === me.id` → AUTHOR/ADMIN/OWNER
  đi đường này chỉ đụng bài của chính mình; bài của người khác trả **404** (không
  lộ tồn tại). `authorId`/`authoredByAgentId` do PHIÊN quyết định, không đọc từ
  body (test canh cướp tác giả). slugify tiếng Việt (bỏ dấu, đ→d). Xoá MỀM. Prefix
  mới `/api/author` thêm vào bảng backend-bundle + proxy `ALLOWED` + routing test
  (bằng chứng thân-401 tới đúng content). Frontend trang `/author` (list+form,
  gating bám phản hồi 403 của backend, noindex). Nghiệm thu: typecheck·lint·format·
  topology·tokens sạch; content-service **37/37** (chạy 2 lần, rerun-safe);
  backend-bundle **15/15**. CHƯA phát hành; link header là handoff design-system.
- 21/08/2026 — **PHÁT HÀNH prod hệ AUTHOR/OWNER + hotfix OWNER≥ADMIN** (phiên 14).
  Chủ dự án chạy chuỗi prod: migrate Neon (enum AUTHOR/OWNER) · seed-newsroom
  (đổi tên 4 agent) · SQL nâng tsudev→OWNER · deploy Cloudflare · backend Render
  Live. **Hotfix PR #42 (`e759dce`)**: `auth-service requireAdmin` dùng
  `hasAtLeastRole` thay cho so `=== 'ADMIN'` bằng đúng (OWNER trên ADMIN từng bị
  403 ở mã mời Con dấu). Kèm 2 chỗ trust UI `alreadyIn` → `hasAtLeastRole(role,'VIP')`
  và test regression. Cả #40/#41/#42 CI xanh, main `e759dce` xanh.
- 21/08/2026 — **Hệ vai trò AUTHOR/OWNER + trang quản lý tài khoản** (phiên 14).
  Chuỗi xuyên vùng trọn gói: (data) `packages/types` thang role thêm AUTHOR (trên
  VIP) và OWNER (trần), `enum Role` + migration `20260821200000_add_author_owner_roles`
  (áp sạch trên PG, `ALTER TYPE ADD VALUE`), seed nâng `tsudev`→OWNER; (auth-service)
  6 endpoint `/api/identity/useradmin/*` gác `requireOwner` (đọc DB, fail closed):
  list·create·update·role·revoke·delete — **OWNER không bao giờ cấp được qua dữ
  liệu** (ASSIGNABLE_ROLES bỏ OWNER/GUEST), không tự-hạ/tự-xoá, không đụng OWNER
  khác, passwordHash không lộ; (frontend) trang `/admin/accounts` OWNER-gated +
  proxy `useradmin/*` + thẻ owner-only ở `/admin`. Test mới `useradmin.test.ts`
  **12/12** canh bất biến leo thang. Nghiệm thu: typecheck·lint·format sạch;
  auth-service **73/73**; bundle 14/14; migration áp + seed verify trên DB thật
  (4 agent đổi tên, tsudev=OWNER). **CHƯA phát hành** (xem ops bên dưới).
- 21/08/2026 — **Đổi tên 4 nhân sự Toà soạn** (phiên 14): scout-01 "Thợ săn tin",
  writer-01 "Biên tập viên", editor-01 "Tổng biên tập", seo-01 "Chuyên viên
  Marketing" (chỉ `displayName`; title/prompt giữ nguyên theo quyết định chủ dự
  án). Nguồn: `seed-newsroom.js`, lan sang DB qua upsert.update — đã verify local.
- 21/08/2026 — **Đính chính `CLAUDE.md` visibility** (phiên 14). Dòng bản đồ
  `private` → `Public (từ 21/08/2026)`; và dòng branch-protection: lý do cũ
  "(repo private)" nay sai — Public thì GitHub Free CHO phép branch protection,
  chỉ là chưa bật; ghi rõ đó là năng lực chưa dùng, `.husky/pre-push` vẫn là lớp
  chắn duy nhất. Đóng mục còn lại của phiếu 13 §2.
- 21/08/2026 — **Repo chuyển PUBLIC → CI hồi sinh** (phiên 13). Chủ dự án chạy
  `gh repo edit … --visibility public`; nghiệm thu `visibility=PUBLIC`. Chạy lại
  run `32473196835` → **5/5 job xanh** (billing-block đã thông vì repo công khai
  được Actions miễn phí không giới hạn). Trước khi Public: quét secret tree +
  164 commit history = sạch (chỉ mẫu/placeholder/fixture; `mB50…` là tiền tố
  token đã xoay). **Đã tạo repo quy ước trung tâm** `tsudev-tsudev/tsudev-standards`
  (Private — không chạy workflow nên 0 phút Actions, không chạm giới hạn).
  Bootstrap 10 file (`91038af`): AGENTS.md Phần A · DESIGN_SYSTEM · PROJECT_STRUCTURE
  · template HANDOVER · tokens.css + khối token dùng chung · hai proposal → Issue #1/#2.
- 21/08/2026 — **Gộp PR #38 + hồi sinh toà soạn** (phiên 12). Chủ dự án MERGED #38
  (`a8248a4`); local về `main`, xóa nhánh. Chủ dự án bấm "Hồi sinh việc đã dừng";
  `newsroom:check` xác nhận AgentRun **220 → 224** (+4). Soạn quy trình xoay
  `NEWSROOM_TICK_TOKEN` cho chủ dự án. Phiếu: `logs/handover/20260821-02`.
- 21/08/2026 — **Mở PR #38** cho `chore/storybook-chay-duoc` (phiên 11). #37 đã
  được chủ dự án gộp vào `main` (`a8cfde9`) nên diff của #38 sạch, chỉ còn
  Storybook + gỡ `@tsudev/utils` + hai gói đẩy ngược + docs. Cổng chung xanh
  (lint · typecheck · topology · tokens); MERGEABLE. Chờ chủ dự án bấm Merge.
- 20/08/2026 — **Storybook chạy được lần đầu**: hàng đợi ghi "thiếu
  devDependencies, `npm i` là xong" — đó mới là tầng thứ nhất trong **bốn** tầng
  hỏng, ba tầng còn lại không làm lệnh nào thất bại (glob extglob dùng dấu phẩy ⇒
  khớp 0/9 file · `@tsudev/types` CommonJS qua `/@fs` ⇒ mọi khung story rỗng ·
  `next-auth` đòi `process` + `SessionProvider`). Nghiệm thu **36/36 lượt**
  (12 story × 3 chế độ) vẽ ra nội dung, 0 lỗi console, 0 ảnh 404. Đóng luôn món
  nợ ghim `react@18` ở root.
- 20/08/2026 — **Gỡ `@tsudev/utils`** (một hàm, không nơi nào dùng) và dòng
  `references` của nó trong `tsconfig.json` gốc.
- 20/08/2026 — **Hai gói đẩy ngược lên repo quy ước trung tâm đã soạn xong**:
  `docs/token-upstream-proposal.md` · `docs/structure-upstream-proposal.md`.
  Điểm lệch cấu trúc ghi vào `docs/architecture.md` thay vì để im lặng.
- 20/08/2026 — **Sổ Neuron đếm ĐỦ cả khi lượt chạy hỏng**: chi phí nay ghi tại
  ranh giới nhà cung cấp vào sổ theo ngữ cảnh (`withCostLedger`, AsyncLocalStorage),
  `withRun()` đọc sổ ở **cả hai** nhánh try/catch. Đường trả chi phí cũ
  (`AgentCost` trong `agents.ts`) đã bỏ hẳn — một sổ, không phải hai.
  Canh bằng `services/newsroom-service/test/costLedger.test.ts` (7 test, đã kiểm
  chứng đỏ trên mã cũ). Newsroom 42 → **49 xanh**; bundle 14; format/lint/typecheck sạch.
- 20/08/2026 — **PHÁT HÀNH phiên 9**: PR #36 gộp vào `main` (`12987d0`), Render dựng
  lại backend, frontend lên Cloudflare Workers (version `d59853a7`). Nghiệm thu
  **đếm hành vi**: `/api/auth/providers` chỉ `credentials`+`passkey` · `www` → 308
  apex · `newsroom:check` tick 202, `AgentRun` 160→165. Trước khi gộp: chạy tay đủ
  **năm** hạng mục CI gồm cả cổng WASM (9 test Rust, `.wasm` khớp mã nguồn) và e2e
  20/20. Phiếu: `logs/handover/20260820-05`.
- 20/08/2026 — **Kết phiên 8**. Phiếu: `logs/handover/20260820-04`. Ba đợt việc
  đã commit và push (PR #36, 5 commit): chuẩn hoá URL · van hạn mức LLM · e2e
  lặp lại được. Chặn ở khâu gộp + GitHub Actions không chạy được vì tài khoản.
- 20/08/2026 — **Bộ e2e lặp lại được**: seed dev nay đặt lại `User.role` (trước
  chỉ có ở nhánh `create` của upsert) và dọn tài khoản `e2e-*`. Chứng minh bằng
  vòng seed → 20/20 → seed → chạy lại invite vẫn xanh.
- 20/08/2026 — **Nghiệm thu phiên 8**: e2e **20/20** (tuần tự); test service
  213 xanh (content 26 · storage 13 · trust 57 · auth 61 · newsroom 42 ·
  bundle 14); `packages/ui` 199; frontend-main 29; `next build` sạch.
  PR #36 đã mở, **chưa gộp**.
- 20/08/2026 — **Van hạn mức LLM của Toà soạn**: cạn Neuron nay làm hệ **hoãn**
  chứ không **hỏng**. Ba khiếm khuyết chồng nhau đã sửa (van đọc sổ ước lượng của
  ta thay vì lời nhà cung cấp · không có trí nhớ giữa các nhịp · cạn hạn mức ăn
  hết 3 lần thử rồi giết bản nháp vĩnh viễn). Thêm nút hồi sinh cho bản nháp đã
  chết. Phiếu: `logs/handover/20260820-03`.
- 20/08/2026 — **Chuẩn hoá URL**: `www` → 308 về apex; `*.workers.dev` noindex;
  trang chủ thôi in cổng nội bộ; `topology:check` có khẳng định D chặn hồi quy;
  `docs/url-convention.md` là nguồn duy nhất trả lời "địa chỉ nào chính tắc".
- 20/08/2026 — **Nghiệm thu đợt giao diện**: rà máy 12 trang × 3 chế độ (36 ảnh,
  đã đăng nhập ADMIN) → **0 vấn đề tương phản**; e2e **20/20 xanh**; bản dựng
  production sạch, không còn cỡ chữ hay mã màu nào ngoài token. Bốn lỗi thật tìm
  thêm được và đã sửa: thang chữ mặc định Tailwind lọt qua 41 chỗ, `site.webmanifest`
  trôi lệch màu nền, `::placeholder` màu cắm cứng, hai chỗ chữ 11px.
- 20/08/2026 — **Tái cấu trúc toàn diện giao diện theo quy ước v1.0.0**.
  Phiếu bàn giao: `logs/handover/20260820-01_tai-cau-truc-giao-dien.md`
- 20/08/2026 — Cài bộ quy ước v1.0.0 vào repo: `logs/`, `docs/DESIGN_SYSTEM.md`,
  `docs/PROJECT_STRUCTURE.md`, `docs/templates/HANDOVER.md`, `tokens/`, `CHANGELOG.md`
- 19/08/2026 — Khởi tạo bộ quy ước v1.0.0

## Quyết định quan trọng

- 21/08/2026 — **Thêm bậc vai trò TRÊN một bậc cũ phải rà MỌI cổng của bậc cũ.**
  Nâng tsudev ADMIN→OWNER tưởng thuần cộng, nhưng cổng nào kiểm `role === 'ADMIN'`
  BẰNG ĐÚNG (thay vì `hasAtLeastRole`) thì bậc mới cao hơn lại TRƯỢT. Ở đây đúng
  một chỗ (`auth-service requireAdmin`) khoá tsudev khỏi mã mời Con dấu, im lặng
  (trang vẫn dựng, chỉ 403 khi gọi). Triệu chứng trông như "mới nâng quyền mà lại
  mất quyền". Quy tắc: bậc trần chỉ an toàn khi mọi cổng đọc quyền theo THỨ BẬC.
- 21/08/2026 — **Đừng đẩy fix vào một PR đang có thể bị gộp đồng thời.** #40 bị
  gộp ở head `449b2f9` (bản còn lỗi) đúng lúc đẩy tiếp fix — GitHub trễ đồng bộ
  head PR nên fix `6fe6304`/`9707b3b` không vào PR, main đỏ. Phải mở #41 vá riêng.
  Quy tắc: sửa xong hẵng mở PR, hoặc chờ CI xanh hẳn rồi mới gộp; trước khi gộp,
  đối chiếu `git ls-remote` (branch) == `pulls/N .head.sha` (PR).
- 21/08/2026 — **"Tài khoản đăng bài" ≠ có bề mặt đăng bài.** Role AUTHOR ship
  được ngay (quản lý + phân quyền), nhưng content-service chưa có route ghi Post
  cho người, nên AUTHOR chưa đăng được gì — đây là follow-up, không phải lỗi RBAC.
  Ghi rõ để phiên sau không chẩn nhầm.
- 20/08/2026 — **"Lệnh chạy xong" không chứng minh công cụ chạy được.** Storybook
  lên server, `index.json` liệt kê đủ 12 story, `storybook build` xanh — mà cả 36
  lượt mở story đều RỖNG. Cùng họ với "mã 200 không chứng minh trang có nội dung":
  phép nghiệm thu phải đếm THỨ CÔNG CỤ SINH RA, không đếm việc nó khởi động.
- 20/08/2026 — **Điểm lệch bộ quy ước chung phải được GHI, kèm gói đẩy ngược.**
  File quy ước bất khả xâm phạm ⇒ repo con không sửa được ⇒ lệch là chuyện sẽ xảy
  ra. Lệch mà im lặng thì phiên sau tưởng là quên; lệch mà chỉ ghi chú thì lỗi
  gốc sống mãi ở trung tâm. Hai gói `docs/*-upstream-proposal.md` là đường ra.
- 20/08/2026 — **Sổ đo phải ghi ở NƠI PHÁT SINH, không ở đường `return`.** Chỗ
  kết quả về đích và chỗ chi phí phát sinh chỉ trùng nhau khi không có gì hỏng;
  agent hay hỏng NGAY SAU lượt gọi mô hình, nên sổ cũ đếm thiếu đúng ở nhánh hay
  xảy ra nhất. Đầy đủ: `HANDOFF.md` §0.7 (mục thứ 16).
- 20/08/2026 — **Điều kiện hiện một nút phải là điều kiện nút đó CHỮA, không phải
  triệu chứng đi kèm.** Nút "Hồi sinh việc đã dừng" từng lồng trong thẻ "hôm nay
  cạn hạn mức", nên nó biến mất đúng lúc cần: hạn mức reset xong mới là lúc đi dọn
  xác. Trang vẫn dựng, vẫn 200, chỉ thiếu một nút — không gì đỏ lên. Canh bằng test
  quét nguồn vì trang này không có test kết xuất.
- 20/08/2026 — **Phép đo "route mới đã có chưa" chỉ có giá trị khi đường đó nằm
  NGOÀI mọi cổng chặn**, hoặc khi đo kèm một đường đối chứng chắc chắn không tồn
  tại. Middleware xác thực chạy trước bảng định tuyến, nên 401 che mất 404 và hai
  bản dựng trả cùng một mã. Đây là phép đo sai theo kiểu trông y hệt **thành
  công** — chiều nguy hơn, vì không ai đi điều tra một kết quả tốt. Đầy đủ:
  `HANDOFF.md` §0.7 (mục thứ 15).
- 20/08/2026 — **"Render đã Live chưa" phải hỏi dashboard Render**, không suy ra
  từ mã HTTP: backend không có bề mặt công khai nào phân biệt hai bản dựng
  (`/health` không mang commit SHA).
- 20/08/2026 — **Ước lượng chi phí phía mình là van PHỤ; lời của nhà cung cấp là
  sổ CHÍNH.** Khi API báo cạn hạn mức thì ghi lại và tin tới mốc reset, ghi vào DB
  chứ không vào biến nhớ. Lý do đầy đủ: `HANDOFF.md` §0.7.
- 20/08/2026 — **Mọi hàng đợi có retry phải phân biệt HOÃN với THẤT BẠI.** Hoãn
  thì hoàn lại lần thử đã tính. Trộn hai thứ này là cách một ngày cạn hạn mức
  giết sạch hàng đợi.
- 20/08/2026 — **Giữ cổng dev 8080, KHÔNG hạ xuống 80.** Cổng < 1024 cần root;
  đổi lấy URL đẹp bằng việc chạy dev dưới quyền root là đánh đổi tồi.
  `docs/url-convention.md` §1.
- 20/08/2026 — **Mặc định vẫn là chế độ Sáng**, KHÔNG bám `prefers-color-scheme`.
  `DESIGN_SYSTEM.md` §1 và `CLAUDE.md` mâu thuẫn nhau ở điểm này; hoà giải bằng
  cách thêm lựa chọn thứ tư "Theo hệ thống" để người dùng tự bật. Lý do giữ mặc
  định Sáng: hai người mở cùng một link phải thấy cùng một trang.
- 20/08/2026 — **`fontSize` của Tailwind là GHI ĐÈ, không phải `extend`.** Với
  `extend`, thang mặc định của Tailwind sống song song với thang token và 41 chỗ
  trong app đã dùng nó mà không ai biết. Ghi đè thì class ngoài bảng không sinh ra
  CSS và lộ ra ngay khi nhìn. Ba bậc `display-*` cho hero nằm ở
  `extensions.tsudev-web.typography` vì thang §4 dừng ở 30px.
- 20/08/2026 — `tokens/design-tokens.json` là nguồn chân lý;
  `packages/ui/src/tokens.css` là bản SINH RA (`npm run tokens:sync`, CI canh bằng
  `npm run tokens:check`). `tokens/tokens.css` là bản chuẩn hệ sinh thái, script
  KHÔNG ghi đè - chỉ đối chiếu và báo lệch.
- 20/08/2026 — Đổi tên toàn bộ token sang tên quy ước (`--surface`→`--bg-base`,
  `--ink`→`--text-primary`, `--error`→`--danger`…), thay vì dựng lớp bí danh.
  Hai bộ tên song song chính là thứ quy ước sinh ra để dẹp.
- 20/08/2026 — Token riêng của repo (6 màu icon theo nhóm hành động, `accent`,
  cặp `-ink`/`-tint` cho badge, `border-control`, ba bậc `display-*`) sống ở khối
  `extensions.tsudev-web`, tách bạch khỏi khối `color` bất khả xâm phạm.
- 19/08/2026 — Dùng Inter làm font chuẩn; token là nguồn chân lý duy nhất; region
  ưu tiên Singapore → Nhật Bản.

## Phiếu bàn giao

| Mã                                                                  | Chủ đề                                                  | Trạng thái |
| ------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| [20260821-04](handover/20260821-04_ket-phien-14.md)                 | Kết phiên 14 — AUTHOR/OWNER, trang tài khoản, phát hành | **MỞ**     |
| [20260821-03](handover/20260821-03_ket-phien-13.md)                 | Kết phiên 13 — repo Public, CI, repo quy ước            | HOÀN THÀNH |
| [20260821-02](handover/20260821-02_ket-phien-12.md)                 | Kết phiên 12 — gộp #38, hồi sinh toà soạn               | HOÀN THÀNH |
| [20260821-01](handover/20260821-01_ket-phien-11.md)                 | Kết phiên 11 — gộp #37, mở PR #38                       | HOÀN THÀNH |
| [20260820-06](handover/20260820-06_ket-phien-10.md)                 | Kết phiên 10 — sổ Neuron, Storybook, dọn nợ             | HOÀN THÀNH |
| [20260820-05](handover/20260820-05_phat-hanh-phien-9.md)            | Phát hành PR #36 lên production                         | HOÀN THÀNH |
| [20260820-04](handover/20260820-04_ket-phien-8.md)                  | Kết phiên 8 — chuỗi phát hành                           | HOÀN THÀNH |
| [20260820-03](handover/20260820-03_chuan-hoa-url-va-van-han-muc.md) | Chuẩn hoá URL + van hạn mức LLM                         | HOÀN THÀNH |
| [20260820-02](handover/20260820-02_viec-con-lai-sau-giao-dien.md)   | Việc còn lại sau đợt giao diện                          | HOÀN THÀNH |
| [20260820-01](handover/20260820-01_tai-cau-truc-giao-dien.md)       | Tái cấu trúc giao diện theo quy ước v1.0.0              | HOÀN THÀNH |

## Ghi chú vận hành

- **E2E ở máy này phải chạy `--workers=1`.** Chạy song song trên 4 nhân cho 18/20
  với hai lỗi RẢI RÁC (một ở `invite`, một ở `smoke` tài liệu); chạy lại từng cái
  một thì cả hai xanh, và cả bộ tuần tự thì 20/20. Đây là flake do tải, không phải
  hồi quy - nhưng nó trông y hệt hồi quy, nên đừng đọc kết quả chạy song song.
- Chạy e2e trên máy 4 nhân: **đừng chạy song song thứ gì khác**. Lần đầu bị 5 test
  đỏ vì timeout 60s trong lúc load average ~6.4 - `next dev` biên dịch nguội từng
  route. Chạy lại trên stack đã ấm (`E2E_NO_WEBSERVER=1`) thì 20/20 xanh.
