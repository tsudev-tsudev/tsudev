// Áp lực ngược cho hàng đợi ý tưởng - van chặn hàng đợi lớn vô hạn, VÀ bảo đảm
// van đó không bỏ đói kênh chậm.
//
// Đo trên production 19/08/2026: 25 sự kiện `idea.created` còn PENDING và tăng
// đều. Số học vì sao: mỗi nhịp quét tối đa 3 nguồn × tới 20 tiêu đề, scout chọn
// ra vài ý tưởng - trong khi `tick()` chỉ xử lý `batch` sự kiện. Sinh nhanh hơn
// tiêu thì phần dư không bao giờ được tiêu.
//
// ⚠️ Van bản đầu là TOÀN CỤC, và đó là một lỗi đã trả giá. Trên hàng đợi nhiều
// kênh, một con số chung luôn bị kênh đông nguồn nhất chiếm hết. Đo prod
// 27/08/2026: BLOG (8 nguồn) giữ hàng đợi đầy liên tục - `scan.skipped` **119
// lần / 7 ngày** - nên nguồn DOC (1 nguồn, thêm sau) **chưa từng được quét lần
// nào**. `TopicIdea`: 220 BLOG, 9 PROJECT, **0 DOC**. Hệ quả là `/docs` không có
// bài nào của agent, trong khi nhánh đăng DOC vẫn nằm trong mã và trông hoàn
// chỉnh - toà soạn vẫn báo "đang chạy", chỉ là một kênh không bao giờ tới lượt.
//
// Test này quét NGUỒN chứ không chạy dispatcher: chạy thật đòi một database có
// nguồn tin, một mô hình LLM và mạng ra ngoài - ba thứ không có trong bộ test
// đơn vị. Thứ cần khoá ở đây là HÌNH DẠNG của thuật toán:
//
//   1. Có trần, và trần là hằng số đặt tên chứ không phải số rơi giữa mã.
//   2. Đếm hàng đợi xảy ra TRƯỚC lượt gọi mô hình đầu tiên - đó là chỗ rẻ nhất
//      để dừng, và đặt sau thì van vẫn tiêu Neuron mỗi lượt.
//   3. Trần tính THEO KÊNH, và quyết định bỏ qua đọc `target` của từng nguồn.
//   4. Thứ tự quét ưu tiên nguồn lâu chưa quét nhất, NULL trước hết.
import { readFileSync } from 'fs'
import { join } from 'path'

export {}

const SRC = readFileSync(join(__dirname, '../src/dispatcher.ts'), 'utf8')
const SCAN = (() => {
  const fn = SRC.slice(SRC.indexOf('async function scanSources'))
  return fn.slice(0, fn.indexOf('\n}\n'))
})()

describe('áp lực ngược của hàng đợi ý tưởng', () => {
  test('có hằng trần được đặt tên, không phải số trần trong mã', () => {
    expect(SRC).toMatch(/const IDEA_QUEUE_CAP_PER_TARGET = \d+/)
  })

  test('scanSources đếm hàng đợi và trả về sớm khi đầy', () => {
    expect(SCAN).toContain('IDEA_QUEUE_CAP_PER_TARGET')
    expect(SCAN).toMatch(/return\b/)
  })

  test('đếm hàng đợi xảy ra TRƯỚC khi gọi scout', () => {
    const guard = SCAN.indexOf('pendingIdeasByTarget')
    const firstModelCall = SCAN.indexOf('agentBySlug')
    expect(guard).toBeGreaterThan(-1)
    expect(firstModelCall).toBeGreaterThan(-1)
    // Đặt van SAU lượt gọi mô hình thì nó vẫn tiêu Neuron mỗi nhịp - tức là
    // van chỉ chặn được hàng đợi, không chặn được chi phí.
    expect(guard).toBeLessThan(firstModelCall)
  })

  test('phát sự kiện khi bỏ quét, để còn lần được vì sao toà soạn im', () => {
    // Bỏ quét trong im lặng thì "hôm nay không có bài mới" không phân biệt được
    // với "toà soạn hỏng".
    expect(SRC).toContain("'scan.skipped'")
  })
})

describe('van KHÔNG được bỏ đói kênh chậm', () => {
  test('trần đếm theo TỪNG KÊNH, không phải một con số chung', () => {
    // Hàm đếm phải nhóm theo `target`; đếm phẳng là quay lại đúng lỗi cũ.
    const counter = SRC.slice(SRC.indexOf('async function pendingIdeasByTarget'))
    expect(counter).toContain("by: ['target']")
    expect(SRC).not.toMatch(/const IDEA_QUEUE_CAP = \d+/)
  })

  test('quyết định bỏ qua đọc target của TỪNG nguồn', () => {
    // Không có `s.target` trong phép lọc thì trần lại thành toàn cục, dù tên
    // hằng có chữ PER_TARGET.
    expect(SCAN).toMatch(/pending\[String\(s\.target\)\]/)
  })

  test('nguồn LÂU CHƯA QUÉT NHẤT đi trước, chưa quét lần nào đi trước hết', () => {
    // Postgres mặc định xếp NULL ở CUỐI khi sắp tăng dần, nên `nulls: 'first'`
    // là phần bắt buộc: thiếu nó thì nguồn mới thêm - đúng những nguồn chưa từng
    // chạy - lại xuống cuối hàng, và đó chính là cách nguồn DOC bị bỏ đói.
    expect(SCAN).toContain('orderBy:')
    expect(SCAN).toMatch(/lastScanAt:\s*\{\s*sort:\s*'asc',\s*nulls:\s*'first'\s*\}/)
  })

  test('vòng quét chạy trên danh sách ĐÃ LỌC, không phải danh sách thô', () => {
    // Lọc xong rồi vẫn lặp trên `due` thì phép lọc chỉ là trang trí.
    expect(SCAN).toMatch(/for \(const src of eligible\)/)
    expect(SCAN).not.toMatch(/for \(const src of due\)/)
  })

  test('số nguồn mỗi nhịp là hằng đặt tên, không phải take: 3 giữa truy vấn', () => {
    expect(SRC).toMatch(/const SOURCES_PER_SCAN = \d+/)
    expect(SCAN).toContain('SOURCES_PER_SCAN')
  })
})
