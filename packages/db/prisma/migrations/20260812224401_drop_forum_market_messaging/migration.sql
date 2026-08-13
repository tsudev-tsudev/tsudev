-- Gỡ Diễn đàn, Chợ ký quỹ, Tin nhắn và Kiểm duyệt khỏi lược đồ.
--
-- CỬA MỘT CHIỀU. 14 bảng + 6 enum + hai cột của User biến mất. Dữ liệu đã
-- được xuất ra backup/legacy-<ngày>/ bằng scripts/export-legacy-data.js TRƯỚC
-- khi migration này chạy lần đầu — đó là đường lùi duy nhất.
--
-- User.reputation: điểm uy tín thành viên là cơ chế của diễn đàn. Uy tín nay
-- là thuộc tính của TrustOrganization, dẫn ra từ 8 bảng Trust* đã có.
-- User.signature: chữ ký chân bài diễn đàn. Không nhầm với
-- TrustCertificate.signature (chữ ký Ed25519) — bảng đó giữ nguyên.
-- User.credits GIỮ LẠI: trust-service thu phí nộp đơn cấp dấu bằng cột này.
--
-- Kế hoạch: docs/refactor-personal-site.md §2.3 và GĐ 4.

-- DropForeignKey
ALTER TABLE "Board" DROP CONSTRAINT "Board_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_threadId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_listingId_fkey";

-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_postId_fkey";

-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReputationEvent" DROP CONSTRAINT "ReputationEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_boardId_fkey";

-- DropIndex
DROP INDEX "User_reputation_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "reputation",
DROP COLUMN "signature";

-- DropTable
DROP TABLE "Ban";

-- DropTable
DROP TABLE "Board";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "ConversationParticipant";

-- DropTable
DROP TABLE "ForumPost";

-- DropTable
DROP TABLE "Listing";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "ModAction";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "Reaction";

-- DropTable
DROP TABLE "Report";

-- DropTable
DROP TABLE "ReputationEvent";

-- DropTable
DROP TABLE "Thread";

-- DropEnum
DROP TYPE "ListingStatus";

-- DropEnum
DROP TYPE "ModActionType";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "ReactionType";

-- DropEnum
DROP TYPE "ReportStatus";

-- DropEnum
DROP TYPE "ReportTargetType";

