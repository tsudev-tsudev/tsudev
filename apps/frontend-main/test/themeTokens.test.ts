import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Màu nền của BA chế độ bị CHÉP ra ba nơi ngoài tokens.css, và cả ba đều buộc
 * phải như vậy:
 *
 *  - `pages/_document.tsx` - script chống nháy màu phải là chuỗi nội tuyến chạy
 *    trước khi CSS tải xong, nên nó không đọc được biến CSS.
 *  - `packages/ui/src/components/ThemeToggle.tsx` - cập nhật <meta theme-color>
 *    lúc bấm nút, cũng chạy trước khi trình duyệt tính lại style.
 *  - `public/site.webmanifest` (sinh bởi `packages/brand/build-assets.js`) - hệ
 *    điều hành đọc nó để vẽ màn hình chờ PWA, trước khi trang chạy dòng mã nào.
 *    Chỉ chế độ Sáng, vì manifest không có khái niệm chế độ.
 *
 * Một bản sao im lặng trôi lệch ở đây cho ra thanh địa chỉ màu này còn trang màu
 * kia - sai lệch nhỏ đến mức không ai báo lỗi, nhưng trông rẻ tiền. Test này bắt
 * chúng phải bằng nhau.
 *
 * Nguồn gốc của cả ba giá trị là `tokens/design-tokens.json`; `tokens.css` là
 * bản sinh ra từ đó (`npm run tokens:sync`, và `tokens:check` canh trong CI).
 */

const ROOT = join(__dirname, '..', '..', '..');
const TOKENS_CSS = join(ROOT, 'packages', 'ui', 'src', 'tokens.css');
const css = readFileSync(TOKENS_CSS, 'utf8');

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

/** Giá trị `--bg-base` trong khối selector của một chế độ. */
function baseOf(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Không tìm thấy khối "${selector}" trong tokens.css`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const m = body.match(/--bg-base:\s*([^;]+);/);
  if (!m) throw new Error(`Khối "${selector}" không khai --bg-base`);
  return (m[1] as string).trim().toLowerCase();
}

describe('màu nền chép ra ngoài tokens.css phải khớp nguồn', () => {
  const light = baseOf(":root,\n:root[data-theme='light'] {");
  const warm = baseOf(":root[data-theme='warm'] {");
  const dark = baseOf(":root[data-theme='dark'] {");

  test('tokens.css khai ba chế độ khác nhau', () => {
    expect(new Set([light, warm, dark]).size).toBe(3);
  });

  test.each([
    ['_document.tsx', () => read('pages', '_document.tsx')],
    [
      'ThemeToggle.tsx',
      () =>
        readFileSync(join(ROOT, 'packages', 'ui', 'src', 'components', 'ThemeToggle.tsx'), 'utf8'),
    ],
  ])('%s dùng đúng ba giá trị đó', (_name, load) => {
    const src = load().toLowerCase();
    for (const hex of [light, warm, dark]) expect(src).toContain(`'${hex}'`);
  });

  // Chế độ SÁNG là mặc định: `:root` TRẦN phải mang bảng sáng. Đảo lại thì lượt
  // tải đầu tiên của một khách chưa từng chọn gì sẽ hiện chế độ khác.
  test('chế độ sáng là mặc định', () => {
    expect(css).toMatch(/:root,\s*\n:root\[data-theme='light'\]\s*\{[^}]*color-scheme:\s*light/);
  });

  // Bảng màu KHÔNG được treo vào prefers-color-scheme - nếu có, hai người mở
  // cùng một link sẽ thấy hai giao diện khác nhau mà không ai chọn gì cả.
  //
  // "Theo hệ thống" vẫn có, nhưng là một LỰA CHỌN người dùng tự bật: nó được
  // lưu vào localStorage rồi GIẢI thành một giá trị data-theme cụ thể trong
  // script của _document.tsx. Nên `prefers-color-scheme` chỉ được phép xuất hiện
  // trong JavaScript, không được xuất hiện trong bảng token.
  //
  // Khớp câu lệnh @media chứ không phải chuỗi trần: chính chú thích ở đầu
  // tokens.css giải thích vì sao không dùng nó, nên tìm chuỗi trần sẽ luôn đỏ.
  test('bảng màu không treo vào prefers-color-scheme', () => {
    expect(css).not.toMatch(/@media[^{]*prefers-color-scheme/);
  });

  // Bản sao thứ ba, và là bản đã TRÔI LỆCH THẬT: đợt đổi sang bảng màu quy ước
  // v1.0.0, `tokens.css`/`_document.tsx`/`ThemeToggle.tsx` lên #eef4fb còn
  // manifest ở lại #eef3fa. Lệch một đơn vị ở hai kênh, không ai nhìn ra bằng
  // mắt, và nó chỉ hiện ra ở màn hình chờ PWA - đúng loại lỗi không ai báo.
  test.each([
    ['public/site.webmanifest', () => read('public', 'site.webmanifest')],
    [
      'packages/brand/build-assets.js',
      () => readFileSync(join(ROOT, 'packages', 'brand', 'build-assets.js'), 'utf8'),
    ],
  ])('%s dùng đúng màu nền chế độ Sáng', (_name, load) => {
    const src = load().toLowerCase();
    // Khớp cả `"theme_color": "#…"` (JSON) lẫn `theme_color: '#…'` (JS).
    const m = src.match(/theme_color["']?:\s*["']([^"']+)["']/);
    expect(m).not.toBeNull();
    expect((m as RegExpMatchArray)[1]).toBe(light);
    const bgm = src.match(/background_color["']?:\s*["']([^"']+)["']/);
    expect(bgm).not.toBeNull();
    expect((bgm as RegExpMatchArray)[1]).toBe(light);
  });

  test('script chống nháy màu giải được cả bốn lựa chọn', () => {
    const doc = read('pages', '_document.tsx');
    // Bốn lựa chọn của ThemeToggle. Thiếu nhánh nào ở script đồng bộ thì lựa chọn
    // đó chỉ có tác dụng cho tới lần tải trang kế tiếp - rồi âm thầm về Sáng.
    for (const choice of ['system', 'warm', 'dark', 'light']) {
      expect(doc).toContain(`'${choice}'`);
    }
    expect(doc).toContain('prefers-color-scheme');
    // Phải chạy đồng bộ trong <head>, không phải next/script hay useEffect.
    expect(doc).toContain('dangerouslySetInnerHTML');
  });
});

describe('tokens.css là bản sinh ra, không phải bản viết tay', () => {
  test('có cảnh báo không sửa tay và trỏ về nguồn', () => {
    expect(css).toContain('tokens/design-tokens.json');
    expect(css).toMatch(/ĐƯỢC SINH RA/);
  });

  // Nguồn chân lý phải khai đủ ba chế độ. Xoá nhầm một chế độ khỏi JSON sẽ làm
  // tokens.css thiếu khối tương ứng, và triệu chứng là "chọn Ấm thì không có gì
  // đổi" - một lỗi im lặng.
  test('design-tokens.json khai đủ ba chế độ', () => {
    const json = JSON.parse(readFileSync(join(ROOT, 'tokens', 'design-tokens.json'), 'utf8'));
    expect(Object.keys(json.color).sort()).toEqual(['dark', 'light', 'warm']);
    // `typography` là nhóm token không phụ thuộc chế độ (ba bậc display cho
    // hero), không phải một chế độ - lọc ra trước khi so.
    expect(
      Object.keys(json.extensions['tsudev-web'])
        .filter((k) => !k.startsWith('$') && k !== 'typography')
        .sort()
    ).toEqual(['dark', 'light', 'warm']);
  });
});
