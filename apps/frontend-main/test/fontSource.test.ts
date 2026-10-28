import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * CỔNG CANH FONT - quét NGUỒN, không chạy trang.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO PHẢI LÀ TEST QUÉT NGUỒN
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Lỗi mà test này canh đã sống TRÊN PRODUCTION nhiều tháng và không một bộ test
 * nào ở repo bắt được. Hình dạng của nó:
 *
 *   globals.css   @import url('https://fonts.googleapis.com/css2?family=Inter...')
 *   CSP prod      style-src 'self' 'unsafe-inline'
 *                 font-src  'self' data:
 *
 * `'unsafe-inline'` chỉ cho phép <style> nội tuyến; nó KHÔNG cho phép stylesheet
 * từ host ngoài. `font-src` thì không có fonts.gstatic.com. Nên font bị chặn hai
 * lần, trình duyệt lặng lẽ nhảy xuống chuỗi dự phòng, và mỗi thiết bị hiện một
 * font khác nhau.
 *
 * Dev và E2E chạy http://localhost nơi KHÔNG CÓ CSP, nên không có cách nào phát
 * hiện bằng cách chạy trang. Đây đúng bài học §0.7 thứ hai của HANDOFF.md: "lỗi
 * chỉ tồn tại trên HTTPS thì không bộ test nào ở đây bắt được - canh những thứ
 * đó bằng test quét NGUỒN."
 *
 * Bốn khẳng định dưới đây phủ bốn cách hỏng ĐỘC LẬP, mỗi cách đều im lặng.
 */

const APP = join(__dirname, '..');
const FONT_DIR = join(APP, 'public/fonts');

/** Mọi tệp CSS do repo viết hoặc sinh ra. Không gồm node_modules hay .next. */
function tepCss(): string[] {
  const dir = join(APP, 'styles');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => join(dir, f));
}

describe('font tự host - cổng canh nguồn', () => {
  /**
   * 1. KHÔNG host ngoài. Đây là khẳng định trực tiếp nhất về lỗi đã xảy ra.
   *
   * Quét cả `styles/` lẫn `pages/`: bản lỗi nằm ở CSS, nhưng một thẻ
   * <link rel="stylesheet" href="https://fonts.googleapis.com/..."> trong
   * `_document.tsx` sẽ hỏng y hệt và dễ bị thêm vào hơn, vì nó là cách Google
   * Fonts hướng dẫn.
   */
  test('không nạp font từ host ngoài ở bất kỳ đâu', () => {
    const HOST_CAM = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'use.typekit.net',
      'fonts.bunny.net',
    ];
    const viPham: string[] = [];

    /**
     * BỎ COMMENT TRƯỚC KHI QUÉT, và đây không phải tiện lợi mà là tính đúng đắn.
     *
     * Những file liên quan tới lỗi này PHẢI nêu tên host bị cấm trong chú thích -
     * đó là cách duy nhất để người sửa sau hiểu vì sao không được dùng nó. Một
     * cổng bắt cả lời giải thích sẽ buộc người ta xoá lời giải thích đi, và thế
     * là mất đúng phần giá trị nhất. Đã xảy ra ngay lần chạy đầu của chính test
     * này.
     *
     * Vậy nên cổng hỏi câu hẹp hơn và đúng hơn: "có MÃ nào nạp từ host ngoài
     * không", không phải "có ai NHẮC TỚI host ngoài không".
     */
    const boComment = (t: string) =>
      t
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* ... */ của cả CSS và JS
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); // // ... của JS; `[^:]` để không ăn https://

    const quet = (p: string) => {
      const t = boComment(readFileSync(p, 'utf8'));
      for (const h of HOST_CAM) if (t.includes(h)) viPham.push(`${p.replace(APP, '.')} chứa ${h}`);
    };

    tepCss().forEach(quet);

    const pagesDir = join(APP, 'pages');
    const diSau = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) diSau(p);
        else if (/\.(tsx?|jsx?)$/.test(e)) quet(p);
      }
    };
    diSau(pagesDir);

    expect(viPham).toEqual([]);
  });

  /**
   * 2. CSP phải PHỦ nguồn font mà CSS thật sự yêu cầu.
   *
   * Khẳng định này tồn tại vì hai nửa của lỗi nằm ở hai file khác nhau, do hai
   * người/hai đợt sửa, và không có gì buộc chúng khớp nhau: `globals.css` quyết
   * định font đến TỪ ĐÂU, `proxy.ts` quyết định cái gì được PHÉP tải. Lệch nhau
   * là font không nạp, im lặng.
   */
  test('CSP cho phép đúng nguồn font mà CSS yêu cầu', () => {
    const proxy = readFileSync(join(APP, 'proxy.ts'), 'utf8');
    const fontSrc = proxy.match(/"font-src ([^"]+)"/);
    expect(fontSrc).not.toBeNull();
    const directive = fontSrc?.[1] ?? '';

    // Font phục vụ từ chính site, nên 'self' là đủ VÀ là điều kiện bắt buộc.
    expect(directive).toContain("'self'");

    // Mọi `url(...)` trong CSS font phải là đường dẫn tương đối của site này.
    // Một URL tuyệt đối ở đây nghĩa là nó không đi qua 'self'.
    const fontsCss = readFileSync(join(APP, 'styles/fonts.css'), 'utf8');
    // `?? ''` ở đây không phải cho đẹp kiểu: tsconfig bật
    // `noUncheckedIndexedAccess`, nên `m[1]` có kiểu `string | undefined` dù
    // regex có nhóm bắt. Một chuỗi rỗng sẽ TRƯỢT khẳng định bên dưới, tức hỏng
    // ồn ào - đúng hướng ta muốn.
    const urls = [...fontsCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith('/fonts/')).toBe(true);
    }
  });

  /**
   * 3. Token font phải trỏ tới họ font CÓ `@font-face` thật.
   *
   * Cách hỏng này tinh vi nhất và hoàn toàn im lặng: `--font-family` khai
   * 'Be Vietnam Pro' nhưng không tệp nào định nghĩa họ đó, thì trình duyệt nhảy
   * xuống chuỗi dự phòng và trang vẫn trông bình thường - chỉ là không phải font
   * đã chọn. Cũng là hình dạng của lỗi `--lh-long` đã ghi trong CLAUDE.md: token
   * trỏ tới một biến không tồn tại, chạy sai nhiều tháng, không gì đỏ lên.
   */
  test('mọi họ font trong --font-family/--font-mono đều có @font-face hoặc là font hệ thống', () => {
    const tokens = readFileSync(join(__dirname, '../../../packages/ui/src/tokens.css'), 'utf8');
    const fontsCss = readFileSync(join(APP, 'styles/fonts.css'), 'utf8');

    const khaiBao = new Set(
      [...fontsCss.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => (m[1] ?? '').toLowerCase())
    );

    // Từ khoá CSS và font hệ thống - hợp lệ mà không cần @font-face.
    const HE_THONG = new Set([
      'system-ui',
      '-apple-system',
      'sans-serif',
      'serif',
      'monospace',
      'ui-monospace',
      'sf pro text',
      'segoe ui',
      'roboto',
      'helvetica neue',
      'arial',
      'cascadia code',
      'consolas',
    ]);

    for (const bien of ['--font-family', '--font-mono']) {
      // Giá trị có thể bị prettier ngắt qua nhiều dòng, nên bắt tới dấu `;`.
      const m = tokens.match(new RegExp(bien + ':([^;]+);'));
      expect(m).not.toBeNull();
      const gocTri = m?.[1] ?? '';
      expect(gocTri).not.toBe('');
      const ho = gocTri
        .split(',')
        .map((x) =>
          x
            .trim()
            .replace(/^['"]|['"]$/g, '')
            .toLowerCase()
        )
        .filter(Boolean);
      expect(ho.length).toBeGreaterThan(0);

      // Họ font ĐẦU TIÊN là thứ thực sự được dùng - nó PHẢI tự host.
      expect(khaiBao.has(ho[0] ?? '')).toBe(true);

      for (const h of ho) {
        expect(khaiBao.has(h) || HE_THONG.has(h)).toBe(true);
      }
    }
  });

  /**
   * 4. Mọi tệp woff2 mà CSS trỏ tới phải TỒN TẠI và có kích thước thật.
   *
   * Một `src: url('/fonts/thiếu.woff2')` trả 404 và trình duyệt bỏ qua không
   * một lời nào. Kiểm cả kích thước vì một tệp 0 byte (tải dở, git-lfs chưa
   * fetch) cũng hỏng y hệt mà vẫn "tồn tại".
   */
  test('mọi tệp woff2 được tham chiếu đều có thật và không rỗng', () => {
    const fontsCss = readFileSync(join(APP, 'styles/fonts.css'), 'utf8');
    const tep = [...fontsCss.matchAll(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/g)].map(
      (m) => m[1] ?? ''
    );
    expect(tep.length).toBeGreaterThan(0);

    const thieu: string[] = [];
    for (const t of tep) {
      try {
        if (statSync(join(FONT_DIR, t)).size < 1000) thieu.push(`${t} quá nhỏ`);
      } catch {
        thieu.push(`${t} không tồn tại`);
      }
    }
    expect(thieu).toEqual([]);
  });

  /**
   * 5. Nét 300 KHÔNG được nạp. `.standards/docs/DESIGN_SYSTEM.md` §4 cấm dùng nó
   * vì nét mảnh làm dấu tiếng Việt khó đọc - và nạp một nét đã bị cấm thì chỉ tổ
   * mời người ta dùng, đồng thời tốn băng thông cho thứ không được phép xuất
   * hiện.
   */
  test('không nạp nét 300', () => {
    const fontsCss = readFileSync(join(APP, 'styles/fonts.css'), 'utf8');
    expect(fontsCss).not.toMatch(/font-weight:\s*300/);
    expect(readdirSync(FONT_DIR).filter((f) => /-300-/.test(f))).toEqual([]);
  });

  /**
   * 6. Phải có subset `vietnamese` cho CẢ HAI họ font.
   *
   * Đây là khẳng định cốt lõi của cả đợt: một font không mang subset vietnamese
   * thì mọi chữ có dấu rơi xuống font dự phòng, và kết quả là chữ có dấu và chữ
   * không dấu hiện bằng HAI font khác nhau trong cùng một dòng - hỏng nhìn thấy
   * được nhưng rất dễ bị bỏ qua khi người rà giao diện đọc tiếng Anh.
   */
  test('cả hai họ font đều có subset vietnamese ở mọi nét', () => {
    const tep = readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2'));
    for (const slug of ['be-vietnam-pro', 'jetbrains-mono']) {
      for (const net of [400, 500, 600, 700]) {
        expect(tep).toContain(`${slug}-${net}-vietnamese.woff2`);
      }
    }
  });
});
