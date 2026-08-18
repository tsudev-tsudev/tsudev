-- Gắn trigger chặn xoá cứng cho bảng "Project".
--
-- CỐ Ý tách khỏi migration 20260817220700_newsroom_no_hard_delete và chạy SAU
-- migration 20260817223903_project_soft_delete.
--
-- Lý do thứ tự: khi cụm trigger đầu tiên được viết, route
-- DELETE /api/admin/projects/:slug vẫn đang xoá CỨNG và đang chạy được trên
-- production. Gắn trigger lúc đó là biến một tính năng đang dùng thành lỗi 500.
--
-- Thứ tự bắt buộc, đã thực hiện đúng:
--   1. Thêm cột Project.deletedAt          (migration ..._project_soft_delete)
--   2. Đổi route sang đặt deletedAt        (services/content-service)
--   3. Phát hành mã mới                     ← phải xong TRƯỚC bước 4 ở production
--   4. Gắn trigger                          (migration này)
--
-- ⚠️ Ở PRODUCTION, đừng chạy migration này cùng lượt với bước 1-2. Giữa lúc
-- migration chạy và lúc service khởi động lại, mã CŨ vẫn đang phục vụ - và mã
-- cũ vẫn phát lệnh DELETE. Chạy sớm là mọi lượt xoá dự án 500 trong cửa sổ đó.

CREATE TRIGGER project_no_hard_delete
  BEFORE DELETE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();
