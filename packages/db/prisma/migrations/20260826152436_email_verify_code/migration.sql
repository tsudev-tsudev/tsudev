-- Xác minh tài khoản bằng MÃ SỐ (VERIFY-CODE).
--
-- Đăng nhập bằng Google/GitHub từ nay KHÔNG còn được đánh dấu đã xác minh ngay.
-- Người dùng bấm "Xác minh tài khoản" ở /settings/profile, hệ thống gửi mã 6 số
-- về đúng địa chỉ đó, và người dùng gõ lại mã.
--
-- `attempts` là thứ DUY NHẤT đứng giữa một mã 6 số và việc dò cạn 10^6 khả năng.
-- Chặn tần suất GỬI không thay được nó: kẻ tấn công không cần gửi thêm mã nào,
-- chỉ cần gõ liên tục vào một mã đang có hiệu lực.
--
-- ⚠️ Migration là BẤT BIẾN sau khi áp - mọi chỉnh sửa sau đó lệch checksum, prod
-- không boot. Cần đổi thì tạo migration mới.
--
-- ⚠️ THỨ TỰ PHÁT HÀNH: chạy migration này trên prod TRƯỚC khi merge/deploy.
-- Cổng chặn lệch migration lúc khởi động làm SẬP CẢ SITE nếu đảo thứ tự.

-- AlterEnum
ALTER TYPE "AuthTokenPurpose" ADD VALUE 'EMAIL_VERIFY_CODE';

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;
