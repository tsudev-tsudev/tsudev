-- Toà soạn Agent AI - tầng 3 của cơ chế chặn xoá.
--
-- Kế hoạch: docs/refactor-newsroom-agents.md §"RBAC và xoá mềm - ba tầng".
--
-- Vì sao cần tầng ở DB dù đã có hai tầng ở tầng ứng dụng: bốn service dùng CHUNG
-- một DATABASE_URL và một Prisma Client, nên không có ranh giới kết nối nào để
-- tách quyền của agent. Trigger là chỗ duy nhất mà một câu DELETE lọt lưới ở
-- tầng mã vẫn bị chặn.
--
-- Xoá cứng vẫn làm được, nhưng phải CỐ Ý, trong cùng một transaction:
--
--     BEGIN;
--     SET LOCAL tsudev.allow_hard_delete = 'on';
--     DELETE FROM "Post" WHERE id = '...';
--     COMMIT;
--
-- `SET LOCAL` hết hiệu lực khi transaction kết thúc, nên không có chuyện một
-- kết nối trong pool mang cờ này đi phục vụ request sau.
--
-- Cố ý KHÔNG gắn cho "Project": route DELETE /api/admin/projects/:slug hiện
-- đang xoá cứng và đang chạy được. Gắn trigger trước khi sửa route là làm hỏng
-- một tính năng đang dùng. Việc đó nằm ở đợt 5.
--
-- `prisma migrate reset` KHÔNG bị chặn: nó phát DROP SCHEMA chứ không phải
-- DELETE, và trigger chỉ gác BEFORE DELETE.

CREATE OR REPLACE FUNCTION tsudev_block_hard_delete() RETURNS trigger AS $$
BEGIN
  IF current_setting('tsudev.allow_hard_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'Xoá cứng bảng % bị chặn ở cấp database. Dùng xoá mềm (đặt deletedAt).',
      TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'Chủ dự án: BEGIN; SET LOCAL tsudev.allow_hard_delete = ''on''; ... COMMIT;';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_no_hard_delete
  BEFORE DELETE ON "Post"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();

CREATE TRIGGER doc_no_hard_delete
  BEFORE DELETE ON "Doc"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();

CREATE TRIGGER content_draft_no_hard_delete
  BEFORE DELETE ON "ContentDraft"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();

CREATE TRIGGER draft_revision_no_hard_delete
  BEFORE DELETE ON "DraftRevision"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();

CREATE TRIGGER newsroom_event_no_hard_delete
  BEFORE DELETE ON "NewsroomEvent"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();

-- AgentProfile được gác vì xoá một agent sẽ cascade sang AgentRun và làm mất
-- lịch sử hoạt động. Dùng `enabled = false` hoặc `suspendedAt` thay vì xoá.
CREATE TRIGGER agent_profile_no_hard_delete
  BEFORE DELETE ON "AgentProfile"
  FOR EACH ROW EXECUTE FUNCTION tsudev_block_hard_delete();
