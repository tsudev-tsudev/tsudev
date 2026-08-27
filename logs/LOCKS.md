# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG - đã nhả toàn bộ khóa của B1.

⚠️ HAI nhánh đang chờ merge, thứ tự phát hành KHÁC nhau:

1. `feat/xac-minh-bang-ma` (VERIFY-CODE, phiên 28) **CÓ MIGRATION**
   (`20260826152436_email_verify_code`). BỊ RÀNG BUỘC: `prisma migrate deploy` trên
   prod TRƯỚC khi merge. Đảo thứ tự ⇒ cổng chặn lệch migration làm SẬP CẢ SITE.
2. `feat/next16-b1` (B1 next@16, phiên 29, tách từ `main` = `33cc680`) **KHÔNG
   migration** - merge lúc nào cũng được, nhưng phải deploy frontend Cloudflare qua
   `npm --workspace apps/frontend-main run deploy` thì bản Worker mới đổi theo.

Hai nhánh KHÔNG đụng file của nhau.)
