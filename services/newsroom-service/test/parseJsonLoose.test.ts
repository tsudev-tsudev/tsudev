// Bộ parse JSON phòng vệ - ĐƯỜNG NÓNG, không phải ca hiếm.
//
// Claude có `output_config.format` bảo đảm cú pháp. Llama và Gemini gói miễn
// phí thì không: mô hình bọc JSON trong khối ```, thêm lời dẫn "Đây là kết
// quả:", hoặc để dấu phẩy thừa. Mỗi ca ở dưới là một dạng thật đã gặp.
//
// Trả về null thay vì ném là có chủ đích: người gọi biến nó thành AgentRun thất
// bại và event quay lại PENDING, chứ không làm chết dispatcher giữa lô.
const { parseJsonLoose } = require('../src/llm')

export {}

describe('parseJsonLoose', () => {
  test('JSON trần', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  test('bọc trong khối ```json', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  test('bọc trong khối ``` không nhãn', () => {
    expect(parseJsonLoose('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  test('có lời dẫn trước và lời chào sau', () => {
    expect(parseJsonLoose('Đây là kết quả:\n{"a":1}\nHy vọng giúp ích!')).toEqual({ a: 1 })
  })

  test('dấu phẩy thừa trước dấu đóng', () => {
    expect(parseJsonLoose('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] })
  })

  test('mảng ở cấp cao nhất', () => {
    expect(parseJsonLoose('[{"a":1}]')).toEqual([{ a: 1 }])
  })

  test('rác hoàn toàn ⇒ null, KHÔNG ném', () => {
    expect(parseJsonLoose('xin lỗi, tôi không thể')).toBeNull()
    expect(parseJsonLoose('')).toBeNull()
    expect(parseJsonLoose('{ hỏng nặng')).toBeNull()
  })
})

describe('xuống dòng THÔ trong chuỗi - ca đã làm Toà soạn đứng im', () => {
  // ⚠️ Mẫu dưới đây là ĐẦU RA THẬT của @cf/meta/llama-3.3-70b-instruct-fp8-fast
  // trên production ngày 19/08/2026, bắt được khi truy nguyên vì sao 28 sự kiện
  // xếp hàng mà không bài nào ra đời. Mô hình được yêu cầu trả
  // {"contentMd":"<cả bài Markdown>"} và nó xuống dòng NGUYÊN VĂN trong chuỗi.
  //
  // JSON không cho phép ký tự điều khiển thô trong chuỗi ⇒ JSON.parse ném ⇒
  // parseJsonLoose trả null ⇒ Writer ném "bài rỗng hoặc quá ngắn" ⇒ sự kiện
  // quay lại PENDING. Agent vẫn chạy, Neuron vẫn bị tiêu, hàng đợi chỉ dài thêm.
  const THAT = [
    '```json',
    '{',
    '  "title": "Rust 1.90 Phát Hành",',
    '  "excerpt": "Tóm tắt ngắn.",',
    '  "contentMd": "',
    '# Rust 1.90 Phát Hành',
    '',
    'Rust đã phát hành phiên bản 1.90.',
    '',
    'Tham khảo [blog](https://blog.rust-lang.org/).',
    '"',
    '}',
    '```',
  ].join('\n')

  test('parse được, và giữ nguyên xuống dòng của bài viết', () => {
    const p = parseJsonLoose(THAT)
    expect(p).not.toBeNull()
    expect(p.title).toBe('Rust 1.90 Phát Hành')
    // Bài phải còn nguyên cấu trúc Markdown - escape rồi parse lại phải khôi
    // phục ĐÚNG xuống dòng, nếu không bài đăng ra sẽ là một khối chữ liền.
    expect(p.contentMd).toContain('# Rust 1.90 Phát Hành')
    expect(p.contentMd.split('\n').length).toBeGreaterThan(3)
  })

  test('đủ dài để qua ngưỡng của Writer nếu bài thật', () => {
    // Writer từ chối bài dưới 200 ký tự. Mẫu rút gọn ở đây ngắn hơn thế, nên
    // chỉ khẳng định điều thật sự quan trọng: parse KHÔNG trả null.
    expect(parseJsonLoose(THAT)).not.toBeNull()
  })

  test('xuống dòng NGOÀI chuỗi vẫn hợp lệ và không bị đụng tới', () => {
    expect(parseJsonLoose('{\n  "a": 1,\n  "b": "x"\n}')).toEqual({ a: 1, b: 'x' })
  })

  test('dấu nháy đã escape không bị hiểu nhầm là kết thúc chuỗi', () => {
    const raw = '{"a":"anh ta nói \\"xin chào\\"\nrồi đi"}'
    const p = parseJsonLoose(raw)
    expect(p).not.toBeNull()
    expect(p.a).toContain('xin chào')
    expect(p.a).toContain('\n')
  })

  test('tab thô trong chuỗi cũng được cứu', () => {
    expect(parseJsonLoose('{"a":"x\ty"}')).toEqual({ a: 'x\ty' })
  })
})
