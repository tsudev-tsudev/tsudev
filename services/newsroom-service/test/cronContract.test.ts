// Hợp đồng giữa hai tệp của Worker cron, canh bằng test vì nó hỏng IM LẶNG.
//
// `src/index.ts` phân nhánh bằng `event.cron === TICK_CRON`. Chuỗi đó phải trùng
// NGUYÊN VĂN một phần tử trong `triggers.crons` của `wrangler.jsonc`. Lệch một
// ký tự thì lượt tick rơi xuống nhánh giữ ấm: Worker vẫn chạy, log vẫn xanh,
// Render vẫn được gõ cửa - chỉ có toà soạn là đứng yên vĩnh viễn. Không có gì
// báo lỗi, và triệu chứng ("lâu rồi không thấy bài mới") xuất hiện cách nguyên
// nhân nhiều ngày.
//
// Rủi ro này vừa tăng lên: hai chuỗi cron nay mang khung nghỉ đêm `0-17,23` nên
// dài hơn và dễ chép lệch hơn hẳn `7 * * * *`.
//
// Test nằm ở newsroom-service chứ không ở infrastructure/newsroom-cron vì thư
// mục đó không phải workspace và không có bộ chạy test nào - còn nhịp đập là
// hợp đồng của chính service này.
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

const tickCronFromSource = (): string => {
  const m = read('src/index.ts').match(/const TICK_CRON = '([^']+)'/)
  if (!m?.[1]) throw new Error('src/index.ts không còn khai TICK_CRON')
  return m[1]
}

describe('Worker cron - hai tệp phải nói cùng một chuyện', () => {
  test('TICK_CRON trùng nguyên văn một trigger đã khai', () => {
    expect(cronsFromWrangler()).toContain(tickCronFromSource())
  })

  test('có đúng hai nhịp: một tick, một giữ ấm', () => {
    const crons = cronsFromWrangler()
    expect(crons).toHaveLength(2)
    expect(crons.filter((c) => c !== tickCronFromSource())).toHaveLength(1)
  })

  test('nhịp giữ ấm dày hơn 15 phút, nếu không Render vẫn ngủ', () => {
    const keepWarm = cronsFromWrangler().find((c) => c !== tickCronFromSource())!
    // Render free ngủ sau ~15 phút không có request. Chỉ chấp nhận dạng bước
    // phút `*/n` với n < 15; một nhịp theo giờ ở cột này là mất hẳn việc giữ ấm.
    const step = (keepWarm.split(' ')[0] ?? '').match(/^\*\/(\d+)$/)
    expect(step).not.toBeNull()
    expect(Number(step![1])).toBeLessThan(15)
  })

  test('CẢ HAI nhịp cùng nghỉ một khung giờ, và khung đó viết bằng giờ UTC', () => {
    // Nhịp toà soạn cũng là một request tới Render. Để nó chạy 24/7 trong khi
    // nhịp giữ ấm nghỉ thì Render vẫn thức ~15 phút mỗi giờ đêm, và khung nghỉ
    // chỉ tiết kiệm được một phần tư số giờ đã tính trong docs/free-tier.md.
    const hours = cronsFromWrangler().map((c) => c.split(' ')[1])
    expect(hours[0]).toBe(hours[1])
    expect(hours[0]).not.toBe('*')
  })
})
