# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG - không agent nào đang giữ khóa.

**`main` = `4bb3ae3`**, PR #81 đã merge và migration đã áp dụng trên prod.

Hai nhánh còn mở, cả hai đều **KHÔNG có migration** nên không ràng buộc thứ tự
phát hành:

1. `chore/qu-std-1-tokens` = **PR #82** (QU-STD-1 + QU-STD-3).
   Đọc `logs/handover/20260826-04_ket-phien-28.md`.
2. `fix/newsroom-duyet-dang` = **PR #83** (toà soạn im lặng).
   Đọc `logs/handover/20260826-05_toa-soan-im-lang.md`.

Cả hai đụng `logs/STATE.md` + `logs/LOCKS.md` khi merge, đều kiểu "cả hai cùng
thêm". Giữ cả hai khối, mới nhất lên trên.)
