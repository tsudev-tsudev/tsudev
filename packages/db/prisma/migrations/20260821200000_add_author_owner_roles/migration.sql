-- Thêm hai bậc vai trò vào enum "Role":
--   AUTHOR - tài khoản đăng bài (đặc quyền tối thiểu, KHÔNG có quyền quản trị khác).
--   OWNER  - quản trị cao nhất, chỉ tài khoản tsudev giữ. Cấp bằng seed/DB,
--            KHÔNG bao giờ cấp được qua bất kỳ endpoint dữ liệu nào.
--
-- ⚠️ THÊM enum value là THUẦN CỘNG (không xoá, không đổi cột) nên migration đi
-- TRƯỚC, code dùng giá trị mới đi SAU cũng được - nhưng ở đợt này ta phát hành
-- CÙNG LÚC (code đọc AUTHOR/OWNER và migration này). Trên PostgreSQL 12+ (Neon
-- là 15) "ALTER TYPE ... ADD VALUE" chạy được trong transaction của Prisma vì
-- giá trị mới KHÔNG được dùng ngay trong chính migration này.

ALTER TYPE "Role" ADD VALUE 'AUTHOR';
ALTER TYPE "Role" ADD VALUE 'OWNER';
