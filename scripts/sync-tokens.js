#!/usr/bin/env node
/**
 * Sinh `packages/ui/src/tokens.css` từ HAI nguồn:
 *   - bảng dùng chung: `.standards/tokens/design-tokens.json` (chỉ-đọc, đến từ
 *     repo quy ước trung tâm) - NGUỒN CHÂN LÝ DUY NHẤT;
 *   - phần riêng của web:  `tokens/extensions.tsudev-web.json`.
 *
 * Vì sao có script này thay vì chép tay: `.standards/docs/PROJECT_STRUCTURE.md` đòi mọi giá
 * trị màu/cỡ chữ/spacing phải truy ngược được về MỘT file JSON. Chép tay thì hai
 * bản trôi lệch, và một mã màu lệch không làm gì đỏ - nó chỉ làm trang trông rẻ
 * tiền vài tháng sau. Ở đây bản CSS là ARTIFACT: không sửa tay, sửa JSON rồi chạy
 * `npm run tokens:sync`.
 *
 * ⚠️ Repo này TỪNG giữ bản sao cục bộ `tokens/design-tokens.json` +
 * `tokens/tokens.css`. Đó chính là cái bẫy mà đoạn trên mô tả, chỉ ở một tầng cao
 * hơn: bản sao ở lại v1.0.0 trong khi bộ quy ước đi tới v2.0.0, và **không cổng
 * nào bắt được** vì mỗi cổng chỉ đối chiếu bản sao với chính nó. Hai file đó đã bị
 * xoá 26/08/2026 (QU-STD-1). Đừng dựng lại: cần thêm token thì thêm vào
 * `tokens/extensions.tsudev-web.json`, cần đổi token dùng chung thì mở đề xuất ở
 * repo `tsudev-standards` theo `.standards/docs/SYNC.md`.
 *
 * Chế độ `--check` còn đối chiếu `.standards/tokens/tokens.css` với file JSON cùng
 * thư mục - hai artifact của cùng một nguồn, lệch nhau nghĩa là gói đồng bộ hỏng.
 *
 *   node scripts/sync-tokens.js           # sinh lại tokens.css của packages/ui
 *   node scripts/sync-tokens.js --check   # chỉ kiểm, khác là thoát mã 1 (CI)
 */
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

const ROOT = path.join(__dirname, '..');
const STD_DIR = path.join(ROOT, '.standards', 'tokens');
const JSON_PATH = path.join(STD_DIR, 'design-tokens.json');
const CANON_CSS = path.join(STD_DIR, 'tokens.css');
const EXT_PATH = path.join(ROOT, 'tokens', 'extensions.tsudev-web.json');
const UI_CSS = path.join(ROOT, 'packages', 'ui', 'src', 'tokens.css');

const tokens = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const ext = JSON.parse(fs.readFileSync(EXT_PATH, 'utf8'));
const usage = ext.$usage;

/** Thứ tự khai báo giữ 1:1 với JSON - DESIGN_SYSTEM.md §7 đòi vậy. */
const emitVars = (obj, indent = '  ') =>
  Object.entries(obj)
    .filter(([k]) => !k.startsWith('$'))
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join('\n');

const MODES = [
  [
    'light',
    ":root,\n:root[data-theme='light']",
    'light',
    'Sáng - MẶC ĐỊNH. `:root` trần mang bảng này, nên lượt tải đầu tiên của một\n   khách vãng lai luôn là Sáng dù hệ điều hành của họ đặt gì.',
  ],
  [
    'warm',
    ":root[data-theme='warm']",
    'light',
    'Ấm (sepia) - cho phiên làm việc dài hoặc ánh sáng gắt. Chỉ đến bằng lựa chọn\n   thủ công; không có đường nào tự động rơi vào chế độ này.',
  ],
  [
    'dark',
    ":root[data-theme='dark']",
    'dark',
    'Tối - cho phòng tối. Nền là navy #0F1B2D chứ KHÔNG phải đen tuyền: đen tuyệt\n   đối bị DESIGN_SYSTEM.md §1 cấm ở mọi chế độ vì độ chói giữa chữ và nền quá\n   gắt khi đọc lâu.',
  ],
];

const header = `/* ============================================================
   tsudev design tokens - BA chế độ: Sáng (mặc định) / Ấm / Tối.

   FILE NÀY ĐƯỢC SINH RA. Đừng sửa tay - lần chạy \`npm run tokens:sync\` kế tiếp
   ghi đè. Nguồn: .standards/tokens/design-tokens.json (nguồn chân lý duy nhất của
   cả hệ sinh thái, xem .standards/docs/DESIGN_SYSTEM.md) ghép với
   tokens/extensions.tsudev-web.json (phần riêng của web).

   Chọn chế độ: thuộc tính \`data-theme\` trên <html>. Bảng màu ở đây KHÔNG treo
   vào cài đặt hệ điều hành, và đó là cố ý - làm vậy thì hai người mở CÙNG một
   đường link thấy hai giao diện khác nhau mà không ai chọn gì cả. Người dùng muốn
   bám theo máy thì chọn "Theo hệ thống" trong nút đổi giao diện; lựa chọn đó được
   giải ra thành một giá trị data-theme cụ thể trong pages/_document.tsx, TRƯỚC khi
   trang được vẽ. (Test canh điều này bằng cách tìm câu lệnh media query trong file,
   nên đừng viết tên câu lệnh đó ra đây kể cả trong chú thích.)

   Mọi cặp chữ/nền ở CẢ BA chế độ bị packages/ui/test/contrast.test.ts canh ở
   ngưỡng WCAG AA. Đổi một mã màu làm tụt tương phản là CI đỏ.
   ============================================================ */
`;

let out = header;

for (const [mode, selector, colorScheme, note] of MODES) {
  out += `\n/* ${note} */\n${selector} {\n  color-scheme: ${colorScheme};\n\n`;
  out += `  /* Bảng chuẩn hệ sinh thái - .standards/tokens/design-tokens.json > color.${mode} */\n`;
  out += emitVars(tokens.color[mode]);
  out += `\n\n  /* Mở rộng riêng của tsudev-web - tokens/extensions.tsudev-web.json > ${mode} */\n`;
  out += emitVars(ext[mode]);
  out += '\n}\n';
}

out += `
/* ------------------------------------------------------------
   Token không phụ thuộc chế độ.
   ------------------------------------------------------------ */
:root {
  /* Chữ */
  --font-family: ${tokens.typography['font-family']};
  --font-mono: ${tokens.typography['font-mono']};
${Object.entries(tokens.typography['font-size'])
  .map(([k, v]) => `  --fs-${k}: ${v};`)
  .join('\n')}
${Object.entries(ext.typography.size)
  .map(([k, v]) => `  --fs-${k}: ${v};`)
  .join('\n')}
${Object.entries(tokens.typography['line-height'])
  .map(([k, v]) => `  --lh-${k}: ${v};`)
  .join('\n')}
${Object.entries(tokens.typography.weight)
  .map(([k, v]) => `  --fw-${k}: ${v};`)
  .join('\n')}
${Object.entries(tokens.typography['letter-spacing'])
  .map(([k, v]) => `  --ls-${k}: ${v};`)
  .join('\n')}

  /* Bo góc - ${usage.radius} */
${Object.entries(tokens.radius)
  .map(([k, v]) => `  --radius-${k}: ${v};`)
  .join('\n')}

  /* Khoảng cách - ${usage.spacing} */
${Object.entries(tokens.spacing)
  .map(([k, v]) => `  --sp-${k}: ${v};`)
  .join('\n')}

  /* Đổ bóng - ${usage.shadow} */
${Object.entries(tokens.shadow)
  .map(([k, v]) => `  --shadow-${k}: ${v};`)
  .join('\n')}

  /* Tầng xếp lớp */
${Object.entries(tokens['z-index'])
  .map(([k, v]) => `  --z-${k}: ${v};`)
  .join('\n')}

  /* Chuyển động - ${usage.motion} */
${Object.entries(tokens.motion)
  .map(([k, v]) => `  --motion-${k === 'easing' ? 'easing' : k}: ${v};`)
  .join('\n')}

  /* Mật độ (DESIGN_SYSTEM.md §3). Comfortable là mặc định; Compact đặt bằng
     data-density="compact" cho bảng nhiều dữ liệu. */
  --control-h: 36px;
  --row-h: 44px;
  --cell-py: 12px;
  --cell-px: 16px;
  --list-item-h: 40px;
  --measure: 72ch;
}

:root[data-density='compact'] {
  --control-h: 32px;
  --row-h: 36px;
  --cell-py: 8px;
  --cell-px: 12px;
  --list-item-h: 32px;
}
`;

/**
 * Đối chiếu `.standards/tokens/tokens.css` với `.standards/tokens/design-tokens.json`.
 * Cả hai đến từ cùng một gói đồng bộ nên lệch nhau là lỗi của gói, không phải của
 * repo này - nhưng bắt ở đây rẻ, và im lặng thì đắt.
 */
function driftInCanonical() {
  const css = fs.readFileSync(CANON_CSS, 'utf8');
  const drift = [];
  for (const [mode] of MODES) {
    // Cả ba chế độ đều có bộ chọn `[data-theme="<mode>"]`; riêng light còn đứng
    // sau `:root,` trên dòng trước, nên bắt đầu từ bộ chọn là đủ và đồng nhất.
    const start = css.indexOf(`[data-theme="${mode}"]`);
    if (start < 0) {
      drift.push(`.standards/tokens/tokens.css thiếu khối chế độ "${mode}"`);
      continue;
    }
    const body = css.slice(start, css.indexOf('\n}', start));
    for (const [name, value] of Object.entries(tokens.color[mode])) {
      const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
      if (!m) {
        drift.push(`${mode}: .standards/tokens/tokens.css thiếu --${name}`);
      } else if (m[1].trim().replace(/\s+/g, '') !== String(value).replace(/\s+/g, '')) {
        drift.push(`${mode}: --${name} lệch - JSON "${value}" vs CSS "${m[1].trim()}"`);
      }
    }
  }
  return drift;
}

/**
 * Chuẩn hoá bản sinh ra bằng chính prettier của repo.
 *
 * Không có bước này thì hai cổng kiểm đá nhau vĩnh viễn: `format:check` đòi sửa
 * tokens.css theo kiểu prettier, còn `tokens:check` thấy nó khác bản sinh ra nên
 * đòi chạy lại tokens:sync - và mỗi lần chạy một cái thì cái kia đỏ. Cho bộ sinh
 * dùng đúng cấu hình prettier là hết vòng lặp đó.
 *
 * (`.standards/` thì ngược lại: cả cây nằm trong .prettierignore vì định dạng lại
 * một byte cũng làm lệch MANIFEST.sha256 của gói đồng bộ.)
 */
const pretty = (css) =>
  prettier.format(css, { ...prettier.resolveConfig.sync(UI_CSS), parser: 'css' });

out = pretty(out);

const check = process.argv.includes('--check');
const drift = driftInCanonical();
if (drift.length) {
  console.error('.standards/tokens/tokens.css đã trôi lệch khỏi design-tokens.json cùng thư mục:');
  for (const d of drift) console.error('  - ' + d);
  process.exit(1);
}

if (check) {
  const current = fs.existsSync(UI_CSS) ? fs.readFileSync(UI_CSS, 'utf8') : '';
  if (current !== out) {
    console.error(
      'packages/ui/src/tokens.css không khớp nguồn token.\n' +
        'Chạy `npm run tokens:sync` rồi commit lại bản sinh ra.'
    );
    process.exit(1);
  }
  console.log('tokens: khớp nguồn (3 chế độ).');
} else {
  fs.writeFileSync(UI_CSS, out);
  console.log(`tokens: đã sinh ${path.relative(ROOT, UI_CSS)} (3 chế độ).`);
}
