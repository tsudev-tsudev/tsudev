// Cổng chặn LỆCH MIGRATION lúc khởi động.
//
// Vì sao tồn tại: `prisma migrate deploy` KHÔNG tự chạy khi service lên
// (docs/deployment.md §Migration khi deploy) - nó là bước THỦ CÔNG chạy từ máy
// dev trước khi phát hành. Bước thủ công thì có ngày bị quên, và ngày đó đã
// đến: migration `20260825165439_dau_vet_dang_nhap` thêm ba cột vào `User`
// nhưng không được chạy trên prod, nên client đã sinh sẵn cứ SELECT chúng.
//
// Triệu chứng của lần đó là bài học: KHÔNG có gì đỏ lên. `count` chạy, facet
// (`select: { tags: true }`) chạy, bài không có tác giả chạy - chỉ những truy
// vấn thực sự chạm bảng `User` mới nổ, và `lib/api.ts` nuốt lỗi thành `[]` nên
// `/blog` và `/feed.xml` chỉ TRỐNG. Lỗi sống ba ngày trên trang công khai.
//
// Vì thế cổng này ồn ào có chủ đích: thiếu một migration ⇒ tiến trình KHÔNG lên.
// Cùng tinh thần với TRUST_SIGNING_KEY - thà chết ồn ào còn hơn phục vụ sai.
//
// ⚠️ Hệ quả vận hành, biết trước thì không bất ngờ: Render autoDeploy dựng lại
// khi merge vào `main`. Merge một PR có migration mà CHƯA chạy `npm run
// db:migrate` với `DATABASE_URL` của prod ⇒ site SẬP HẲN chứ không hỏng một
// phần. Thứ tự phát hành bắt buộc: chạy migration TRƯỚC, merge SAU.
//
// KHÔNG chặn khi chỉ là không kiểm được (DB ngủ, mạng chập, quyền đọc thiếu):
// "không biết" khác "biết là lệch". Trường hợp đó chỉ cảnh báo rồi cho chạy
// tiếp - biến một sự cố mạng thoáng qua thành sập site là đổi một lỗi im lặng
// lấy một lỗi ồn ào hơn nhưng SAI.

import fs from 'fs'
import path from 'path'

type Notifier = { alert: (payload: Record<string, unknown>) => Promise<void> }
let notify: Notifier = { alert: async () => {} }
try {
  notify = require('../../../packages/observability/notify')
} catch (e) {
  /* observability không bắt buộc */
}

/** Tên thư mục migration NẰM TRONG IMAGE - tức bản mà mã đang chạy giả định đã
 *  có trên DB. `docker/backend-service.Dockerfile` COPY nguyên `packages/` nên
 *  thư mục này có mặt lúc chạy; không có nó thì không kết luận được gì. */
export function bundledMigrations(): string[] {
  const dir = path.join(
    path.dirname(require.resolve('@tsudev/db/package.json')),
    'prisma',
    'migrations'
  )
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

type Client = { $queryRawUnsafe: (sql: string) => Promise<unknown> }

/** Migration đã áp dụng XONG và chưa bị rollback. `_prisma_migrations` là bảng
 *  sổ sách của chính Prisma; đọc thẳng vì client sinh ra không mô hình hoá nó. */
async function appliedMigrations(db: Client): Promise<string[]> {
  const rows = (await db.$queryRawUnsafe(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  )) as { migration_name: string }[]
  return rows.map((r) => r.migration_name)
}

/**
 * Trả về danh sách migration THIẾU trên DB, hoặc `null` khi không kiểm được.
 * Tách khỏi phần quyết định sống/chết để test được mà không phải giết tiến trình.
 */
export async function missingMigrations(db: Client): Promise<string[] | null> {
  let bundled: string[]
  try {
    bundled = bundledMigrations()
  } catch (e) {
    console.warn(
      '[bundle] không đọc được thư mục migration trong image - bỏ qua cổng lệch migration'
    )
    return null
  }
  let applied: string[]
  try {
    applied = await appliedMigrations(db)
  } catch (e) {
    // DB ngủ, mạng chập, hoặc `_prisma_migrations` chưa tồn tại vì chưa migrate
    // lần nào. Hai cái đầu không phải lệch; cái thứ ba thì migration ĐẦU TIÊN
    // cũng sẽ nổ ngay ở truy vấn thật, nên không cần cổng này bắt.
    console.warn(
      '[bundle] không đọc được _prisma_migrations - bỏ qua cổng lệch migration:',
      e instanceof Error ? e.message : e
    )
    return null
  }
  const have = new Set(applied)
  return bundled.filter((m) => !have.has(m))
}

/**
 * Chặn khởi động khi DB thiếu migration mà mã đang chạy đã giả định là có.
 * Gọi TRƯỚC `listen()`; thoát bằng `exit(1)` để Render đánh dấu deploy hỏng thay
 * vì cho một tiến trình phục vụ nửa vời đi qua health check.
 */
export async function assertSchemaUpToDate(db: Client): Promise<void> {
  const missing = await missingMigrations(db)
  if (!missing || missing.length === 0) return
  const message = `DB thiếu ${missing.length} migration: ${missing.join(
    ', '
  )}. Chạy \`DATABASE_URL=<prod> npm run db:migrate\` TRƯỚC khi phát hành.`
  console.error('[bundle] LỆCH MIGRATION -', message)
  await notify
    .alert({
      service: 'backend-bundle',
      level: 'error',
      message,
      context: 'startup schema gate',
    })
    .catch(() => {})
  process.exit(1)
}
