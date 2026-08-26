# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG - phiên 28 đã nhả TOÀN BỘ khóa của QU-STD-1. Cây làm việc sạch, ba commit
đã đẩy lên `origin/chore/qu-std-1-tokens` và **PR #82 đã mở, CI 7/7 XANH**
(đo trên commit `65e8983`). CHƯA merge - còn chờ bước mắt người.

⚠️ **HAI nhánh đang mở, độc lập với nhau:**

1. `feat/docs-search` = **PR #81**, CI 7/7 xanh, CHƯA merge vì đợt đó có MIGRATION -
   thứ tự phát hành bị ràng buộc. Đọc `logs/handover/20260826-03_ket-phien-27.md` §2.1.
2. `chore/qu-std-1-tokens` (phiên 28) = QU-STD-1 + QU-STD-3, tách từ `main` = `b6b64cc`,
   **KHÔNG có migration** nên không ràng buộc thứ tự. Chờ MẮT NGƯỜI trước khi đẩy/mở PR.
   Đọc `logs/handover/20260826-04_ket-phien-28.md` §2.1 và §2.2.

Hai nhánh không chạm file mã nguồn nào chung; chỗ đụng duy nhất là sổ sách, đã đo
sẵn cách gỡ ở phiếu `20260826-04` §2.2.)
