/**
 * `renderMarkdown` là RANH GIỚI BẢO MẬT: đầu ra của nó đi thẳng vào
 * `dangerouslySetInnerHTML` ở ba trang (blog, docs, dự án).
 *
 * Ba vector dưới đây đều KHAI THÁC ĐƯỢC trước đợt này, dù hàm tự nhận trong
 * chú thích là "XSS-safe". Nội dung do ADMIN soạn nên người ngoài không chèn
 * trực tiếp được — nhưng một tài khoản quản trị bị chiếm sẽ biến thành XSS
 * lưu trữ trên mọi khách truy cập, và lời hứa "an toàn" trong chú thích sẽ
 * khiến mã tương lai đưa cả nội dung không tin cậy qua đây.
 */
import { renderMarkdown } from '../lib/md';

const DANGEROUS = /javascript:|vbscript:|data:text\/html|\son\w+\s*=/i;

describe('renderMarkdown: ranh giới XSS', () => {
  test.each([
    ['[x](javascript:alert(1))', 'giao thức javascript:'],
    ['[x](JaVaScRiPt:alert(1))', 'javascript: viết hoa lẫn lộn'],
    ['[x](vbscript:msgbox)', 'giao thức vbscript:'],
    ['[x](data:text/html;base64,PHN2Zz4=)', 'data: URL chứa HTML'],
    ['[x](" onmouseover="alert(1))', 'chèn thuộc tính qua nháy kép'],
    ["[x](' onfocus='alert(1))", 'chèn thuộc tính qua nháy đơn'],
  ])('chặn %s (%s)', (input) => {
    expect(renderMarkdown(input)).not.toMatch(DANGEROUS);
  });

  test('thẻ HTML thô bị thoát, không được thực thi', () => {
    const out = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
    // Không dùng DANGEROUS ở đây: sau khi thoát, chuỗi " onerror=" vẫn còn dưới
    // dạng VĂN BẢN và sẽ khớp nhầm. Điều cần khẳng định là không còn THẺ nào mở
    // được — tức là mọi '<' đã thành '&lt;'.
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&lt;img');
    expect(out).not.toMatch(/<(script|img|svg|iframe)\b/i);
  });

  test('link hợp lệ vẫn giữ nguyên — vá không được làm hỏng nội dung thật', () => {
    expect(renderMarkdown('[a](https://tsudev.com/x?y=1)')).toContain(
      'href="https://tsudev.com/x?y=1"'
    );
    expect(renderMarkdown('[a](/blog/bai-viet)')).toContain('href="/blog/bai-viet"');
    expect(renderMarkdown('[a](#muc-2)')).toContain('href="#muc-2"');
    expect(renderMarkdown('[a](mailto:x@tsudev.com)')).toContain('href="mailto:x@tsudev.com"');
  });

  test('markdown cơ bản vẫn hoạt động', () => {
    expect(renderMarkdown('# Tiêu đề')).toContain('<h1>Tiêu đề</h1>');
    expect(renderMarkdown('**đậm**')).toContain('<strong>đậm</strong>');
    expect(renderMarkdown('- một\n- hai')).toContain('<li>một</li>');
    expect(renderMarkdown('```\nma nguon\n```')).toContain('<pre><code>');
  });
});
