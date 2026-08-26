// Giữ tệp là MODULE - xem chú thích ở test/reviveDead.test.ts.
export {}

// Đầu ra của Writer - vá đợt "toà soạn chạy đều mà không bài nào ra đời".
//
// Số đo mở đầu, trên production ngày 26/08/2026: vai `write` hỏng **16/20 lượt
// (80%)** với đúng một thông điệp, trong khi `seo` hỏng 0/2. Vai `write` là vai
// DUY NHẤT bắt cả bài Markdown 800-1500 từ nằm gọn trong một giá trị chuỗi JSON.
//
// Một bài kỹ thuật tiếng Việt đầy dấu nháy kép - lời dẫn, tên riêng, mẫu mã
// nguồn - và mỗi dấu nháy không thoát sẽ đóng chuỗi sớm, làm hỏng TOÀN BỘ khối
// JSON. Không phải hỏng một trường: mất cả bài. `escapeRawControlChars` vá được
// xuống dòng thô, nó không vá được dấu nháy lạc.
//
// Tệp này khoá lại rằng thân bài đi ra NGOÀI JSON, và rằng nhánh dự phòng vẫn
// còn nhưng được đếm.
const { splitWriterOutput, WRITER_BODY_SEPARATOR, parseJsonLoose } = require('../src/llm')

const BODY = [
  '# Closures trong JavaScript',
  '',
  'Nhiều người nói "closure là hàm nhớ được biến bên ngoài", nhưng đó mới là một nửa.',
  '',
  '```js',
  'const f = () => { const x = "xin chào"; return () => x; };',
  '```',
  '',
  'Đoạn trên in ra "xin chào" kể cả sau khi hàm ngoài đã trả về.',
].join('\n')

describe('tách đầu ra của Writer', () => {
  test('đọc được siêu dữ liệu và thân bài qua dấu tách', () => {
    const raw =
      '{"title":"Closures trong JavaScript","excerpt":"Một nửa còn lại của closure."}\n' +
      `${WRITER_BODY_SEPARATOR}\n${BODY}`

    const out = splitWriterOutput(raw)
    expect(out).not.toBeNull()
    expect(out.title).toBe('Closures trong JavaScript')
    expect(out.excerpt).toBe('Một nửa còn lại của closure.')
    expect(out.contentMd).toBe(BODY)
    expect(out.usedJsonFallback).toBe(false)
  })

  // Đây là ca đã làm hỏng 80% lượt chạy trên production.
  test('dấu nháy kép trong bài KHÔNG còn phá được đầu ra', () => {
    const raw = `{"title":"T","excerpt":"E"}\n${WRITER_BODY_SEPARATOR}\n${BODY}`

    // Chứng minh vế ngược: đúng nội dung đó nhét vào chuỗi JSON thì hỏng thật.
    const asJson = `{"title":"T","excerpt":"E","contentMd":"${BODY}"}`
    expect(parseJsonLoose(asJson)).toBeNull()

    // Còn đường mới thì giữ nguyên vẹn, kể cả khối mã và các dấu nháy trong đó.
    const out = splitWriterOutput(raw)
    expect(out.contentMd).toContain('"closure là hàm nhớ được biến bên ngoài"')
    expect(out.contentMd).toContain('const x = "xin chào"')
  })

  test('siêu dữ liệu hỏng KHÔNG làm mất thân bài', () => {
    const raw = `{"title": "thiếu ngoặc đóng\n${WRITER_BODY_SEPARATOR}\n${BODY}`
    const out = splitWriterOutput(raw)
    expect(out).not.toBeNull()
    expect(out.contentMd).toBe(BODY)
    // Tiêu đề có đường lùi ở nơi gọi (đề tài gốc); thân bài thì không có.
    expect(out.title).toBeUndefined()
  })

  test('cắt cụt chỉ mất ĐUÔI bài, không mất cả bài', () => {
    const cut = BODY.slice(0, 120)
    const raw = `{"title":"T","excerpt":"E"}\n${WRITER_BODY_SEPARATOR}\n${cut}`
    const out = splitWriterOutput(raw)
    expect(out.contentMd).toBe(cut.trim())
  })

  test('mô hình bọc thân bài trong rào markdown thì bỏ rào NGOÀI CÙNG', () => {
    const raw =
      `{"title":"T","excerpt":"E"}\n${WRITER_BODY_SEPARATOR}\n` + '```markdown\n' + BODY + '\n```'
    const out = splitWriterOutput(raw)
    expect(out.contentMd).toBe(BODY)
    // Rào của khối mã BÊN TRONG bài phải còn nguyên.
    expect(out.contentMd).toContain('```js')
  })

  test('không có dấu tách thì lùi về JSON, và việc đó ĐƯỢC ĐẾM', () => {
    const raw = '{"title":"T","excerpt":"E","contentMd":"Thân bài không có dấu nháy nào."}'
    const out = splitWriterOutput(raw)
    expect(out.contentMd).toBe('Thân bài không có dấu nháy nào.')
    // Không đếm thì nhánh dự phòng âm thầm thành đường chính và lỗi cũ mọc lại.
    expect(out.usedJsonFallback).toBe(true)
  })

  test('rác hoàn toàn thì trả null để nơi gọi ném lỗi có số đo', () => {
    expect(splitWriterOutput('Xin lỗi, tôi không thể giúp việc này.')).toBeNull()
    expect(splitWriterOutput('')).toBeNull()
  })
})
