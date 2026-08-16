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
import { extractHeadings, renderMarkdown, slugifyHeading } from '../lib/md';

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
    // Tiêu đề nay mang `id` để mục lục neo tới được.
    expect(renderMarkdown('# Tiêu đề')).toContain('<h1 id="tieu-de">Tiêu đề</h1>');
    expect(renderMarkdown('**đậm**')).toContain('<strong>đậm</strong>');
    expect(renderMarkdown('- một\n- hai')).toContain('<li>một</li>');
    expect(renderMarkdown('```\nma nguon\n```')).toContain('<pre><code>');
  });
});

describe('neo tiêu đề và mục lục', () => {
  // Bất biến QUAN TRỌNG NHẤT ở đây: id mà renderMarkdown gắn vào HTML phải khớp
  // TỪNG CÁI với id mà extractHeadings sinh ra. Hai bên tính riêng thì mục lục
  // trỏ tới những neo không tồn tại, và triệu chứng chỉ là "bấm vào không nhảy"
  // — không lỗi, không log, không test nào khác bắt được.
  test('id trong HTML khớp đúng danh sách mục lục', () => {
    const md = [
      '# Giới thiệu',
      'Đoạn văn.',
      '## Cài đặt',
      '### Yêu cầu hệ thống',
      '## Sử dụng',
    ].join('\n\n');
    const html = renderMarkdown(md);
    const ids = [...html.matchAll(/<h[123] id="([^"]+)"/g)].map((m) => m[1]);
    expect(extractHeadings(md).map((h) => h.id)).toEqual(ids);
  });

  test('bỏ dấu tiếng Việt thay vì xoá chữ có dấu', () => {
    expect(slugifyHeading('Cài đặt nhanh')).toBe('cai-dat-nhanh');
    expect(slugifyHeading('Đường dẫn & tham số')).toBe('duong-dan-tham-so');
  });

  // Hai mục trùng tên phải ra hai neo khác nhau, nếu không neo thứ hai không bao
  // giờ tới được — trình duyệt luôn nhảy tới phần tử đầu tiên khớp id.
  test('tiêu đề trùng tên nhận neo khác nhau', () => {
    const items = extractHeadings('## Ghi chú\n\n## Ghi chú\n\n## Ghi chú');
    expect(items.map((h) => h.id)).toEqual(['ghi-chu', 'ghi-chu-2', 'ghi-chu-3']);
  });

  test('cấp tiêu đề được giữ đúng', () => {
    expect(extractHeadings('# A\n\n## B\n\n### C').map((h) => h.level)).toEqual([1, 2, 3]);
  });

  // `# lời chú thích` trong một đoạn shell không phải một mục của bài viết.
  test('bỏ qua tiêu đề nằm trong khối mã', () => {
    const md = ['# Thật', '', '```bash', '# đây là chú thích shell', 'ls -la', '```'].join('\n');
    expect(extractHeadings(md).map((h) => h.text)).toEqual(['Thật']);
  });

  // id đi thẳng vào `id="..."` của HTML sinh từ nội dung người soạn.
  test('tiêu đề chứa ký tự nguy hiểm không thoát ra khỏi thuộc tính id', () => {
    const html = renderMarkdown('## Xin chào" onload="alert(1)');

    // Khẳng định đúng thứ cần khẳng định: THẺ MỞ chỉ được có duy nhất thuộc
    // tính id, và giá trị id chỉ gồm [a-z0-9-]. Kiểm kiểu "không chứa chuỗi
    // onload=" là sai — chuỗi đó xuất hiện hợp lệ trong PHẦN VĂN BẢN đã thoát
    // (`onload=&quot;`), nên phép kiểm đó vừa đỏ oan vừa không chứng minh gì.
    const openTag = html.match(/<h2[^>]*>/)?.[0] ?? '';
    expect(openTag).toMatch(/^<h2 id="[a-z0-9-]*">$/);

    // Và nội dung phải được thoát, không phải bị cắt bỏ.
    expect(html).toContain('&quot;');
  });
});
