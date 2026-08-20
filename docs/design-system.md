# Hệ thống giao diện - cách tsudev-web hiện thực bộ quy ước

**Quy tắc là [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)** (v1.0.0, dùng chung cho mọi
repo trong hệ sinh thái, thuộc nhóm bất khả xâm phạm). File này chỉ trả lời một
câu hỏi khác: _repo này hiện thực bộ quy ước đó bằng những file nào_. Đừng chép
lại nội dung của nhau.

Component dùng chung nằm ở `packages/ui` (`@tsudev/ui`). Viết component riêng
trong `apps/*` chỉ được phép khi nó thật sự chỉ dùng ở một app.

## Đường đi của một giá trị màu

```
tokens/design-tokens.json          ← NGUỒN CHÂN LÝ DUY NHẤT (sửa ở đây)
   │  npm run tokens:sync
   ▼
packages/ui/src/tokens.css         ← BẢN SINH RA, đừng sửa tay
   │  @import
   ▼
apps/frontend-main/styles/globals.css
   │  var(--…)
   ▼
apps/frontend-main/tailwind.config.js   ← mọi khoá trỏ về một biến CSS
   │
   ▼
class trong .tsx  (bg-surface, text-fg-muted, border-line-control…)
```

Ba cổng canh chuỗi này, và `npm run tokens:check` nằm trong CI:

| Cổng                                          | Bắt được gì                                                           |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `npm run tokens:check`                        | `tokens.css` bị sửa tay, hoặc `tokens/tokens.css` trôi lệch khỏi JSON |
| `packages/ui/test/contrast.test.ts`           | một mã màu làm tụt tương phản dưới WCAG AA, ở **bất kỳ** chế độ nào   |
| `apps/frontend-main/test/themeTokens.test.ts` | ba bản sao màu nền ngoài `tokens.css` trôi lệch nhau                  |

`tokens/tokens.css` là bản chuẩn của **hệ sinh thái** (C#/Python/Qt cũng đọc thư
mục `tokens/`). Script đồng bộ **không** ghi đè nó - chỉ đối chiếu và báo lệch.
Nó nằm trong `.prettierignore` cùng `docs/DESIGN_SYSTEM.md`: prettier hạ mã hex
xuống chữ thường và tách danh sách selector xuống dòng, tức là làm bản ở repo này
khác bản gốc, và một bộ token dùng chung mà mỗi repo một dạng thì hết là dùng chung.

## Ba chế độ, và chuyện `prefers-color-scheme`

`data-theme` trên `<html>`: `light` (mặc định) · `warm` · `dark`.

Đây là chỗ hai tài liệu quy ước **mâu thuẫn nhau**, nên ghi rõ cách hoà giải đã chọn:

- `DESIGN_SYSTEM.md` §1 muốn chế độ mặc định bám theo hệ điều hành.
- `CLAUDE.md` cấm điều đó: một site đổi diện mạo theo cài đặt máy nghĩa là hai
  người mở **cùng** một đường link thấy hai thứ khác nhau mà không ai chọn gì cả,
  và người viết bài không biết bài mình trông ra sao.

Cách hoà giải: **mặc định vẫn là Sáng**, nhưng "Theo hệ thống" có mặt như một
**lựa chọn người dùng tự bật** - lựa chọn thứ tư trong `ThemeToggle`. Hệ quả về mã:

- Bảng màu trong `tokens.css` **không** có media query nào treo vào cài đặt hệ
  điều hành. `themeTokens.test.ts` canh điều này.
- Việc hỏi cài đặt máy chỉ xảy ra trong JavaScript, ở đúng hai chỗ:
  `pages/_document.tsx` (script đồng bộ, nội tuyến, trong `<head>` - chạy **trước
  khi trang được vẽ**, nếu không sẽ có một khung hình sáng trắng ở mọi lần tải) và
  `ThemeToggle.tsx` (theo dõi máy đổi cài đặt giữa chừng).
- Giá trị lưu trong `localStorage['tsudev-theme']` là **lựa chọn** (`light`/`warm`/
  `dark`/`system`), không phải bảng màu. Chỉ script boot mới giải nó thành `data-theme`.

Màu nền của ba chế độ bị chép ra hai file `.tsx` vì cả hai chạy trước khi CSS
được tính - `<meta name="theme-color">` không đọc được biến CSS. Đó là bản sao
**bắt buộc**, và có test canh cho chúng bằng nhau.

## Token riêng của repo này

Bộ chuẩn v1.0.0 không có sẵn ba nhóm dưới đây; chúng nằm ở
`extensions.tsudev-web` trong file JSON, tách bạch khỏi khối `color` bất khả xâm phạm.

| Nhóm                                | Vì sao cần                                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--icon-*` (6 màu)                  | Mã màu theo **nhóm hành động** - mắt nhận ra nhóm trước khi đọc nhãn. Sáu, không hơn: quá bảy màu thì chúng thôi là mã và thành nhiễu.                                  |
| `--<trạng thái>-ink` / `-tint`      | §5 đòi badge "nền trạng thái nhạt 12% + chữ màu trạng thái đậm", nhưng ở chế độ Sáng cặp đó chỉ đạt ~4.1-4.3:1. `-ink` là sắc đậm hơn cho chữ, `-tint` là nền tính sẵn. |
| `--accent`, `--glow`, `--grid-line` | Sắc phụ (teal) của con dấu tín nhiệm và hai hoạ tiết nền.                                                                                                               |

⚠️ **Hai token của bộ chuẩn KHÔNG đạt chính quy tắc bắt buộc của §1**, đo được
bằng `contrast.test.ts` - xem `$accessibility_gap` trong `tokens/design-tokens.json`:

- `text-muted` chỉ đạt 3.69-4.58:1 (ngưỡng AA là 4.5:1), và đây là token bị dùng
  nhiều nhất trong app.
- `border-strong` chỉ đạt 1.65-2.49:1 (WCAG 1.4.11 đòi 3:1 cho ranh giới thành
  phần giao diện).

Không sửa được khối `color`, nên repo này **ghi đè `text-muted`** và thêm vai trò
mới **`border-control`** cho ranh giới vùng tương tác (viền nút phụ, viền ô nhập).
`border-strong` giữ giá trị chuẩn và từ nay chỉ dùng cho ranh giới trang trí.
**Cần đẩy ngược lên repo token trung tâm.**

## Bản đồ tên: token CSS ↔ class Tailwind

Tailwind không giữ giá trị nào - mọi khoá trỏ về một biến CSS.

| Biến CSS                                        | Class                                                        |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `--bg-base` / `-surface` / `-subtle` / `-hover` | `bg-base` / `bg-surface` / `bg-subtle` / `bg-hovered`        |
| `--text-primary` / `-secondary` / `-muted`      | `text-fg` / `text-fg-secondary` / `text-fg-muted`            |
| `--text-link`                                   | `text-link`                                                  |
| `--border` / `-strong` / `-control`             | `border-line` / `border-line-strong` / `border-line-control` |
| `--primary` / `-hover` / `-active`              | `bg-primary` / `bg-primary-hover` / `bg-primary-active`      |
| `--on-primary`, `--on-status`                   | `text-on-primary`, `text-on-status`                          |
| `--<trạng thái>-ink` / `-tint`                  | `text-danger-ink`, `bg-success-tint`…                        |
| `--control-h`, `--row-h`                        | `h-control`, `h-row`                                         |
| `--sp-1..12`                                    | `p-sp1` … `gap-sp6`                                          |

Chữ nằm trong nhóm `fg` chứ không phẳng ra thành `text-primary`, vì bộ chuẩn có
**cả** `--text-primary` (chữ thân bài) lẫn `--primary` (xanh thương hiệu) - phẳng
ra thì `text-primary` mang hai nghĩa.

## Mật độ

`data-density="compact"` trên `<html>` đổi `--control-h` 36→32px, `--row-h`
44→36px, `--list-item-h` 40→32px. Comfortable là mặc định cho web; Compact dành
cho màn hình nhiều dữ liệu.

## Ngày giờ

`apps/frontend-main/lib/format.ts` - `formatDateVN` (`DD/MM/YYYY`) và
`formatDateTimeVN` (`HH:mm DD/MM/YYYY`). **Đừng gọi thẳng
`toLocaleDateString('vi-VN')`**: nó bỏ số 0 đầu nên 05/08/2026 in ra `5/8/2026`,
và cột ngày trong bảng thôi thẳng hàng. Múi giờ ghim `Asia/Ho_Chi_Minh` vì trang
dựng SSR trên Workers (UTC) rồi hydrate ở máy người đọc - để nó trôi thì bài đăng
lúc đêm hiện lệch một ngày giữa hai lần vẽ.

## Storybook

`npm --workspace packages/ui run storybook` → <http://localhost:6006>. Thanh công
cụ có nút **Giao diện** đổi giữa ba chế độ. Storybook **không** nằm trong CI - nó
là công cụ rà bằng mắt, cổng thật là `contrast.test.ts`.

Chạy được từ 20/08/2026. Trước đó nó hỏng ở **bốn** tầng chồng lên nhau, và mỗi
tầng đều hỏng theo kiểu IM LẶNG - đây là lý do phần cấu hình có nhiều chú thích
hơn mã:

| Hỏng ở đâu                                                             | Trông như thế nào                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| thiếu gói CLI `storybook`, `framework` khai theo kiểu bản 6            | `storybook: not found`                                     |
| glob `@(js,jsx,ts,tsx)` - extglob phân nhánh bằng `\|`, không phải `,` | một dòng WARN, giao diện rỗng như "chưa ai viết story"     |
| `@tsudev/types` là CommonJS, Vite phục vụ thẳng qua `/@fs`             | server lên, `index.json` đủ 12 story, MỌI khung story rỗng |
| `next-auth/react` đọc `process` + đòi `SessionProvider`                | vẫn rỗng, lỗi chỉ nằm trong console                        |

Cả bốn đều KHÔNG làm `storybook build` thất bại. Nên phép nghiệm thu ở đây phải
là **đếm story vẽ ra được**, không phải "lệnh chạy xong": mở
`iframe.html?id=<story>&globals=theme:<chế độ>` cho từng story ở cả ba chế độ và
kiểm `#storybook-root` có nội dung. Lần nghiệm thu 20/08/2026: **36/36 lượt**
(12 story × 3 chế độ) vẽ ra nội dung, đúng `data-theme`, 0 lỗi console, 0 ảnh 404.

⚠️ Component nào của `@tsudev/ui` kéo theo `next-auth` (`SiteHeader`,
`SiteFooter`, `useTrustNav`) thì chỉ dựng được nhờ hai mảnh vá trong
`.storybook/`: shim `window.process` ở `preview-head.html` và decorator
`SessionProvider` ở `preview.js`. Thêm component mới phụ thuộc thứ Next-only thì
phải nghĩ tới chỗ này.
