# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG - đã nhả toàn bộ khóa của VERIFY-CODE.

⚠️ Nhánh `feat/xac-minh-bang-ma` (PR #88) đang chờ: **CÓ MIGRATION**
(`20260826152436_email_verify_code`). Thứ tự phát hành BỊ RÀNG BUỘC:
`prisma migrate deploy` trên prod TRƯỚC khi merge. Đảo thứ tự ⇒ cổng chặn lệch
migration làm SẬP CẢ SITE.

Nhánh đã rebase lên `main` = `d8282e5` (27/08, sau khi gộp B1 next@16 ở PR #86,
sổ sách ở #87, và đợt bỏ-đói-kênh-DOC ở #89). Lần rebase nào cũng chỉ đụng
`logs/LOCKS.md` - mã của nhánh không giao với ba đợt kia.

✅ PR #89 (bỏ đói kênh DOC) đã merge và `db:seed:newsroom` đã chạy trên prod.)
