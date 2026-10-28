// Hợp đồng của Worker cron - canh bằng test vì nó hỏng IM LẶNG.
//
// 🔴 HỢP ĐỒNG ĐÃ ĐỔI 29/10/2026. Bản trước canh chuyện khác.
//
// Trước: Worker có HAI nhịp và `src/index.ts` phân nhánh bằng
// `event.cron === TICK_CRON`. Test canh việc chuỗi đó trùng nguyên văn một phần
// tử trong `wrangler.jsonc`, vì lệch một ký tự thì lượt tick rơi xuống nhánh giữ
// ấm và toà soạn đứng yên vĩnh viễn mà không gì báo lỗi.
//
// Nay nhịp đập của Toà soạn **đã bị gỡ** cùng toàn bộ cơ chế Toà soạn Agent AI
// (docs/refactor-tsudev-2026-q4.md §8). Còn MỘT nhịp: giữ ấm Render.
//
// Nhưng test này KHÔNG mất lý do tồn tại - nó chỉ đổi câu hỏi. Câu hỏi mới quan
// trọng hơn câu cũ:
//
//   **"Có nhịp cron nào chạm DATABASE không?"**
//
// Vì đó mới là thứ đã làm cả site trống hai tháng: một nhịp truy vấn database
// theo lịch giữ Neon thức, và Neon free chỉ cho 100 CU-giờ/tháng. Nhịp 5 phút
// gọi `GET /health` - route trả JSON tĩnh, không đụng Prisma - nên nó an toàn.
// Đổi nó sang một endpoint chạm database "cho chắc backend còn sống" là dựng lại
// đúng cái bẫy vừa gỡ, ở dạng dày hơn 12 lần.
//
// Ba khẳng định dưới đây vì thế canh: còn đúng một nhịp · nhịp đó đủ dày để giữ
// ấm · và Worker không gọi đường nào chạm database.
//
// Test nằm ở newsroom-service chứ không ở infrastructure/newsroom-cron vì thư
// mục đó không phải workspace và không có bộ chạy test nào.
//
// ⚠️ Khi §8 gỡ hẳn `newsroom-service`, **CHUYỂN test này sang workspace khác**
// (ví dụ `backend-bundle`) chứ đừng xoá nó cùng service. Nó nay canh hạn mức
// Neon, không canh toà soạn.
import { readFileSync } from 'fs'
import { join } from 'path'

const CRON_DIR = join(__dirname, '../../../infrastructure/newsroom-cron')

const read = (f: string) => readFileSync(join(CRON_DIR, f), 'utf8')

/** Đọc mảng `triggers.crons` từ JSONC. Không JSON.parse được: tệp có chú thích. */
const cronsFromWrangler = (): string[] => {
  const m = read('wrangler.jsonc').match(/"crons"\s*:\s*\[([^\]]*)\]/)
  if (!m?.[1]) throw new Error('wrangler.jsonc không còn khai triggers.crons')
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1] as string)
}

/** Mã nguồn Worker, để khẳng định nó không gọi endpoint nào chạm database. */
const workerSource = (): string => read('src/index.ts')

describe('Worker cron - không nhịp nào được chạm database', () => {
  test('còn đúng MỘT nhịp', () => {
    // Nhịp thứ hai (toà soạn, chạm DB) đã bị gỡ. Thêm nhịp mới thì phải sửa test
    // này một cách TƯỜNG MINH - đó là điểm của con số cứng ở đây.
    expect(cronsFromWrangler()).toHaveLength(1)
  })

  test('nhịp giữ ấm dày hơn 15 phút, nếu không Render vẫn ngủ', () => {
    const keepWarm = cronsFromWrangler()[0] as string
    // Render free ngủ sau ~15 phút không có request. Chỉ chấp nhận dạng bước
    // phút `*/n` với n < 15; một nhịp theo giờ ở cột này là mất hẳn việc giữ ấm.
    const step = (keepWarm.split(' ')[0] ?? '').match(/^\*\/(\d+)$/)
    expect(step).not.toBeNull()
    expect(Number(step![1])).toBeLessThan(15)
  })

  test('khung nghỉ viết bằng giờ UTC, không phải `*`', () => {
    // Giữ ấm 24/7 tiêu 744 trên 750 giờ instance/tháng của CẢ workspace Render.
    // Mất khung nghỉ là mất biên an toàn, và hệ quả là Render tạm dừng MỌI service.
    const hours = (cronsFromWrangler()[0] as string).split(' ')[1]
    expect(hours).not.toBe('*')
  })

  test('Worker KHÔNG gọi endpoint nào chạm database', () => {
    const src = workerSource()
    // `/health` của backend-bundle trả JSON tĩnh. Mọi đường khác dưới `/api/`
    // đều đi qua Prisma, nên một lượt gọi theo lịch tới đó sẽ giữ Neon thức.
    const goiDi = [...src.matchAll(/\$\{env\.BACKEND_URL\}([^`'"]*)/g)].map((m) => m[1])
    expect(goiDi.length).toBeGreaterThan(0)
    for (const duong of goiDi) {
      expect(duong).toBe('/health')
    }
  })

  test('không còn khai TICK_CRON - nhịp toà soạn đã gỡ hẳn', () => {
    // Nếu hằng đó quay lại thì nhịp chạm DB cũng sắp quay lại. Bắt ở đây, trước
    // khi nó kịp lên production.
    expect(workerSource()).not.toContain('TICK_CRON')
  })
})
