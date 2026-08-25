-- Đưa Doc vào chỉ mục tìm kiếm (DOCS-SEARCH), theo SEARCH_AND_FILTER.md §9.
--
-- Trước migration này `buildPostSearch` chỉ chạy cho Post, nên tài liệu do Toà
-- soạn Agent AI viết đọc được ở /docs mà KHÔNG tìm thấy qua ô tìm kiếm.
--
-- ⚠️ Migration là BẤT BIẾN sau khi áp - mọi chỉnh sửa sau đó lệch checksum, prod
-- không boot. Cần đổi thì tạo migration mới.
--
-- ⚠️ THỨ TỰ PHÁT HÀNH: chạy migration này trên prod TRƯỚC khi merge/deploy
-- (docs/deployment.md §Migration). Cổng chặn lệch migration lúc khởi động làm
-- SẬP CẢ SITE nếu đảo thứ tự.

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "searchBodyNorm" TEXT,
ADD COLUMN     "searchTitleNorm" TEXT;

-- Extension đã được tạo ở migration 20260824043047 (Post). `IF NOT EXISTS` để
-- migration này chạy được cả trên CSDL dựng lại từ đầu lẫn CSDL đã có sẵn.
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Index trigram trên cột đã CHUẨN HOÁ (không dấu), đối xứng với cặp index của
-- Post. Cho phép `ILIKE '%...%'` chạy nhanh mà không quét toàn bảng.
CREATE INDEX "Doc_searchTitleNorm_trgm_idx" ON "Doc" USING GIN ("searchTitleNorm" gin_trgm_ops);
CREATE INDEX "Doc_searchBodyNorm_trgm_idx" ON "Doc" USING GIN ("searchBodyNorm" gin_trgm_ops);
