-- Nâng cấp Post: xuất bản/lên lịch (publishedAt), nội dung nâng cao
-- (references, coverImageUrl, metaDescription) và chỉ mục tìm kiếm tiếng Việt
-- (searchTitleNorm, searchBodyNorm) theo SEARCH_AND_FILTER.md.
--
-- ⚠️ Migration là BẤT BIẾN sau khi áp - mọi chỉnh sửa sau đó lệch checksum, prod
-- không boot. Cần đổi thì tạo migration mới.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "references" JSONB,
ADD COLUMN     "searchBodyNorm" TEXT,
ADD COLUMN     "searchTitleNorm" TEXT;

-- Backfill: bài cũ lấy chính createdAt làm ngày hiển thị, để đường đọc công khai
-- (xếp theo publishedAt, fallback createdAt) không mất bài nào và lịch không tự
-- ẩn dữ liệu lịch sử. Bài mới do app đặt publishedAt tường minh.
UPDATE "Post" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;

-- Extension cho tìm kiếm không dấu + gần đúng. unaccent phục vụ chuẩn hoá phía
-- SQL nếu cần; pg_trgm cấp toán tử similarity + index GIN cho cột đã chuẩn hoá.
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Post_published_publishedAt_idx" ON "Post"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "Post_tags_idx" ON "Post" USING GIN ("tags");

-- Index trigram trên cột đã CHUẨN HOÁ (không dấu). Cho phép `ILIKE '%...%'` và
-- similarity chạy nhanh mà không quét toàn bảng - so khớp luôn trên bản không
-- dấu do @tsudev/search tính sẵn lúc ghi, KHÔNG trên title/contentMd thô.
CREATE INDEX "Post_searchTitleNorm_trgm_idx" ON "Post" USING GIN ("searchTitleNorm" gin_trgm_ops);
CREATE INDEX "Post_searchBodyNorm_trgm_idx" ON "Post" USING GIN ("searchBodyNorm" gin_trgm_ops);
