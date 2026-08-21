# QUY ƯỚC GIAO DIỆN TOÀN PROJECT (DESIGN SYSTEM) - v1.0.0

> Áp dụng cho MỌI website, tool, phần mềm desktop (Electron/C#/Python/C++), app trong hệ sinh thái.
> Nguồn giá trị duy nhất: `tokens/design-tokens.json` (Web/Electron dùng `tokens/tokens.css`).
> Cấm hard-code màu/cỡ chữ/radius trong source code - chỉ dùng token.

## 1. Hệ màu & 3 chế độ nền (Adaptive Light)

Màu chủ đạo: **Blue**. Nền là blue nhạt dịu mắt, bề mặt (modal/card) sáng hơn nền để tách lớp tự nhiên, viền đủ đậm để phân biệt không cần đổ bóng nặng.

| Vai trò | Light (ngày/phòng sáng) | Warm/Sepia (làm việc lâu/ánh sáng gắt) | Dark (đêm/phòng tối) |
|---|---|---|---|
| Nền chính `bg-base` | `#EEF4FB` | `#F6F1E6` | `#0F1B2D` |
| Bề mặt modal/card `bg-surface` | `#FFFFFF` | `#FCF8EF` | `#16263C` |
| Nền phụ/hover `bg-subtle` | `#E3EDF8` | `#EFE8D9` | `#1C2F4A` |
| Viền `border` / đậm | `#C9D9EC` / `#9FB8D4` | `#DCD1BA` / `#BCAE90` | `#2C4363` / `#3F5B80` |
| Chữ chính `text-primary` | `#1C2B3A` | `#2E2A21` | `#E6EDF5` |
| Chữ phụ `text-secondary` | `#44607C` | `#5B5342` | `#A9BBD0` |
| Link `text-link` | `#1D4ED8` | `#1A56B8` | `#7FB2F7` |
| Nút chính `primary` | `#2563EB` | `#1E5FC2` | `#66A3F2` |
| Chữ trên nút `on-primary` | `#FFFFFF` | `#FFFFFF` | `#0C1930` |
| Success / Warning / Danger / Info | `#15803D` `#B45309` `#DC2626` `#0369A1` | `#1B6E38` `#9A4A07` `#BE2020` `#0B5E86` | `#4ADE80` `#FBBF24` `#F87171` `#38BDF8` |

**Quy tắc bắt buộc:**
- Mọi cặp chữ/nền đạt WCAG 2.1 AA ≥ **4.5:1** (chữ chính trên nền đạt ≥ 10:1 ở cả 3 chế độ). `text-muted` chỉ dùng cho thông tin phụ không thiết yếu.
- Chọn chế độ mặc định theo hệ điều hành (`prefers-color-scheme`), người dùng đổi thủ công thì **lưu lại lựa chọn** (localStorage/config file). Warm Mode là lựa chọn thủ công, khuyến nghị hiển thị gợi ý khi phiên làm việc > 2 giờ.
- Không dùng trắng tuyệt đối `#FFFFFF` làm `bg-base` và không dùng đen tuyệt đối `#000000` ở bất kỳ chế độ nào (giảm chói/mỏi mắt).
- Màu trạng thái không đứng một mình: luôn kèm icon hoặc chữ (hỗ trợ người mù màu).

## 2. Bo góc & viền (Radius)

| Token | Giá trị | Áp dụng |
|---|---|---|
| `radius-none` | `0px` | Khung layout, sidebar, header, footer, đường chia cột - **viền thẳng tắp** |
| `radius-sm` | `4px` | Badge, tag, checkbox, ô nhỏ trong table |
| `radius-md` | `6px` | **Button, input, dropdown, modal nhỏ** - bo tinh tế, không quá tròn |
| `radius-lg` | `8px` | **Modal lớn, table container, card** - mềm góc, không góc cạnh sắc |

Viền luôn **phẳng 1px solid** màu `border` (viền được focus/hover dùng `border-strong` hoặc `primary`). Không dùng viền double/dashed cho component chuẩn.

## 3. Bố cục, mật độ & khoảng trắng (Layout & Density)

- Lưới spacing bội số **4px** (`--sp-1..12`). Layout vuông vắn, căn theo cột; không đặt phần tử lệch lưới.
- Mật độ 2 mức: **Comfortable** (mặc định, hàng table cao 44px, padding cell 12px 16px) và **Compact** (tool desktop nhiều dữ liệu, hàng 36px, padding 8px 12px).
- Chiều rộng khối văn bản dài tối đa **72ch** để mắt đảo dòng không mỏi.
- Modal: padding `24px`, cách nhau giữa field trong form `16px`, giữa section `32px`. Modal nhỏ rộng 400–480px, modal lớn 640–800px, luôn căn giữa màn hình trên lớp `overlay`.
- Đổ bóng tối giản: `shadow-sm` (button/input) → `shadow-md` (dropdown/toast) → `shadow-lg` (modal). Không dùng bóng màu.

## 4. Typography (chuẩn tiếng Việt, chống mỏi mắt)

- Font thống nhất: **Inter** (hỗ trợ đầy đủ dấu tiếng Việt), fallback: `'SF Pro Text', 'Segoe UI', 'Roboto', system-ui, sans-serif`. Font code: `JetBrains Mono` → `Cascadia Code` → `Consolas`.
- Body text: Desktop Tools **14–15px**, Web **15–16px**. Không bao giờ nhỏ hơn 12px (kể cả caption).
- Line-height: heading `1.3`, body `1.55`, văn bản dài `1.6`.
- Thang cỡ chữ: 12 / 13 / 14 / 15 / 16 / 18(H4) / 20(H3) / 24(H2) / 30(H1).
- Weight: 400 body, 500 label/menu, 600 heading & button, 700 chỉ dùng nhấn mạnh số liệu. Không dùng weight 300 (mảnh, khó đọc tiếng Việt có dấu).
- Không dùng ALL CAPS cho tiếng Việt có dấu ở đoạn dài; chỉ cho nhãn ngắn ≤ 2 từ với letter-spacing `0.04em`.

**Định dạng ngày giờ (bắt buộc toàn hệ thống):**
- Ngày: `DD/MM/YYYY` hiển thị dạng **số**, ví dụ `01/02/2027`. **Tuyệt đối không** in ra giao diện chuỗi chữ kiểu `dd/mm/yyyy`.
- Ngày giờ: `HH:mm DD/MM/YYYY`, ví dụ `14:30 19/08/2026`. Placeholder input ngày dùng ví dụ số thật: `VD: 01/02/2027`.

## 5. Chuẩn hóa Component (Web + Desktop dùng chung)

**4 trạng thái bắt buộc cho MỌI vùng tương tác:**

| Trạng thái | Quy ước |
|---|---|
| Default | Màu token gốc, viền 1px `border` |
| Hover | Nền chuyển `primary-hover` (nút chính) hoặc `bg-hover` (nút phụ/hàng table); con trỏ `pointer`; chuyển màu `120ms` |
| Focus | Vòng focus `2px solid focus-ring`, offset `2px` - luôn nhìn thấy được bằng bàn phím |
| Disabled | Opacity `0.5`, con trỏ `not-allowed`, không nhận hover/focus, không đổ bóng |

**Controls:**
- **Button**: cao 36px (compact 32px), padding `8px 16px`, radius-md, chữ 600. Ba biến thể: Primary (nền `primary`, chữ `on-primary`), Secondary (nền `bg-surface`, viền `border-strong`, chữ `text-primary`), Ghost (không viền, hover `bg-hover`). Nút Danger dùng nền `danger`.
- **Input/Dropdown**: cao 36px, nền `bg-surface`, viền `border`, radius-md; focus viền `primary` + focus-ring; lỗi viền `danger` + dòng báo lỗi 13px màu `danger` bên dưới. Dropdown menu: nền `bg-surface`, shadow-md, radius-md, item cao 32px kèm **icon 16px nét mảnh (stroke 1.5px, bộ Lucide/Fluent)** đặt trước chữ, cách chữ 8px.
- **Checkbox** 16px radius-sm; **Toggle** 36×20px, bật = nền `primary`, tắt = nền `border-strong`.

**Feedback:**
- **Toast**: góc phải-trên, nền `bg-surface`, viền trái 3px màu trạng thái, shadow-md, tự đóng 4s (lỗi: 6s hoặc đóng tay).
- **Modal**: overlay token `overlay`, hộp `bg-surface` radius-lg shadow-lg; header 20px/600, nút hành động căn phải chân modal (Primary ngoài cùng bên phải), đóng bằng ESC + nút ×.
- **Progress bar**: cao 6px, nền `bg-subtle`, phần chạy `primary`, radius-sm.
- **Badge status**: chữ 12px/500, padding `2px 8px`, radius-sm, nền màu trạng thái nhạt 12% + chữ màu trạng thái đậm.

**Data Display:**
- **Table**: container radius-lg viền `border`; header nền `bg-subtle` chữ 600, phân cách hàng bằng viền dưới 1px `border`, hover hàng `bg-hover`, số căn phải, ngày hiển thị `DD/MM/YYYY`.
- **Tree View**: thụt cấp 20px, mũi tên xoay 16px, node đang chọn nền `bg-subtle` + viền trái 2px `primary`.
- **List View**: item cao 40px (compact 32px), phân cách viền 1px `border`, chọn = nền `bg-subtle`.

## 6. Quy ước tên phiên bản phát hành (app/tool/phần mềm - KHÔNG áp dụng website)

Định dạng: `{ten-app}_{YY}.{M}.{DD}{NN}_{arch}-setup.{ext}`

- `YY` = 2 số cuối năm; `M` = tháng **không** số 0 đầu; `DD` = ngày 2 chữ số; `NN` = số thứ tự phát hành **trong ngày**, bắt đầu `01`.
- `arch`: `x64` | `x86` | `arm64`. `ext` theo nền tảng: `.exe` (Windows), `.dmg` (macOS), `.deb`/`.AppImage` (Linux), `.apk` (Android).

Ví dụ ngày 19/8/2026, app `tsudev-swico` Windows 64-bit:
1. Bản 1: `tsudev-swico_26.8.1901_x64-setup.exe`
2. Bản 2 cùng ngày: `tsudev-swico_26.8.1902_x64-setup.exe`
3. Bản 3 cùng ngày: `tsudev-swico_26.8.1903_x64-setup.exe`

Chuỗi version trong code/manifest = `26.8.1901` (đồng bộ với tên file). Mỗi lần phát hành ghi 1 dòng vào `CHANGELOG.md` theo dạng `26.8.1901 - 19/08/2026 - nội dung thay đổi`.

## 7. Cách truy xuất token theo nền tảng

| Nền tảng | Cách dùng |
|---|---|
| Web (React/Vue/HTML) | Import `tokens/tokens.css`, dùng `var(--primary)`… Đặt `data-theme` trên `<html>` và `data-platform="web"` trên `<body>` |
| Electron | Như Web, `data-platform="desktop"` |
| C# (WPF/WinForms) | Parse `design-tokens.json` lúc khởi động → nạp vào ResourceDictionary/Theme class |
| Python (PyQt/Tkinter) | Parse JSON → sinh QSS/style dict |
| C++ (Qt) | Parse JSON → biến QSS |

Quy trình đổi giao diện: **chỉ sửa `design-tokens.json`** → đồng bộ sang `tokens.css` (thứ tự khai báo giữ 1:1) → toàn bộ hệ sinh thái tự cập nhật ở lần build/khởi động kế tiếp.
