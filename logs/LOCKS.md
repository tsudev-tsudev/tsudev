# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG - đã nhả toàn bộ khoá của đợt tái cấu trúc 28/10/2026.)

🔴 **VIỆC CHẶN TOÀN DỰ ÁN: tsudev.com đang TRỐNG - Neon treo compute.**
Chi tiết, hai nhánh nguyên nhân và cách chữa: `logs/STATE.md` đầu file và
`docs/refactor-tsudev-2026-q4.md` §0. Cần chủ dự án đọc Neon → Usage.

🟠 **Nhánh hiện tại có MIGRATION CHƯA ÁP LÊN PRODUCTION:**
`packages/db/prisma/migrations/20261028140000_project_release`.
Thứ tự phát hành BẤT BIẾN: `prisma migrate deploy` lên Neon **TRƯỚC**, merge
`main` **SAU**. Migration thuần bổ sung (CREATE TYPE/TABLE/INDEX, không DROP),
nhưng PR #88 ngày 27/08 đã đảo thứ tự này một lần và chỉ sống nhờ may mắn.

🟠 **Frontend Cloudflare vẫn CHƯA deploy** - việc này đã treo từ phiên 30 (bản
Worker đang chạy là bản dựng next@15). Nay còn thêm đợt này: font tự host, bộ
icon mới, khu tải về. Lệnh: `npm --workspace apps/frontend-main run deploy` -
**đừng gọi thẳng `opennextjs-cloudflare deploy`**.
