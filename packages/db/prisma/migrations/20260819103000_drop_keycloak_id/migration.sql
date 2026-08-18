-- Xoá cột "User"."keycloakId" - mảnh cuối cùng của Keycloak trong dữ liệu.
--
-- Keycloak đã bị gỡ khỏi dự án; xác thực do codebase tự quản lý (mật khẩu
-- Argon2id trong DB, kiểm bởi auth-service - xem docs/auth.md). Cột này giữ lại
-- có chủ đích ở đợt trước để đợt phát hành đó THUẦN TÍNH CỘNG. Mọi giá trị
-- trong cột đều NULL và không dòng mã nào đọc nó, nên đây thuần tuý là dọn dẹp:
-- không có dữ liệu nào mất.
--
-- ⚠️ THỨ TỰ NGƯỢC VỚI KHI THÊM CỘT. Thêm cột thì migration đi trước, code đi
-- sau. XOÁ cột thì CODE PHẢI ĐI TRƯỚC:
--
--   1. Gỡ trường khỏi schema.prisma + `npm run db:generate`   ← commit này
--   2. Phát hành mã mới (Render dựng lại + deploy Worker)     ← phải XONG trước
--   3. `npm run db:migrate` nhắm Neon                          ← mới chạy tệp này
--
-- Vì sao không được đảo: `prisma migrate deploy` KHÔNG tự chạy lúc service khởi
-- động (docs/deployment.md), nên giữa lúc migration chạy và lúc service khởi
-- động lại, mã CŨ vẫn đang phục vụ - mà `GET /api/posts` dùng
-- `include: { author: true }`, tức Prisma SELECT mọi cột của User, kể cả cột
-- này. Chạy sớm là blog và trang bài viết 500, và `lib/api.ts` nuốt lỗi thành
-- [] nên triệu chứng là TRANG TRỐNG chứ không phải trang lỗi.

-- DropIndex
DROP INDEX "User_keycloakId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "keycloakId";
