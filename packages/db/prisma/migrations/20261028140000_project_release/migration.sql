-- Bản phát hành tải về được của dự án (ProjectRelease).
--
-- THUẦN BỔ SUNG: chỉ CREATE TYPE, CREATE TABLE, CREATE INDEX, ADD CONSTRAINT.
-- Không DROP, không RENAME, không đổi cột nào đang có. Mã cũ chạy bình thường
-- trên schema mới.
--
-- ⚠️ THỨ TỰ PHÁT HÀNH VẪN LÀ BẤT BIẾN, KỂ CẢ VỚI MIGRATION THUẦN BỔ SUNG:
--     `prisma migrate deploy` lên Neon TRƯỚC  →  merge `main` SAU.
--
-- Ngày 27/08/2026 PR #88 đã đảo thứ tự này và site chỉ sống nhờ HAI ĐIỀU MAY:
-- migration đó cũng thuần bổ sung, và Render chưa dựng xong bản mới tại thời
-- điểm đó. `logs/STATE.md` ghi lại nguyên văn sự cố suýt xảy ra. Đừng lấy "lần
-- trước cũng may" làm quy trình.
--
-- `Project.downloadUrl` CỐ Ý ĐƯỢC GIỮ LẠI, không migrate dữ liệu sang bảng mới
-- trong cùng migration này. Hai lý do: (a) một chuỗi URL trần không mang đủ
-- thông tin để dựng một hàng ProjectRelease hợp lệ - không có nền tảng, không có
-- phiên bản, không có checksum - nên mọi phép suy ra sẽ là bịa dữ liệu; (b) tách
-- việc di trú dữ liệu khỏi việc đổi schema giữ cho migration này quay lui được
-- bằng một câu DROP TABLE duy nhất.

-- CreateEnum
CREATE TYPE "ReleasePlatform" AS ENUM ('ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'WEB', 'SOURCE');

-- CreateEnum
CREATE TYPE "ReleaseChannel" AS ENUM ('STABLE', 'BETA', 'ALPHA');

-- CreateTable
CREATE TABLE "ProjectRelease" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "channel" "ReleaseChannel" NOT NULL DEFAULT 'STABLE',
    "platform" "ReleasePlatform" NOT NULL,
    "arch" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "sha256" TEXT,
    "signature" TEXT,
    "signingKid" TEXT,
    "releaseNotesMd" TEXT NOT NULL DEFAULT '',
    "minOsVersion" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRelease_projectId_publishedAt_idx" ON "ProjectRelease"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "ProjectRelease_deletedAt_idx" ON "ProjectRelease"("deletedAt");

-- CreateIndex
--
-- 🔴 `arch` PHẢI LÀ NOT NULL để ràng buộc này có tác dụng. Trong SQL
-- `NULL != NULL`, nên nếu `arch` cho phép NULL thì UNIQUE này KHÔNG chặn trùng ở
-- đúng trường hợp phổ biến nhất - bản phát hành không phân biệt kiến trúc.
--
-- Đã kiểm trực tiếp trên Postgres trước khi sửa: hai lượt INSERT cùng
-- (projectId, version, platform) với arch NULL đều lọt qua, cho ra hai hàng y
-- hệt nhau. Ràng buộc vẫn hiện trong `\d`, test trùng-lặp vẫn xanh (vì nó
-- truyền arch='arm64'), và không gì báo lỗi.
--
-- Chuỗi rỗng = không phân biệt kiến trúc. API công khai chuyển thành null.
CREATE UNIQUE INDEX "ProjectRelease_projectId_version_platform_arch_key" ON "ProjectRelease"("projectId", "version", "platform", "arch");

-- AddForeignKey
ALTER TABLE "ProjectRelease" ADD CONSTRAINT "ProjectRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
