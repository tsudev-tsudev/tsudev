# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG.

⚠️ `feat/xac-minh-bang-ma` (VERIFY-CODE, phiên 28) VẪN CHƯA merge và **CÓ MIGRATION**
(`20260826152436_email_verify_code`). Thứ tự phát hành BỊ RÀNG BUỘC: `prisma migrate
deploy` trên prod TRƯỚC khi merge. Đảo thứ tự ⇒ cổng chặn lệch migration làm SẬP CẢ
SITE. Nhánh này tách từ `main` cũ (`33cc680`); `main` nay là `381d98b` nên rebase
hoặc merge `main` vào nó trước khi mở PR.

✅ B1 (`feat/next16-b1`) đã merge 27/08, nhánh đã xoá. Còn lại: deploy frontend
Cloudflare - xem phiếu `20260827-01` §7.1.)
