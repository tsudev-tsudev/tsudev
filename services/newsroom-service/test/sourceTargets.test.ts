// Giữ tệp là MODULE - xem chú thích ở test/reviveDead.test.ts.
export {}

// Hình dạng NGUỒN ĐỀ TÀI trong `seed-newsroom.js`.
//
// Vì sao cần canh từ đây chứ không phải từ `packages/db`: `packages/db` không có
// bộ test nào, và tệp seed là thứ QUYẾT ĐỊNH kênh nào có bài. Chuỗi là
// `NewsroomSource.target → TopicIdea.target → ContentDraft.target`, nên một dòng
// `target` sai trong seed làm hỏng cả một trang của site mà không có gì báo lỗi.
// `publishDoc.test.ts` đã đọc tệp này từ đây, nên đường dẫn chéo workspace là
// tiền lệ có sẵn.
//
// Hai lỗi đã trả giá, mỗi lỗi một chiều ngược nhau:
//
//   1. **Thiếu nguồn DOC** (trước 26/08/2026): không có nguồn thì không có đề
//      tài, nên nhánh đăng DOC chưa từng chạy dù nó nằm sẵn trong mã. `/docs`
//      chỉ có 2 tài liệu seed gốc.
//   2. **Gán nguồn tin ngoài vào kênh PROJECT** (tới 27/08/2026): kênh PROJECT
//      không được tạo dự án mới - nó chỉ cập nhật MÔ TẢ của một dự án đã có, tìm
//      bằng SLUG suy ra từ tiêu đề bản nháp. Slug sinh từ tiêu đề bài báo GitHub
//      không đời nào trùng slug dự án tsudev, nên đo prod 27/08/2026 thấy
//      `publish.needs_human {"reason":"project_not_found"}` **28 lần / 7 ngày**
//      và kênh PROJECT có **0 bản nháp PUBLISHED**. Tốn Neuron cho bản nháp chắc
//      chắn bị vứt.
import { readFileSync } from 'fs'
import { join } from 'path'

const SEED = readFileSync(join(__dirname, '../../../packages/db/prisma/seed-newsroom.js'), 'utf8')

/**
 * Lấy các `target` được KHAI THẬT trong mảng SOURCES (không tính mảng CHANNELS).
 *
 * ⚠️ Phải bỏ dòng chú thích TRƯỚC khi khớp. Bản đầu của hàm này không bỏ, và nó
 * đọc luôn `target: 'DOC'` lẫn `target: 'PROJECT'` nằm trong chú thích giải
 * thích - cho ra 2 nguồn DOC và 1 nguồn PROJECT không tồn tại. Một test đọc mã
 * nguồn bằng biểu thức chính quy mà không lọc chú thích thì nó đang đo VĂN BẢN,
 * không đo CẤU HÌNH.
 */
function sourceTargets(): string[] {
  const start = SEED.indexOf('const SOURCES = [')
  expect(start).toBeGreaterThan(-1)
  const body = SEED.slice(start, SEED.indexOf('\n]', start))
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return [...body.matchAll(/target:\s*'([A-Z]+)'/g)]
    .map((m) => m[1])
    .filter((t): t is string => typeof t === 'string')
}

describe('nguồn đề tài của toà soạn', () => {
  test('có ít nhất một nguồn cho kênh DOC', () => {
    // Không có dòng này thì `/docs` vĩnh viễn không có bài của agent, và triệu
    // chứng là một trang trống chứ không phải một lỗi.
    expect(sourceTargets()).toContain('DOC')
  })

  test('KHÔNG nguồn tin ngoài nào được gán cho kênh PROJECT', () => {
    // Kênh PROJECT chỉ chạy đúng khi nguồn phát ra ĐÚNG SLUG DỰ ÁN CÓ THẬT.
    // Chưa có `kind` nào làm được việc đó, nên đúng số nguồn PROJECT là 0.
    // Bật lại thì phải sửa test này TRƯỚC - không bật lén được.
    expect(sourceTargets()).not.toContain('PROJECT')
  })

  test('mọi target trong SOURCES đều là kênh hợp lệ', () => {
    const valid = ['BLOG', 'DOC', 'PROJECT', 'TRUST']
    for (const t of sourceTargets()) expect(valid).toContain(t)
  })
})
