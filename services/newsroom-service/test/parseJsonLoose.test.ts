// Bộ parse JSON phòng vệ - ĐƯỜNG NÓNG, không phải ca hiếm.
//
// Claude có `output_config.format` bảo đảm cú pháp. Llama và Gemini gói miễn
// phí thì không: mô hình bọc JSON trong khối ```, thêm lời dẫn "Đây là kết
// quả:", hoặc để dấu phẩy thừa. Mỗi ca ở dưới là một dạng thật đã gặp.
//
// Trả về null thay vì ném là có chủ đích: người gọi biến nó thành AgentRun thất
// bại và event quay lại PENDING, chứ không làm chết dispatcher giữa lô.
const { parseJsonLoose } = require('../src/llm')

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
