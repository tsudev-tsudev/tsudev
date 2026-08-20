# STATE.md — Trạng thái project (agent đọc đầu phiên, cập nhật cuối phiên)

> **Phiên 8 bắt đầu ở đây**: đọc
> [`logs/handover/20260820-02`](handover/20260820-02_viec-con-lai-sau-giao-dien.md)
> trước. Mục 1.1 của phiếu đó (**80 file chưa commit**) phải xử lý trước mọi việc khác.

## Hàng đợi task (làm từ trên xuống)

- [ ] **🔴 Push nhánh `refactor/giao-dien-quy-uoc-v1` và mở PR** — đợt giao diện
      đã commit thành 3 cụm (82 file), cây sạch, cổng xanh. Cần chủ dự án xác nhận
      trước khi push. Xem phiếu 20260820-02 §1.1.

- [ ] **🟠 Đẩy hai mã màu vá lên repo token trung tâm** — `text-muted` và
      `border-strong` của bảng chuẩn v1.0.0 không đạt WCAG AA/1.4.11; tsudev-web
      đang vá cục bộ. Chi tiết: `$accessibility_gap` trong `tokens/design-tokens.json`.
- [ ] **🟠 `e2e/tests/invite.spec.js` không lặp lại được** (khiếm khuyết SẴN CÓ, không
      do đợt giao diện). `scripts/seed-dev-users.js` chỉ đặt mật khẩu, KHÔNG reset
      `User.role`; test nâng `alice` MEMBER→VIP vĩnh viễn, nên lần chạy thứ hai
      trên cùng DB luôn đỏ và triệu chứng là timeout ở bước không liên quan. Sửa:
      cho seed đặt lại `role` về đúng bậc ban đầu. Chủ vùng: `data-schema` +
      `backend-api`; test do `qa-test`.
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

| Mã                                                                | Chủ đề                                     | Trạng thái |
| ----------------------------------------------------------------- | ------------------------------------------ | ---------- |
| [20260820-02](handover/20260820-02_viec-con-lai-sau-giao-dien.md) | Việc còn lại sau đợt giao diện             | **MỞ**     |
| [20260820-01](handover/20260820-01_tai-cau-truc-giao-dien.md)     | Tái cấu trúc giao diện theo quy ước v1.0.0 | HOÀN THÀNH |

## Ghi chú vận hành

- Chạy e2e trên máy 4 nhân: **đừng chạy song song thứ gì khác**. Lần đầu bị 5 test
  đỏ vì timeout 60s trong lúc load average ~6.4 - `next dev` biên dịch nguội từng
  route. Chạy lại trên stack đã ấm (`E2E_NO_WEBSERVER=1`) thì 20/20 xanh.
