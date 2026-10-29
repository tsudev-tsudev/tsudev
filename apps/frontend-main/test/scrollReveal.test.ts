import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CỔNG CANH SCROLL-REVEAL - quét NGUỒN.
 *
 * Bất biến được canh ở đây chỉ có MỘT, nhưng nó là bất biến đắt:
 *
 *   **Trạng thái mặc định của nội dung là HIỆN. Trạng thái ẩn chỉ tồn tại khi
 *   JavaScript đã chạy và đã bật nó.**
 *
 * Cách viết hiển nhiên - `.reveal { opacity: 0 }` trong CSS, rồi JavaScript thêm
 * class để hiện - ẩn nội dung VĨNH VIỄN nếu JavaScript không chạy: lỗi bundle,
 * người dùng tắt JS, `IntersectionObserver` không được hỗ trợ, hoặc một ngoại lệ
 * ở component khác làm hỏng cả lượt hydrate. Lúc đó trang trả 200, HTML có đủ
 * chữ, công cụ tìm kiếm đọc được mọi thứ - và người thật thấy một trang trắng.
 *
 * Đó là chính xác họ lỗi mà đợt sửa 28/10/2026 ra đời để chấm dứt: trang 200 mà
 * không có nội dung nhìn thấy được, không gì đỏ lên.
 *
 * Test này không chạy trang. Nó quét nguồn, vì cách hỏng này KHÔNG xuất hiện
 * trong môi trường test (jsdom có IntersectionObserver giả, JavaScript luôn
 * chạy) và không xuất hiện ở dev. Nó chỉ xuất hiện ở máy người đọc.
 */

const APP = join(__dirname, '..');

/**
 * Bỏ chú thích CSS trước khi quét selector.
 *
 * Bắt buộc, không phải tiện lợi: khối chú thích giải thích bất biến này BẮT BUỘC
 * phải nhắc tên class `.reveal` - đó là cách duy nhất để người sửa sau hiểu vì
 * sao không được đảo logic. Một phép quét ăn cả chú thích sẽ nhận khối giải
 * thích đó là một selector vi phạm, và cách duy nhất để làm nó xanh là xoá lời
 * giải thích đi - tức mất đúng phần giá trị nhất.
 *
 * Đã xảy ra ngay lần chạy đầu của chính test này, và trước đó một lần ở
 * `fontSource.test.ts`. Cùng một bài học hai lần.
 */
const boComment = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('scroll-reveal - mặc định phải HIỆN', () => {
  const css = boComment(readFileSync(join(APP, 'styles/globals.css'), 'utf8'));

  test('mọi quy tắc ẩn `.reveal` đều nằm trong phạm vi [data-reveal=...]', () => {
    // Tìm mọi khối selector có nhắc `.reveal` VÀ đặt opacity/transform ẩn.
    const khoi = [...css.matchAll(/([^{}]*\.reveal[^{}]*)\{([^}]*)\}/g)];
    expect(khoi.length).toBeGreaterThan(0);

    const viPham: string[] = [];
    for (const m of khoi) {
      const selector = (m[1] ?? '').trim();
      const than = m[2] ?? '';
      const an = /opacity:\s*0\b/.test(than) || /transform:\s*translate/.test(than);
      if (!an) continue;
      // Quy tắc ẩn PHẢI bị rào bởi thuộc tính mà JavaScript đặt. Rào bằng
      // `.is-in` không tính - đó là class hiện, không phải cổng của JavaScript.
      if (!selector.includes('[data-reveal=')) viPham.push(selector);
    }
    expect(viPham).toEqual([]);
  });

  test('class `is-in` chỉ HIỆN, không bao giờ ẩn', () => {
    // Nếu một ngày nào đó logic bị đảo (`.is-in` thành trạng thái ẩn) thì toàn
    // bộ lập luận an toàn ở trên sụp, mà CSS vẫn hợp lệ.
    const khoi = [...css.matchAll(/([^{}]*\.is-in[^{}]*)\{([^}]*)\}/g)];
    expect(khoi.length).toBeGreaterThan(0);
    for (const m of khoi) {
      expect(m[2] ?? '').not.toMatch(/opacity:\s*0\b/);
    }
  });

  test('hook tôn trọng prefers-reduced-motion và không bật trạng thái ẩn', () => {
    const hook = readFileSync(join(APP, 'lib/useScrollReveal.ts'), 'utf8');

    // Phải HỎI cài đặt hệ điều hành...
    expect(hook).toContain('prefers-reduced-motion');
    // ...và phải thoát SỚM, trước khi đặt thuộc tính bật trạng thái ẩn. Chỉ làm
    // transition nhanh hơn là không đủ: nó vẫn để lại một khoảnh khắc nội dung ở
    // opacity 0, và với người thật sự cần cài đặt đó thì "nhấp nháy rất nhanh"
    // còn tệ hơn "không chuyển động".
    const viTriThoat = hook.search(/if\s*\([^)]*giamChuyenDong[^)]*\)\s*return/);
    const viTriBat = hook.indexOf('dataset.reveal');
    expect(viTriThoat).toBeGreaterThan(-1);
    expect(viTriBat).toBeGreaterThan(viTriThoat);
  });

  test('hook kiểm IntersectionObserver có tồn tại trước khi bật', () => {
    const hook = readFileSync(join(APP, 'lib/useScrollReveal.ts'), 'utf8');
    expect(hook).toMatch(/typeof IntersectionObserver === 'undefined'/);
  });

  test('token easing và stagger mà CSS dùng đều có thật trong tokens.css', () => {
    // Cùng họ lỗi với `--lh-long` đã ghi trong CLAUDE.md: CSS tham chiếu một
    // biến không tồn tại, trình duyệt bỏ qua cả thuộc tính đó, và chuyển động
    // chạy sai nhiều tháng mà không gì đỏ lên.
    const tokens = readFileSync(join(__dirname, '../../../packages/ui/src/tokens.css'), 'utf8');
    const dung = new Set([...css.matchAll(/var\((--motion-[a-z0-9-]+)\)/g)].map((m) => m[1] ?? ''));
    expect(dung.size).toBeGreaterThan(0);
    for (const bien of dung) {
      expect(tokens).toContain(`${bien}:`);
    }
  });
});
