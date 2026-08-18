import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Màu nền của hai chế độ bị CHÉP ra ba nơi ngoài tokens.css, và cả ba đều buộc
 * phải như vậy:
 *
 *  - `pages/_document.tsx` - script chống nháy màu phải là chuỗi nội tuyến chạy
 *    trước khi CSS tải xong, nên nó không đọc được biến CSS.
 *  - `packages/ui/src/components/ThemeToggle.tsx` - cập nhật <meta theme-color>
 *    lúc bấm nút, cũng chạy trước khi trình duyệt tính lại style.
 *
 * Một bản sao im lặng trôi lệch ở đây cho ra thanh địa chỉ màu này còn trang
 * màu kia - sai lệch nhỏ đến mức không ai báo lỗi, nhưng trông rẻ tiền. Test
 * này bắt chúng phải bằng nhau.
 */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

/** Giá trị `--surface` trong một khối selector của tokens.css. */
function surfaceOf(selector: string): string {
  const css = readFileSync(
    join(__dirname, '..', '..', '..', 'packages', 'ui', 'src', 'tokens.css'),
    'utf8'
  );
  const start = css.indexOf(selector + ' {');
  if (start < 0) throw new Error(`Không tìm thấy khối "${selector}"`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const m = body.match(/--surface:\s*([^;]+);/);
  if (!m) throw new Error(`Khối "${selector}" không khai --surface`);
  return (m[1] as string).trim().toLowerCase();
}

describe('màu nền chép ra ngoài tokens.css phải khớp nguồn', () => {
  const light = surfaceOf(':root');
  const dark = surfaceOf(":root[data-theme='dark']");

  test('tokens.css khai hai chế độ khác nhau', () => {
    expect(light).not.toEqual(dark);
  });

  test('_document.tsx dùng đúng hai giá trị đó', () => {
    const doc = read('pages', '_document.tsx').toLowerCase();
    expect(doc).toContain(`'${light}'`);
    expect(doc).toContain(`'${dark}'`);
  });

  test('ThemeToggle.tsx dùng đúng hai giá trị đó', () => {
    const tt = readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'ui', 'src', 'components', 'ThemeToggle.tsx'),
      'utf8'
    ).toLowerCase();
    expect(tt).toContain(`'${light}'`);
    expect(tt).toContain(`'${dark}'`);
  });

  // Chế độ SÁNG là mặc định: `:root` trần phải là bảng sáng, và bảng tối phải
  // nằm sau thuộc tính [data-theme]. Đảo lại thì lượt tải đầu tiên hiện tối.
  test('chế độ sáng là mặc định, không phụ thuộc prefers-color-scheme', () => {
    const css = readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'ui', 'src', 'tokens.css'),
      'utf8'
    );
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
    // Bảng màu KHÔNG được treo vào prefers-color-scheme - nếu có, hai người mở
    // cùng một link sẽ thấy hai giao diện khác nhau mà không ai chọn gì cả.
    //
    // Khớp câu lệnh @media chứ không phải chuỗi trần: chính chú thích ở đầu
    // tokens.css giải thích vì sao không dùng nó, nên tìm chuỗi trần sẽ luôn đỏ.
    expect(css).not.toMatch(/@media[^{]*prefers-color-scheme/);
  });
});
