import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cổng tương phản cho hệ token màu.
 *
 * BA chế độ (Sáng / Ấm / Tối) nghĩa là mỗi cặp màu tồn tại ba lần, và một cặp đủ
 * tương phản ở chế độ Tối hoàn toàn có thể không đủ ở chế độ Sáng. Kiểm bằng mắt
 * thì bắt được cái chói, không bắt được cái vừa-đủ-trượt: WCAG AA đòi 4.5:1 cho
 * chữ thường và 3:1 cho chữ lớn hoặc thành phần giao diện, còn
 * .standards/docs/DESIGN_SYSTEM.md §1 đòi thêm chữ chính trên nền đạt ≥ 10:1.
 *
 * Test đọc THẲNG tokens.css - bản SINH RA từ .standards/tokens/design-tokens.json - nên
 * không có bản sao nào để trôi lệch. Đổi một mã màu mà làm tụt tương phản là CI
 * đỏ, không phải một khiếu nại của người dùng vài tháng sau.
 */

// Gỡ chú thích TRƯỚC khi tách khối: phần chú thích nằm ngay trên mỗi khối, và
// bộ tách bên dưới coi mọi thứ giữa hai dấu ngoặc nhọn là danh sách selector -
// nên `/* … */\n:root` sẽ được đọc thành một selector không tồn tại.
const CSS = readFileSync(join(__dirname, '..', 'src', 'tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

/**
 * Giá trị các biến CSS mà một phần tử khớp `selector` NHÌN THẤY.
 *
 * Không tìm bằng `indexOf(selector + ' {')` như bản trước: khối chế độ Sáng được
 * sinh ra với danh sách selector nhiều dòng (`:root,\n:root[data-theme='light']`),
 * nên phép tìm chuỗi trượt qua nó và rơi vào khối `:root` KHÁC ở cuối file - khối
 * chỉ có bo góc và khoảng cách, không có màu nào. Hậu quả là mọi cặp màu của chế
 * độ mặc định trả về `undefined` và test vẫn ĐỎ đúng - nhưng đỏ vì lý do sai, và
 * sửa màu sẽ không bao giờ làm nó xanh.
 *
 * Nên ở đây tách file thành từng khối, đọc danh sách selector của mỗi khối, rồi
 * chồng theo đúng thứ tự trong file: nền `:root` trước, khối của chế độ sau.
 */
function tokensIn(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  let found = false;
  for (const m of CSS.matchAll(/(?:^|\n)([^{}]+)\{([^}]*)\}/g)) {
    const selectors = (m[1] as string).split(',').map((s) => s.replace(/\s+/g, ' ').trim());
    // `:root` là nền cho mọi chế độ; khối của chính chế độ đang xét chồng lên nó.
    const applies = selectors.includes(':root') || selectors.includes(selector);
    if (!applies) continue;
    if (selectors.includes(selector)) found = true;
    for (const v of (m[2] as string).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      out[v[1] as string] = (v[2] as string).trim();
    }
  }
  if (!found) throw new Error(`Không tìm thấy khối "${selector}" trong tokens.css`);
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

/** Cặp [chữ, nền, ngưỡng, mô tả] phải đúng ở CẢ BA chế độ. */
const PAIRS: Array<[string, string, number, string]> = [
  // Chữ chính trên nền: §1 đòi ≥10:1, cao hơn hẳn ngưỡng AA. Đây là cặp chiếm
  // gần hết diện tích màn hình, nên nó chịu ngưỡng nghiêm nhất.
  ['--text-primary', '--bg-base', 10, 'chữ chính trên nền trang'],
  ['--text-primary', '--bg-surface', 10, 'chữ chính trên card'],
  ['--text-primary', '--bg-subtle', 10, 'chữ chính trên khối lồng'],
  // Chữ phụ - chữ thường, 4.5:1.
  ['--text-secondary', '--bg-base', 4.5, 'chữ phụ trên nền trang'],
  ['--text-secondary', '--bg-surface', 4.5, 'chữ phụ trên card'],
  ['--text-secondary', '--bg-subtle', 4.5, 'chữ phụ trên khối lồng'],
  ['--text-secondary', '--bg-hover', 4.5, 'chữ phụ trên hàng đang hover'],
  // `text-muted` dùng cho nhãn và chú thích - §1 xếp nó là "thông tin phụ không
  // thiết yếu" nhưng nó vẫn là chữ thường, nên vẫn 4.5:1. Đây là token dễ trượt
  // nhất và cũng là token bị dùng nhiều nhất (gần 200 chỗ trong app).
  ['--text-muted', '--bg-base', 4.5, 'chữ mờ trên nền trang'],
  ['--text-muted', '--bg-surface', 4.5, 'chữ mờ trên card'],
  ['--text-muted', '--bg-subtle', 4.5, 'chữ mờ trên khối lồng'],
  ['--text-muted', '--bg-hover', 4.5, 'chữ mờ trên hàng đang hover'],
  // Link.
  ['--text-link', '--bg-base', 4.5, 'link trên nền trang'],
  ['--text-link', '--bg-surface', 4.5, 'link trên card'],
  ['--text-link', '--bg-subtle', 4.5, 'link trên khối lồng'],
  ['--text-link', '--bg-hover', 4.5, 'link trên hàng đang hover'],
  // Chữ đặt TRÊN màu thương hiệu (nút chính) - cả trạng thái nghỉ, hover và bấm.
  ['--on-primary', '--primary', 4.5, 'chữ trên nút chính'],
  ['--on-primary', '--primary-hover', 4.5, 'chữ trên nút chính đang hover'],
  ['--on-primary', '--primary-active', 4.5, 'chữ trên nút chính đang bấm'],
  // Chữ đặt trên màu ngữ nghĩa ĐẶC (nút danger, chip tô đầy).
  ['--on-status', '--success', 4.5, 'chữ trên nền thành công'],
  ['--on-status', '--warning', 4.5, 'chữ trên nền cảnh báo'],
  ['--on-status', '--danger', 4.5, 'chữ trên nền lỗi'],
  ['--on-status', '--info', 4.5, 'chữ trên nền thông tin'],
  // Badge nền nhạt: cặp -ink/-tint. Lý do cặp này tồn tại nằm ở Badge.tsx - màu
  // trạng thái GỐC đặt lên chính tint 12% của nó chỉ đạt ~4.1-4.3:1 ở chế độ Sáng.
  ['--success-ink', '--success-tint', 4.5, 'chữ trên nhãn thành công'],
  ['--warning-ink', '--warning-tint', 4.5, 'chữ trên nhãn cảnh báo'],
  ['--danger-ink', '--danger-tint', 4.5, 'chữ trên nhãn lỗi'],
  ['--info-ink', '--info-tint', 4.5, 'chữ trên nhãn thông tin'],
  // …và cùng những sắc -ink đó khi đứng làm chữ thẳng trên bề mặt (dòng báo lỗi
  // dưới ô nhập, dấu ✔/✘ trong bảng).
  ['--success-ink', '--bg-surface', 4.5, 'chữ thành công trên card'],
  ['--success-ink', '--bg-subtle', 4.5, 'chữ thành công trên khối lồng'],
  ['--warning-ink', '--bg-surface', 4.5, 'chữ cảnh báo trên card'],
  ['--warning-ink', '--bg-subtle', 4.5, 'chữ cảnh báo trên khối lồng'],
  ['--danger-ink', '--bg-surface', 4.5, 'chữ lỗi trên card'],
  ['--danger-ink', '--bg-subtle', 4.5, 'chữ lỗi trên khối lồng'],
  ['--info-ink', '--bg-surface', 4.5, 'chữ thông tin trên card'],
  ['--info-ink', '--bg-subtle', 4.5, 'chữ thông tin trên khối lồng'],
  // Icon theo chức năng. 4.5:1 chứ không phải 3:1: các icon này MANG THÔNG TIN
  // (màu là mã cho nhóm hành động), nên chúng chịu ngưỡng của chữ, không phải
  // ngưỡng của đồ hoạ trang trí.
  ['--icon-nav', '--bg-base', 4.5, 'icon điều hướng trên nền trang'],
  ['--icon-nav', '--bg-surface', 4.5, 'icon điều hướng trên card'],
  ['--icon-nav', '--bg-subtle', 4.5, 'icon điều hướng trên khối lồng'],
  ['--icon-create', '--bg-base', 4.5, 'icon tạo trên nền trang'],
  ['--icon-create', '--bg-surface', 4.5, 'icon tạo trên card'],
  ['--icon-create', '--bg-subtle', 4.5, 'icon tạo trên khối lồng'],
  ['--icon-edit', '--bg-base', 4.5, 'icon sửa trên nền trang'],
  ['--icon-edit', '--bg-surface', 4.5, 'icon sửa trên card'],
  ['--icon-edit', '--bg-subtle', 4.5, 'icon sửa trên khối lồng'],
  ['--icon-danger', '--bg-base', 4.5, 'icon xoá trên nền trang'],
  ['--icon-danger', '--bg-surface', 4.5, 'icon xoá trên card'],
  ['--icon-danger', '--bg-subtle', 4.5, 'icon xoá trên khối lồng'],
  ['--icon-info', '--bg-base', 4.5, 'icon thông tin trên nền trang'],
  ['--icon-info', '--bg-surface', 4.5, 'icon thông tin trên card'],
  ['--icon-info', '--bg-subtle', 4.5, 'icon thông tin trên khối lồng'],
  ['--icon-trust', '--bg-base', 4.5, 'icon con dấu trên nền trang'],
  ['--icon-trust', '--bg-surface', 4.5, 'icon con dấu trên card'],
  ['--icon-trust', '--bg-subtle', 4.5, 'icon con dấu trên khối lồng'],
  ['--accent', '--bg-base', 4.5, 'sắc phụ trên nền trang'],
  ['--accent', '--bg-surface', 4.5, 'sắc phụ trên card'],
  // Thành phần giao diện và viền - 3:1 theo WCAG 1.4.11.
  // `border-control` chứ không phải `border-strong`: giá trị chuẩn của
  // `border-strong` chỉ đạt 1.65-2.49:1 trên ba nền, tức là ranh giới của nút phụ
  // và ô nhập KHÔNG nhìn thấy được theo WCAG 1.4.11. Đó là khiếm khuyết của bảng
  // màu v1.0.0, không phải của app; nó đã được đẩy ngược lên repo token trung tâm
  // và bảng chuẩn từ v2.8.0 mang sẵn `border-control`. Số đo đầy đủ giữ ở
  // `$accessibility_gap` trong tokens/extensions.tsudev-web.json.
  ['--border-control', '--bg-base', 3, 'viền vùng tương tác trên nền trang'],
  ['--border-control', '--bg-surface', 3, 'viền vùng tương tác trên card'],
  ['--border-control', '--bg-subtle', 3, 'viền vùng tương tác trên khối lồng'],
  ['--primary', '--bg-base', 3, 'viền/nền nút trên nền trang'],
  ['--primary', '--bg-surface', 3, 'viền/nền nút trên card'],
  // Vòng focus phải nhìn thấy được trên MỌI bề mặt nó có thể xuất hiện - kể cả
  // hàng đang hover, nơi nền đã sẫm đi một bậc.
  ['--focus-ring', '--bg-base', 3, 'vòng focus trên nền trang'],
  ['--focus-ring', '--bg-surface', 3, 'vòng focus trên card'],
  ['--focus-ring', '--bg-subtle', 3, 'vòng focus trên khối lồng'],
  ['--focus-ring', '--bg-hover', 3, 'vòng focus trên hàng đang hover'],
];

describe.each([
  ['Sáng (mặc định)', ':root'],
  ['Ấm', ":root[data-theme='warm']"],
  ['Tối', ":root[data-theme='dark']"],
])('tương phản - chế độ %s', (_label, selector) => {
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

  // Màu icon phải phân biệt được VỚI NHAU. Sáu màu cùng đạt tương phản với nền
  // mà lại gần giống nhau thì chúng không còn là mã cho chức năng nữa - người
  // dùng không đọc ra nhóm, và cả hệ thống chỉ còn là trang trí.
  test('sáu màu icon phân biệt được với nhau', () => {
    const names = [
      '--icon-nav',
      '--icon-create',
      '--icon-edit',
      '--icon-danger',
      '--icon-info',
      '--icon-trust',
    ];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = t[names[i] as string] as string;
        const b = t[names[j] as string] as string;
        expect({ pair: `${names[i]}/${names[j]}`, same: a === b }).toEqual({
          pair: `${names[i]}/${names[j]}`,
          same: false,
        });
      }
    }
  });

  // Thứ bậc bề mặt là cách hệ này dựng chiều sâu (DESIGN_SYSTEM.md §1: bề mặt
  // sáng hơn nền để tách lớp tự nhiên). Nếu các tầng bằng nhau thì card biến mất
  // khỏi nền, và không viền nào cứu được vì viền chỉ vẽ được cái cạnh.
  test('bốn tầng bề mặt phân biệt được với nhau', () => {
    const l = (n: string) => luminance(t[n] as string);
    for (const [a, b] of [
      ['--bg-base', '--bg-surface'],
      ['--bg-base', '--bg-subtle'],
      ['--bg-subtle', '--bg-hover'],
    ]) {
      expect({ pair: `${a}/${b}`, close: Math.abs(l(a!) - l(b!)) < 0.001 }).toEqual({
        pair: `${a}/${b}`,
        close: false,
      });
    }
  });

  // §1 cấm trắng tuyệt đối làm NỀN TRANG và cấm đen tuyệt đối ở mọi vai trò, ở
  // mọi chế độ - cả hai đều để giảm chói khi đọc lâu. (`--bg-surface` được phép
  // là #FFFFFF: đó là card, không phải nền trang.)
  test('không dùng trắng tuyệt đối làm nền trang, không dùng đen tuyệt đối', () => {
    expect(String(t['--bg-base']).toLowerCase()).not.toBe('#ffffff');
    const hexes = Object.entries(t)
      .filter(([, v]) => /^#[0-9a-fA-F]{6}$/.test(v))
      .filter(([, v]) => v.toLowerCase() === '#000000')
      .map(([k]) => k);
    expect(hexes).toEqual([]);
  });
});

// Ba chế độ phải là ba bảng THẬT SỰ khác nhau. Sinh nhầm (ví dụ script đồng bộ
// đọc trượt khoá) sẽ cho ra hai khối giống hệt, và mọi test tương phản ở trên
// vẫn xanh vì chúng chỉ kiểm từng chế độ một.
test('ba chế độ có nền trang khác nhau', () => {
  const base = (s: string) => tokensIn(s)['--bg-base'];
  const [light, warm, dark] = [':root', ":root[data-theme='warm']", ":root[data-theme='dark']"].map(
    base
  );
  expect(new Set([light, warm, dark]).size).toBe(3);
});
