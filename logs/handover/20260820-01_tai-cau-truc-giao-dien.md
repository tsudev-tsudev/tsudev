# PHIẾU BÀN GIAO - Tái cấu trúc toàn diện giao diện theo quy ước v1.0.0

- **Mã phiếu**: 20260820-01
- **Từ**: phiên 7 (design-system + frontend-web) - **Đến**: phiên sau
- **Thời điểm**: 14:41 20/08/2026
- **Trạng thái**: HOÀN THÀNH - đã nghiệm thu bằng máy lúc 16:41 20/08/2026 (xem mục 6)

## 1. Việc đã làm xong

**Cài bộ quy ước vào repo** - `logs/{STATE,LOCKS}.md`, `logs/handover/`,
`docs/{DESIGN_SYSTEM,PROJECT_STRUCTURE}.md`, `docs/templates/HANDOVER.md`,
`tokens/{design-tokens.json,tokens.css}`, `CHANGELOG.md`.
Nguồn: `tsudev-conventions/tsudev-conventions.zip` (thư mục đó nay đã thừa, xoá được).

**Chuỗi token có một nguồn duy nhất**

- `tokens/design-tokens.json` → `scripts/sync-tokens.js` → `packages/ui/src/tokens.css`.
  Bản CSS là ARTIFACT, có cảnh báo ở đầu file, `npm run tokens:sync` sinh lại.
- `npm run tokens:check` vào CI (`.github/workflows/ci.yml`, ngay sau `topology:check`).
  Nó bắt hai thứ: `tokens.css` bị sửa tay, và `tokens/tokens.css` (bản chuẩn hệ
  sinh thái) trôi lệch khỏi file JSON.
- Bộ sinh chạy đầu ra qua chính prettier của repo. Không có bước đó thì
  `format:check` và `tokens:check` đá nhau vĩnh viễn - chạy cái này thì cái kia đỏ.

**Ba chế độ Sáng / Ấm / Tối**

- `ThemeToggle.tsx` đổi từ nút bật-tắt thành menu **bốn** lựa chọn:
  Sáng · Ấm · Tối · Theo hệ thống. Đóng bằng ESC và bấm ra ngoài,
  `role="menuitemradio"`, dấu chọn là hình chứ không phải màu.
- `pages/_document.tsx` giải lựa chọn thành `data-theme` cụ thể TRƯỚC khi vẽ.
  `localStorage['tsudev-theme']` lưu **lựa chọn** (`light`/`warm`/`dark`/`system`),
  không lưu bảng màu.
- Chọn "Theo hệ thống" thì `ThemeToggle` theo dõi `matchMedia` và đổi ngay khi máy
  đổi - không chờ tải lại trang.

**Đổi tên token trên toàn app** (~615 chỗ, 48 file, bằng codemod một lượt):
`bg-surface`→`bg-base`, `bg-panel`→`bg-surface`, `bg-panel2`→`bg-subtle`,
`text-ink`→`text-fg`, `text-inksoft`→`text-fg-secondary`, `text-muted`→`text-fg-muted`,
`text-brandink`→`text-link`, `*-brand`→`*-primary`, `*-error`→`*-danger`,
`text-teal`→`text-accent`, `border-hairline`→`border-line`. Bảng đầy đủ:
`docs/design-system.md`. Không còn tên cũ nào sót - đã grep lại.

**Component theo §5** - Button (4 trạng thái, cao 36px theo token mật độ, hover
dùng `primary-hover` thay `brightness-110`), Input (36px, `bg-surface`,
`aria-invalid`), Badge (tint + ink, thêm prop `icon`), Toast (**chuyển từ
phải-DƯỚI lên phải-TRÊN**, viền trái 3px, **tự đóng 4s / lỗi 6s** - trước đây
không có hẹn giờ nên chỗ nào quên xoá state là toast nằm lại vĩnh viễn),
Modal (overlay dùng token `--overlay`, radius-lg, z-index token), Card (radius-lg).

**Ngày giờ** - `apps/frontend-main/lib/format.ts`. `toLocaleDateString('vi-VN')`
cho `5/8/2026`, thiếu số 0 đầu, sai §4. Đã thay ở 5 chỗ; `lib/trust.ts` `fmtDate`
uỷ quyền cho hàm mới. Múi giờ ghim `Asia/Ho_Chi_Minh`.

**Bo góc và mã hex** - chip lọc `rounded-full`→`rounded-md`, nhãn mono
`rounded-full`→`rounded-sm`. `rounded-full` chỉ còn ở avatar, chấm trạng thái và
một khối blur trang trí. Ba chấm cửa sổ terminal ở trang chủ bỏ mã hex macOS,
dùng token trạng thái. Bốn mã hex của logo Google được giữ (nhãn hiệu bên thứ ba,
đã ghi chú lý do tại chỗ).

**Test** - `contrast.test.ts` mở rộng lên 3 chế độ và 199 phép đo (trước: 2 chế độ).
`themeTokens.test.ts` viết lại cho 3 chế độ. `.prettierignore` nhận thêm 5 file
quy ước (prettier hạ hex xuống chữ thường và tách selector, làm bản ở repo lệch
bản gốc dùng chung).

**Cổng đã chạy, đều xanh**: `tokens:check` · `format:check` · `lint` ·
`typecheck` · `topology:check` · `packages/ui` 199/199 · `frontend-main` 27/27 ·
`next build` thành công · ảnh chụp thật 3 chế độ đúng mã màu quy ước.

## 2. Việc dang dở + bước tiếp theo CỤ THỂ

Ba mục dưới đây KHÔNG chặn việc phát hành; chúng đã được chuyển vào hàng đợi của
`logs/STATE.md`.

- [ ] **Đẩy hai mã màu vá lên repo token trung tâm** (xem mục 5).
- [ ] **Storybook**: `storybook: not found` - devDependencies của `packages/ui`
      không có trong `node_modules`, nên cấu hình 3 chế độ đã viết
      (`.storybook/preview.js`) CHƯA ai nhìn thấy nó chạy. Storybook không nằm
      trong CI nên cũng không có gì canh. Các story còn dùng React 18 từ root
      `package.json` - nợ cũ, đã ghi trong `next.config.js`.
- [ ] **Rà bằng MẮT NGƯỜI** (khác với rà bằng máy đã làm ở mục 6). Máy đo được
      tương phản và cỡ chữ; nó không đọc được "cái này trông cân đối chưa". 36 ảnh
      chụp sẵn ở scratchpad của phiên 7 đã mất; chụp lại bằng
      `npm run dev:local` rồi dùng menu Giao diện trên header.

## 3. File liên quan / đang khóa

Không còn khoá nào. 71 file thay đổi, chưa commit. Nhóm chính:

- `tokens/design-tokens.json` - nguồn chân lý, có thêm khối `extensions.tsudev-web`
- `scripts/sync-tokens.js` - MỚI, bộ sinh
- `apps/frontend-main/lib/format.ts` - MỚI, định dạng ngày giờ
- `packages/ui/src/tokens.css` - bản sinh ra, đừng sửa tay
- `apps/frontend-main/tailwind.config.js` - bản đồ tên token ↔ class
- `AGENTS.md` - gộp hai nguồn, xem mục 5

## 4. Yêu cầu gửi agent đang giữ khóa

Không có.

## 5. Cảnh báo / quyết định quan trọng

⚠️ **Bảng màu chuẩn v1.0.0 không đạt chính quy tắc §1 của nó ở hai token.**
Đo được bằng `contrast.test.ts`:

| Token           | Đo được       | Ngưỡng              |
| --------------- | ------------- | ------------------- |
| `text-muted`    | 3.69 - 4.58:1 | 4.5:1 (§1, WCAG AA) |
| `border-strong` | 1.65 - 2.49:1 | 3:1 (WCAG 1.4.11)   |

`text-muted` là token bị dùng nhiều nhất trong app (~200 chỗ). Khối `color` bất
khả xâm phạm nên không sửa được tại chỗ; tsudev-web **ghi đè `text-muted`** và
thêm vai trò mới **`border-control`** trong `extensions.tsudev-web`. `border-strong`
giữ giá trị chuẩn, từ nay chỉ dùng cho ranh giới trang trí. Chi tiết và giá trị
đã chọn: `$accessibility_gap` trong `tokens/design-tokens.json`.
**Đây là thứ phải đẩy ngược lên repo token trung tâm** - nếu không, mọi repo khác
trong hệ sinh thái đang mang cùng khiếm khuyết mà không ai đo.

⚠️ **`prefers-color-scheme`: hai tài liệu quy ước mâu thuẫn nhau.**
`DESIGN_SYSTEM.md` §1 muốn mặc định theo hệ điều hành; `CLAUDE.md` cấm. Đã chốt:
mặc định Sáng, "Theo hệ thống" là lựa chọn thứ tư người dùng tự bật. Bảng màu
trong `tokens.css` không có media query nào treo vào cài đặt máy -
`themeTokens.test.ts` canh điều đó. Việc hỏi cài đặt máy chỉ nằm trong JavaScript.
Đảo quyết định này thì phải sửa cả test lẫn `CLAUDE.md`.

⚠️ **`AGENTS.md` bị hai nguồn cùng đòi.** Bộ quy ước có `AGENTS.md` riêng, repo
đã có `AGENTS.md` với bảng phân vai 8 agent. Đã gộp: **Phần A** là quy ước nguyên
văn, **Phần B** là phần riêng của repo. Hai tài liệu cũng khác nhau về cách chống
giẫm chân (quyền sở hữu đường dẫn vs file khoá) - phần B nói rõ là cần **cả hai**:
quyền sở hữu nói ai ĐƯỢC sửa, khoá nói ai ĐANG sửa.

⚠️ **`docs/PROJECT_STRUCTURE.md` chưa được áp dụng.** Nó mô tả cây `src/main`,
`src/components`, `src/features`… - hình trạng của một app đơn, không phải npm
workspaces với `apps/`, `services/`, `packages/`. Áp nguyên văn nghĩa là dời cả
repo. Chưa làm, và không nên làm mà không có quyết định của chủ dự án. Đã đưa vào
hàng đợi `STATE.md`.

ℹ️ **`CLAUDE.md` đang có ba đoạn nói sai hiện trạng** (mục "Quy ước code" nói
"giao diện có HAI chế độ", nhắc `:root[data-theme='dark']` là bảng ghi đè duy
nhất, và cấm `prefers-color-scheme` không kèm ngoại lệ). Chưa sửa vì file đó là
ngữ cảnh tĩnh được cache đầu phiên - sửa giữa phiên là bust cache toàn bộ phía
sau. **Phiên sau sửa ngay ở lượt đầu tiên.** Nội dung thay thế đã viết sẵn ở
`docs/design-system.md`.

## 6. Kết quả xử lý

_(phiên sau điền)_
