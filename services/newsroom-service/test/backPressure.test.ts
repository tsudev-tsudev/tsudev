// Áp lực ngược cho hàng đợi ý tưởng - van chặn hàng đợi lớn vô hạn.
//
// Đo trên production 19/08/2026: 25 sự kiện `idea.created` còn PENDING và tăng
// đều. Số học vì sao: mỗi nhịp quét tối đa 3 nguồn × tới 20 tiêu đề, scout chọn
// ra vài ý tưởng - trong khi `tick()` chỉ xử lý `batch` sự kiện. Sinh nhanh hơn
// tiêu thì phần dư không bao giờ được tiêu.
//
// Test này quét NGUỒN chứ không chạy dispatcher: chạy thật đòi một database có
// nguồn tin, một mô hình LLM và mạng ra ngoài - ba thứ không có trong bộ test
// đơn vị. Thứ cần khoá ở đây là HÌNH DẠNG của thuật toán:
//
//   1. Có trần, và trần là hằng số đặt tên chứ không phải số rơi giữa mã.
//   2. Đếm hàng đợi xảy ra TRƯỚC lượt gọi mô hình đầu tiên - đó là chỗ rẻ nhất
//      để dừng, và đặt sau thì van vẫn tiêu Neuron mỗi lượt.
//   3. `batch` không nhỏ hơn... không, không ràng buộc `batch`: trần Neuron mới
//      là van chi phí thật. Chỉ khoá rằng áp lực ngược tồn tại.
import { readFileSync } from 'fs'
import { join } from 'path'

export {}

const SRC = readFileSync(join(__dirname, '../src/dispatcher.ts'), 'utf8')

describe('áp lực ngược của hàng đợi ý tưởng', () => {
  test('có hằng trần được đặt tên, không phải số trần trong mã', () => {
    expect(SRC).toMatch(/const IDEA_QUEUE_CAP = \d+/)
  })

  test('scanSources đếm hàng đợi và trả về sớm khi đầy', () => {
    const fn = SRC.slice(SRC.indexOf('async function scanSources'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(body).toContain('IDEA_QUEUE_CAP')
    expect(body).toMatch(/status:\s*'PENDING'/)
    expect(body).toMatch(/return\b/)
  })

  test('đếm hàng đợi xảy ra TRƯỚC khi gọi scout', () => {
    const fn = SRC.slice(SRC.indexOf('async function scanSources'))
    const guard = fn.indexOf('IDEA_QUEUE_CAP')
    const firstModelCall = fn.indexOf('agentBySlug')
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
