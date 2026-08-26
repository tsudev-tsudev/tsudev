# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

services/newsroom-service/src/dispatcher.ts | backend-api/NEWSROOM-DUYET (reclaimStale + revive) | 19:20 26/08/2026
services/newsroom-service/src/index.ts | backend-api/NEWSROOM-DUYET (approve + state) | 19:20 26/08/2026
services/newsroom-service/test/ | qa-test/NEWSROOM-DUYET | 19:20 26/08/2026
apps/frontend-main/pages/admin/newsroom.tsx | frontend-web/NEWSROOM-DUYET (act() nuốt lỗi) | 19:20 26/08/2026
logs/STATE.md | NEWSROOM-DUYET (sổ sách) | 19:20 26/08/2026

⚠️ BA nhánh đang mở, không chạm file nào của nhau:

- `feat/docs-search` = PR #81 (có MIGRATION, ràng buộc thứ tự phát hành)
- `chore/qu-std-1-tokens` = PR #82, CI 7/7 xanh, chờ mắt người
- `fix/newsroom-duyet-dang` = nhánh này, tách từ `main` = `b6b64cc`
