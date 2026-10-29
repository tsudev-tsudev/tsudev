# Font tự host

TỆP SINH RA bởi `npm run fonts:sync` (`scripts/sync-fonts.js`). Đừng thêm,
xoá hay đổi tên tệp bằng tay - sửa bảng `HO_FONT` trong script rồi chạy lại.

| Họ font        | Giấy phép   | Vì sao chọn                                             |
| -------------- | ----------- | ------------------------------------------------------- |
| Be Vietnam Pro | SIL OFL 1.1 | thiết kế GỐC cho tiếng Việt; tổ hợp hai dấu đúng vị trí |
| JetBrains Mono | SIL OFL 1.1 | font mono có subset `vietnamese` thật                   |

Cả hai giấy phép CHO PHÉP tự host và nhúng. Thêm họ font mới thì kiểm giấy
phép TRƯỚC khi tải.

Chỉ giữ subset `latin`, `latin-ext`, `vietnamese`. `cyrillic`/`greek` bị bỏ có
chủ đích - xem lý do trong `scripts/sync-fonts.js`.

Vì sao tự host chứ không dùng `@import` của Google Fonts: CSP của production
chặn cả stylesheet ngoài host lẫn `fonts.gstatic.com`, nên bản `@import` IM
LẶNG không nạp gì trong nhiều tháng. Chi tiết ở đầu `scripts/sync-fonts.js`.
