import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cổng tương phản cho hệ token màu.
 *
 * Hai chế độ sáng/tối nghĩa là mỗi cặp màu tồn tại HAI lần, và một cặp đủ
 * tương phản ở chế độ tối hoàn toàn có thể không đủ ở chế độ sáng. Kiểm bằng
 * mắt thì bắt được cái chói, không bắt được cái vừa-đủ-trượt: WCAG AA đòi 4.5:1
 * cho chữ thường và 3:1 cho chữ lớn hoặc thành phần giao diện.
 *
 * Test này đọc THẲNG tokens.css, nên không có bản sao nào để trôi lệch. Đổi một
 * mã màu mà làm tụt tương phản là CI đỏ, không phải một khiếu nại của người
 * dùng vài tháng sau.
 */

const CSS = readFileSync(join(__dirname, '..', 'src', 'tokens.css'), 'utf8');

/** Đọc các biến CSS trong một khối selector. */
function tokensIn(selector: string): Record<string, string> {
  // Khối bắt đầu ở selector và kết thúc ở dấu } đầu tiên ở cột 0.
  const start = CSS.indexOf(selector + ' {');
  if (start < 0) throw new Error(`Không tìm thấy khối "${selector}" trong tokens.css`);
  const end = CSS.indexOf('\n}', start);
  const body = CSS.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[m[1] as string] = (m[2] as string).trim();
  }
  return out;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Cặp [chữ, nền, ngưỡng, mô tả] phải đúng ở CẢ HAI chế độ. */
const PAIRS: Array<[string, string, number, string]> = [
  // Chữ thường trên ba tầng bề mặt — 4.5:1.
  ['--ink', '--surface', 4.5, 'chữ chính trên nền trang'],
  ['--ink', '--panel', 4.5, 'chữ chính trên card'],
  ['--ink', '--panel-2', 4.5, 'chữ chính trên khối lồng'],
  ['--ink-soft', '--surface', 4.5, 'chữ phụ trên nền trang'],
  ['--ink-soft', '--panel', 4.5, 'chữ phụ trên card'],
  ['--ink-soft', '--panel-2', 4.5, 'chữ phụ trên khối lồng'],
  // `muted` dùng cho nhãn và chú thích — vẫn là chữ thường, vẫn 4.5:1.
  // Đây là token dễ trượt nhất và cũng là token bị dùng nhiều nhất.
  ['--muted', '--surface', 4.5, 'chữ mờ trên nền trang'],
  ['--muted', '--panel', 4.5, 'chữ mờ trên card'],
  ['--muted', '--panel-2', 4.5, 'chữ mờ trên khối lồng'],
  // Link và nhấn mạnh.
  ['--primary-ink', '--surface', 4.5, 'link trên nền trang'],
  ['--primary-ink', '--panel', 4.5, 'link trên card'],
  ['--primary-ink', '--panel-2', 4.5, 'link trên khối lồng'],
  // Chữ đặt TRÊN màu thương hiệu (nút chính).
  ['--primary-contrast', '--primary', 4.5, 'chữ trên nút chính'],
  // Chữ đặt trên các màu ngữ nghĩa (badge trạng thái).
  ['--on-vivid', '--success', 4.5, 'chữ trên nền thành công'],
  ['--on-vivid', '--warning', 4.5, 'chữ trên nền cảnh báo'],
  ['--on-vivid', '--error', 4.5, 'chữ trên nền lỗi'],
  // Thành phần giao diện và viền — 3:1 theo WCAG 1.4.11.
  ['--border-strong', '--surface', 3, 'viền đậm trên nền trang'],
  ['--border-strong', '--panel', 3, 'viền đậm trên card'],
  ['--primary', '--surface', 3, 'viền/nền nút trên nền trang'],
  ['--primary', '--panel', 3, 'viền/nền nút trên card'],
];

describe.each([
  ['sáng (mặc định)', ':root'],
  ['tối', ":root[data-theme='dark']"],
])('tương phản — chế độ %s', (_label, selector) => {
  const t = tokensIn(selector);

  test.each(PAIRS)('%s trên %s ≥ %s:1 (%s)', (fg, bg, min) => {
    const a = t[fg];
    const b = t[bg];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const ratio = contrast(a as string, b as string);
    // Thông điệp mang số đo thật: khi đỏ thì biết ngay phải chỉnh bao nhiêu.
    expect({ pair: `${fg}/${bg}`, ratio: Number(ratio.toFixed(2)) }).toEqual({
      pair: `${fg}/${bg}`,
      ratio: expect.any(Number),
    });
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  // Thứ bậc bề mặt là cách hệ này dựng chiều sâu (CLAUDE.md: bằng độ sáng nền,
  // không bằng viền/đổ bóng). Nếu ba tầng bằng nhau thì card biến mất khỏi nền.
  test('ba tầng bề mặt phân biệt được với nhau', () => {
    const s = luminance(t['--surface'] as string);
    const p = luminance(t['--panel'] as string);
    const p2 = luminance(t['--panel-2'] as string);
    expect(s).not.toBeCloseTo(p, 3);
    expect(p).not.toBeCloseTo(p2, 3);
  });
});
