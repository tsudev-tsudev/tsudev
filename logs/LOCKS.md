# LOCKS.md - File đang bị khóa (kiểm tra TRƯỚC khi sửa bất kỳ file nào)

# Định dạng: <đường dẫn> | <agent/nhiệm vụ> | <HH:mm DD/MM/YYYY>

# Sửa xong file → XÓA dòng khóa của mình.

(TRỐNG. Không còn nhánh nào đang dở: PR #86, #87, #88, #89, #90 đều đã merge.

⚠️ Migration của #88 (`20260826152436_email_verify_code`) đã được áp lên prod
lúc 27/08/2026, SAU khi merge - sai thứ tự, xem phiếu `20260827-02` §9. Hiện
`prisma migrate status` báo "up to date"; không còn nợ gì ở đây.

🟠 Việc còn lại KHÔNG phải của agent: deploy frontend Cloudflare
(`npm --workspace apps/frontend-main run deploy`) - Worker đang chạy vẫn là bản
dựng next@15 trong khi `main` đã là next@16.)
