# STATE.md — Trạng thái project (agent đọc đầu phiên, cập nhật cuối phiên)

> **Phiên 10 bắt đầu ở đây**: đọc
> [`logs/handover/20260820-05`](handover/20260820-05_phat-hanh-phien-9.md) — phiếu
> vào cửa duy nhất. Chuỗi phát hành đã chạy xong bước 1 và 2; **bước 3 chỉ chủ dự
> án bấm được** (nút "Hồi sinh việc đã dừng" ở `/admin/newsroom`).

## Hàng đợi task (làm từ trên xuống)

- [ ] **🔴 BƯỚC 3: bấm nút "Hồi sinh việc đã dừng (16)"** ở
      `https://tsudev.com/admin/newsroom`. Cần phiên ADMIN production nên agent
      không bấm thay được. Bản sửa nút **đã deploy** (Worker `d2a0640a`) và đã
      kiểm chứng có mặt trong chunk JS production, không chỉ mã 200.
      Sau khi bấm: chạy `npm run newsroom:check`, `AgentRun` phải tiếp tục tăng.

- [ ] **🔴 GitHub Actions không chạy được — vấn đề TÀI KHOẢN, không phải mã.**
      Cả 5 job của PR #36 đỏ trong 2 giây: _"recent account payments have failed
      or your spending limit needs to be increased"_. Không job nào chạy một dòng
      nào. Repo private + GitHub Free = 2.000 phút/tháng (`docs/free-tier.md`).
      Kiểm _Settings → Billing & plans_. Tới khi sửa xong thì **cổng kiểm duy
      nhất là chạy tay ở local** — danh sách lệnh ở phiếu 20260820-04 §5.

- [ ] **🟠 Cân nhắc xoay `NEWSROOM_TICK_TOKEN`** — `wrangler deploy` in nguyên giá
      trị token ra terminal phiên 9. Không vào git, nhưng đã nằm trong scrollback.
      Xoay thì đổi **đồng thời** ở Render và `npm run cron:secret`; lệch nhau là mỗi
      nhịp giờ trả 401 và toà soạn đứng yên không có gì đỏ lên. Chi tiết: phiếu
      20260820-05 §2.3.
- [ ] **🟠 Sổ Neuron của ta vẫn đếm THIẾU** — `withRun()` chỉ ghi `neuronsUsed` ở
      nhánh THÀNH CÔNG. Không còn chặn (bản vá phiên 8 không dựa vào con số đó).
      Cách vá: phiếu 20260820-04 §2.3.
- [ ] **🟠 Đẩy hai mã màu vá lên repo token trung tâm** — `text-muted` và
      `border-strong` của bảng chuẩn v1.0.0 không đạt WCAG AA/1.4.11; tsudev-web
      đang vá cục bộ. Chi tiết: `$accessibility_gap` trong `tokens/design-tokens.json`.
- [ ] **🟡 Storybook chưa chạy được**: `storybook: not found` - devDependencies của
      `packages/ui` không có trong `node_modules`. Cấu hình 3 chế độ đã viết
      (`.storybook/preview.js`, nút "Giao diện") nhưng CHƯA ai nhìn thấy nó chạy.
      Cần `npm i` trong workspace đó rồi `npm --workspace packages/ui run storybook`.
- [ ] **🟡 Rà giao diện bằng MẮT NGƯỜI** — phiên 7 chỉ rà bằng máy (đo tương phản + cỡ chữ). Máy không đọc được "cái này trông cân đối chưa".
- [ ] 🟡 Cân nhắc áp `docs/PROJECT_STRUCTURE.md` cho monorepo — cây `src/` của quy
      ước không khớp npm workspaces. Cần quyết định của chủ dự án: sửa quy ước
      cho phép hình trạng monorepo, hay chấp nhận repo này lệch chuẩn ở điểm đó.
- [ ] ⚪ `packages/utils` (`@tsudev/utils`) không ai dùng — cân nhắc gỡ, hoặc chuyển
      `apps/frontend-main/lib/format.ts` vào đó khi có nơi thứ hai cần định dạng ngày.

## Đang thực hiện

| Task      | Agent | Bắt đầu |
| --------- | ----- | ------- |
| _(trống)_ |       |         |

## Đã hoàn thành (mới nhất trên cùng)

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

| Mã                                                                  | Chủ đề                                     | Trạng thái |
| ------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| [20260820-05](handover/20260820-05_phat-hanh-phien-9.md)            | Phát hành PR #36 lên production            | **MỞ**     |
| [20260820-04](handover/20260820-04_ket-phien-8.md)                  | Kết phiên 8 — chuỗi phát hành              | HOÀN THÀNH |
| [20260820-03](handover/20260820-03_chuan-hoa-url-va-van-han-muc.md) | Chuẩn hoá URL + van hạn mức LLM            | HOÀN THÀNH |
| [20260820-02](handover/20260820-02_viec-con-lai-sau-giao-dien.md)   | Việc còn lại sau đợt giao diện             | HOÀN THÀNH |
| [20260820-01](handover/20260820-01_tai-cau-truc-giao-dien.md)       | Tái cấu trúc giao diện theo quy ước v1.0.0 | HOÀN THÀNH |

## Ghi chú vận hành

- **E2E ở máy này phải chạy `--workers=1`.** Chạy song song trên 4 nhân cho 18/20
  với hai lỗi RẢI RÁC (một ở `invite`, một ở `smoke` tài liệu); chạy lại từng cái
  một thì cả hai xanh, và cả bộ tuần tự thì 20/20. Đây là flake do tải, không phải
  hồi quy - nhưng nó trông y hệt hồi quy, nên đừng đọc kết quả chạy song song.
- Chạy e2e trên máy 4 nhân: **đừng chạy song song thứ gì khác**. Lần đầu bị 5 test
  đỏ vì timeout 60s trong lúc load average ~6.4 - `next dev` biên dịch nguội từng
  route. Chạy lại trên stack đã ấm (`E2E_NO_WEBSERVER=1`) thì 20/20 xanh.
