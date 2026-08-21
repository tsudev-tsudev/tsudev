# Đề xuất đẩy ngược lên repo token trung tâm

> **Trạng thái**: chờ gửi. Repo token trung tâm không nằm trong repo này, nên file
> này là gói bàn giao — đủ để dán thẳng vào issue/PR bên đó mà không phải đo lại.
>
> Nguồn của vấn đề: `$accessibility_gap` trong `tokens/design-tokens.json`.
> Cổng đang canh phía tsudev-web: `packages/ui/test/contrast.test.ts`.

## Vấn đề

Bảng `color` chuẩn v1.0.0 không đạt **chính quy tắc bắt buộc của
`DESIGN_SYSTEM.md` §1** ở hai token. Không phải chuyện thẩm mỹ: `text-muted` là
token bị dùng nhiều nhất trong app (~200 chỗ), và nó là **chữ thường**, nên
ngưỡng là 4.5:1 chứ không phải 3:1.

Đo bằng công thức tương phản WCAG 2.x trên đúng các cặp mà giao diện thật sinh ra
(4 tầng nền × 3 chế độ). Tỉ số **thấp nhất** của mỗi chế độ in đậm — một cặp đạt
ở chế độ Tối vẫn có thể trượt ở chế độ Sáng, nên phải đo cả ba.

### 1. `text-muted` — ngưỡng AA 4.5:1

| Chế độ | Giá trị chuẩn | bg-base | bg-surface | bg-subtle | bg-hover | Thấp nhất  |
| ------ | ------------- | ------- | ---------- | --------- | -------- | ---------- |
| Sáng   | `#5F7891`     | 4.14    | 4.58       | 3.87      | 3.69     | **3.69** ✗ |
| Ấm     | `#6E6552`     | 5.11    | 5.43       | 4.72      | 4.43     | **4.43** ✗ |
| Tối    | `#8298B2`     | 5.83    | 5.15       | 4.56      | 3.89     | **3.89** ✗ |

### 2. `border-strong` — ngưỡng WCAG 1.4.11 là 3:1 cho ranh giới thành phần

| Chế độ | Giá trị chuẩn | bg-base | bg-surface | bg-subtle | Thấp nhất  |
| ------ | ------------- | ------- | ---------- | --------- | ---------- |
| Sáng   | `#9FB8D4`     | 1.85    | 2.04       | 1.73      | **1.73** ✗ |
| Ấm     | `#BCAE90`     | 1.94    | 2.06       | 1.79      | **1.79** ✗ |
| Tối    | `#3F5B80`     | 2.49    | 2.19       | 1.94      | **1.94** ✗ |

## Đề xuất

### A. Sửa giá trị `text-muted` trong khối `color`

Giữ nguyên sắc (hue) của bảng chuẩn, chỉ kéo độ sáng cho qua ngưỡng — đây chính
là giá trị tsudev-web đang ghi đè cục bộ và đã chạy trên production.

| Chế độ | Từ        | Thành     | bg-base | bg-surface | bg-subtle | bg-hover | Thấp nhất  |
| ------ | --------- | --------- | ------- | ---------- | --------- | -------- | ---------- |
| Sáng   | `#5F7891` | `#52627A` | 5.60    | 6.20       | 5.24      | 4.99     | **4.99** ✓ |
| Ấm     | `#6E6552` | `#5E5646` | 6.44    | 6.84       | 5.95      | 5.57     | **5.57** ✓ |
| Tối    | `#8298B2` | `#9BB0C9` | 7.78    | 6.86       | 6.08      | 5.19     | **5.19** ✓ |

### B. Thêm vai trò mới `border-control`, GIỮ NGUYÊN `border-strong`

Đừng sửa `border-strong` cho đạt 3:1. Hai vai trò khác nhau đang bị gộp vào một
token, và đó mới là lỗi gốc:

- **ranh giới trang trí** (đường kẻ chia khối, hairline của card) — không mang
  thông tin thao tác, WCAG không đòi 3:1, và kéo nó đậm lên làm giao diện nặng nề.
- **ranh giới vùng tương tác** (viền nút phụ, viền ô nhập) — _là_ thứ nói cho
  người dùng biết bấm/gõ được ở đâu, nên 3:1 là bắt buộc.

Đề xuất: `border-strong` giữ nguyên giá trị và **thu hẹp** về vai trò trang trí;
thêm `border-control` cho vai trò thứ hai.

| Chế độ | `border-control` | bg-base | bg-surface | bg-subtle | Thấp nhất  |
| ------ | ---------------- | ------- | ---------- | --------- | ---------- |
| Sáng   | `#74899F`        | 3.26    | 3.61       | 3.05      | **3.05** ✓ |
| Ấm     | `#8E8064`        | 3.44    | 3.65       | 3.18      | **3.18** ✓ |
| Tối    | `#6E88AE`        | 4.77    | 4.21       | 3.73      | **3.73** ✓ |

`bg-hover` cố ý không nằm trong bảng ranh giới: nền hover là trạng thái tạm thời
của một hàng, không phải bề mặt mà nút phụ hay ô nhập nằm lên.

## Vì sao không tự sửa ở tsudev-web rồi thôi

Đang vá cục bộ thật (`extensions.tsudev-web`), và cục bộ thì **chạy được nhưng
không chữa được**: mọi app khác đọc cùng bảng chuẩn sẽ lặp lại đúng lỗi này, và
mỗi nơi lại vá một kiểu. Giá trị đề xuất ở đây đã chạy trên production tsudev.com
từ 20/08/2026 — nếu bên trung tâm nhận, tsudev-web xoá phần ghi đè và quay về
đúng một nguồn.

## Cách kiểm lại số

Công thức: WCAG 2.x relative luminance (sRGB → linear, hệ số 0.2126/0.7152/0.0722)
rồi `(Lsáng + 0.05) / (Ltối + 0.05)`. Bản cài đặt tham chiếu và bộ cặp đầy đủ:
`packages/ui/test/contrast.test.ts` — chạy bằng `npm --workspace packages/ui test`.

⚠️ Khi tự viết lại phép đo: quên `srgbToLinear` ở **một** kênh vẫn cho ra bảng số
trông hoàn toàn hợp lý (phiên 10 đã dính, mọi tỉ số tụt về 1.2-2.9 và cả giá trị
ĐANG chạy trên production cũng "trượt"). Dấu hiệu nhận ra: giá trị đã qua cổng CI
mà phép đo mới nói là hỏng ⇒ nghi phép đo trước, nghi mã màu sau.
