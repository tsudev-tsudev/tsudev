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

/** Mã nguồn Worker, để khẳng định nhịp DÀY không gọi đường nào chạm database. */
const workerSource = (): string => read('src/index.ts')

/** Bảng ngưỡng của bản chạy trong Worker. */
const demSource = (): string => read('src/demNoiDung.ts')

// Cột phút dạng bước (dấu hoa thị, gạch chéo, số) = nhịp DÀY (giữ ấm). Mọi dạng
// khác = nhịp THƯA.
//
// ⚠️ KHÔNG viết chuỗi cron đó ra trong một khối chú thích `/** */`: nó chứa dấu
// ĐÓNG comment và sẽ cắt cụt khối, làm phần còn lại thành mã TypeScript sai cú
// pháp. `wrangler.jsonc` đã ghi cảnh báo này và tôi vẫn mắc lại - nên nó được
// nhắc ở cả hai chỗ.
const laNhipDay = (c: string): boolean => /^\*\/\d+$/.test(c.split(' ')[0] ?? '')

describe('Worker cron - nhịp DÀY không được chạm database', () => {
  test('có đúng hai nhịp: một dày (giữ ấm), một thưa (đếm nội dung)', () => {
    // Con số cứng là có chủ đích: thêm nhịp mới phải sửa test này TƯỜNG MINH,
    // và lúc đó người sửa buộc phải trả lời câu "nhịp mới có chạm DB không".
    const crons = cronsFromWrangler()
    expect(crons).toHaveLength(2)
    expect(crons.filter(laNhipDay)).toHaveLength(1)
    expect(crons.filter((c) => !laNhipDay(c))).toHaveLength(1)
  })

  test('nhịp giữ ấm dày hơn 15 phút, nếu không Render vẫn ngủ', () => {
    const keepWarm = cronsFromWrangler().find(laNhipDay) as string
    const step = (keepWarm.split(' ')[0] ?? '').match(/^\*\/(\d+)$/)
    expect(step).not.toBeNull()
    expect(Number(step![1])).toBeLessThan(15)
  })

  test('khung nghỉ của nhịp giữ ấm viết bằng giờ UTC, không phải `*`', () => {
    // Giữ ấm 24/7 tiêu 744 trên 750 giờ instance/tháng của CẢ workspace Render.
    const hours = (cronsFromWrangler().find(laNhipDay) as string).split(' ')[1]
    expect(hours).not.toBe('*')
  })

  test('nhịp đếm nội dung chạy TỐI ĐA 4 lượt/ngày', () => {
    // 🔴 Khẳng định đắt nhất của tệp này. Các trang mà cổng đếm đo là SSR: mỗi
    // lượt fetch đi Worker → Render → Neon và giữ Neon thức thêm ~5 phút. Cắm nó
    // vào nhịp 5 phút = 288 lượt/ngày = Neon không bao giờ ngủ = ~186 CU-giờ/tháng
    // trên hạn mức 100 ⇒ ĐÚNG cái bẫy đã làm site trống hai tháng, chỉ lần này
    // do chính cổng canh gây ra.
    const thua = cronsFromWrangler().find((c) => !laNhipDay(c)) as string
    const gio = (thua.split(' ')[1] ?? '').split(',')
    expect(gio.length).toBeLessThanOrEqual(4)
    // Và cột phút phải là một giá trị đơn, không phải `*` hay `*/n`.
    expect(thua.split(' ')[0]).toMatch(/^\d+$/)
  })

  test('nhịp đếm nội dung chạy TRONG khung thức của Render', () => {
    // Ngoài khung thức thì mỗi lượt đo đánh thức Render khỏi khung nghỉ và cộng
    // thêm ~15 phút giờ instance - tức cổng canh tự ăn vào ngân sách 750 giờ.
    const crons = cronsFromWrangler()
    const day = (crons.find(laNhipDay) as string).split(' ')[1] ?? ''
    const thua = (crons.find((c) => !laNhipDay(c)) as string).split(' ')[1] ?? ''
    const khungThuc = new Set(
      day.split(',').flatMap((phan) => {
        const m = phan.match(/^(\d+)-(\d+)$/)
        if (!m) return [Number(phan)]
        const ra: number[] = []
        for (let i = Number(m[1]); i <= Number(m[2]); i++) ra.push(i)
        return ra
      })
    )
    for (const g of thua.split(',')) expect(khungThuc.has(Number(g))).toBe(true)
  })

  test('nhịp đếm nội dung trùng nguyên văn hằng trong mã', () => {
    // Lệch một ký tự thì lượt đếm rơi xuống nhánh giữ ấm: Worker vẫn chạy, log
    // vẫn xanh, Render vẫn được gõ cửa - chỉ có cổng đếm là không bao giờ chạy.
    // Đúng cách hỏng im lặng mà bản trước của tệp này đã canh cho `TICK_CRON`.
    const m = workerSource().match(/const CRON_DEM_NOI_DUNG = '([^']+)'/)
    expect(m?.[1]).toBeDefined()
    expect(cronsFromWrangler()).toContain(m![1])
  })

  test('nhịp GIỮ ẤM chỉ gọi /health trên BACKEND_URL', () => {
    const src = workerSource()
    const goiBackend = [...src.matchAll(/\$\{env\.BACKEND_URL\}([^`'"]*)/g)].map((m) => m[1])
    expect(goiBackend.length).toBeGreaterThan(0)
    for (const duong of goiBackend) expect(duong).toBe('/health')
  })

  test('không còn khai TICK_CRON - nhịp toà soạn đã gỡ hẳn', () => {
    expect(workerSource()).not.toContain('TICK_CRON')
  })
})

describe('bảng ngưỡng của cổng đếm không được trôi lệch khỏi script Node', () => {
  // Bảng bị TRÙNG LẶP có chủ đích: script Node đọc `config/topology.json` bằng
  // `require` và dùng `process.argv`, cả hai không tồn tại trong workerd; gộp
  // lại thành một package dùng chung thì phải dựng workspace mới cho bốn mươi
  // dòng logic thuần.
  //
  // Nên trùng lặp được canh ở đây. Trùng lặp có cổng canh khác hẳn trùng lặp
  // trôi tự do - và chính repo này đã trả giá cho loại thứ hai: bản sao cục bộ
  // của bảng token ở lại v1.0.0 trong khi bản chuẩn đi tới v2.0.0, và không cổng
  // nào bắt được vì mỗi cổng chỉ đối chiếu bản sao với chính nó.
  const SCRIPT = join(__dirname, '../../../scripts/dem-noi-dung-prod.js')

  /** Bóc cặp (đường, ngưỡng) từ một nguồn, giữ nguyên thứ tự khai. */
  const capTu = (src: string): string[] =>
    [...src.matchAll(/duong:\s*'([^']+)'[\s\S]*?toiThieu:\s*(\d+)/g)].map(
      (m) => `${m[1]} >= ${m[2]}`
    )

  test('cùng số phép đo, cùng đường, cùng ngưỡng, cùng thứ tự', () => {
    const cuaWorker = capTu(demSource())
    const cuaScript = capTu(readFileSync(SCRIPT, 'utf8'))
    expect(cuaWorker.length).toBeGreaterThan(0)
    expect(cuaWorker).toEqual(cuaScript)
  })
})
