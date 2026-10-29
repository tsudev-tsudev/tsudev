#!/usr/bin/env node
/**
 * TẢI VỀ và TỰ HOST font chữ, sinh `apps/frontend-main/styles/fonts.css`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO TỰ HOST - đây là một LỖI ĐÃ CHẠY TRÊN PRODUCTION, không phải tối ưu
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * `globals.css` từng nạp font bằng
 *
 *     @import url('https://fonts.googleapis.com/css2?family=Inter...')
 *
 * và CSP thật của production (đo ngày 28/10/2026 bằng `curl -I`) là
 *
 *     style-src 'self' 'unsafe-inline'
 *     font-src  'self' data:
 *
 * `'unsafe-inline'` chỉ cho phép `<style>` nội tuyến và thuộc tính `style=`. Nó
 * KHÔNG cho phép stylesheet từ host ngoài. Và `font-src` không có
 * `fonts.gstatic.com`. Nghĩa là **Inter và JetBrains Mono chưa bao giờ nạp được
 * trên production**: mọi người xem tsudev.com bằng font dự phòng của máy họ -
 * Windows ra Segoe UI, Android ra Roboto, macOS ra SF Pro, Linux ra thứ khác
 * nữa. Mỗi thiết bị một font, đúng phản đề của yêu cầu "hiển thị tối ưu trên
 * mọi loại thiết bị".
 *
 * Lỗi này KHÔNG bộ test nào ở repo bắt được, vì dev và E2E chạy
 * `http://localhost` nơi không có CSP - bài học §0.7 thứ hai của `HANDOFF.md`.
 * Cổng canh nay là `apps/frontend-main/test/fontSource.test.ts`, quét NGUỒN.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO LÀ SCRIPT, KHÔNG PHẢI TẢI TAY MỘT LẦN
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Giống `tokens:sync`: file sinh ra là ARTIFACT, nguồn là bảng `HO_FONT` dưới
 * đây. Tải tay thì sáu tháng sau không ai biết đã lấy nét nào, subset nào, từ
 * đâu - và lần cần thêm một nét là tải lại từ đầu bằng phỏng đoán.
 *
 *   npm run fonts:sync          tải + sinh CSS
 *   npm run fonts:check         chỉ kiểm, không ghi (dùng trong CI)
 *
 * GIẤY PHÉP: cả hai họ font đều SIL Open Font License 1.1, cho phép tự host và
 * nhúng. Bản sao giấy phép nằm cạnh file font. Thêm họ font mới thì PHẢI kiểm
 * giấy phép trước - repo này có cả một hệ con dấu về bản quyền, tự vi phạm giấy
 * phép font thì không còn gì để nói.
 */
const fs = require('fs');
const path = require('path');

/**
 * ĐỊNH DẠNG ĐẦU RA BẰNG PRETTIER TRƯỚC KHI GHI.
 *
 * Không có bước này thì hai cổng đánh nhau vĩnh viễn: `format:check` định dạng
 * lại tệp sinh ra, rồi `fonts:check` thấy nó lệch nguồn và báo đỏ - và chạy
 * `fonts:sync` lại chỉ đảo ngược vòng đó. Một cặp cổng mà chạy cổng này làm đỏ
 * cổng kia là một cặp cổng sẽ bị tắt cả hai.
 *
 * Nên nguồn sự thật là "đầu ra ĐÃ QUA prettier", không phải "đầu ra thô".
 */
const prettier = require('prettier');

async function dinhDang(noiDung, duong) {
  const cau = (await prettier.resolveConfig(duong)) || {};
  return prettier.format(noiDung, { ...cau, filepath: duong });
}

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'apps/frontend-main/public/fonts');
const CSS_OUT = path.join(ROOT, 'apps/frontend-main/styles/fonts.css');

const CHI_KIEM = process.argv.includes('--check');

/**
 * Nét 300 CỐ Ý KHÔNG có trong bảng này. `.standards/docs/DESIGN_SYSTEM.md` §4
 * cấm dùng nó vì nét mảnh làm dấu tiếng Việt khó đọc - và nạp một nét đã bị cấm
 * thì chỉ tổ mời người ta dùng.
 *
 * Be Vietnam Pro là font chữ chính: thiết kế GỐC cho tiếng Việt bởi nhóm thiết
 * kế Việt, nên tổ hợp hai dấu (ậ ộ ặ ữ ể) được dựng đúng vị trí thay vì chồng
 * lên chân chữ hoa. Đó là khác biệt thật so với Inter, nơi dấu là bản mở rộng
 * thêm vào sau.
 */
const HO_FONT = [
  {
    google: 'Be Vietnam Pro',
    css: 'Be Vietnam Pro',
    slug: 'be-vietnam-pro',
    nets: [400, 500, 600, 700],
  },
  {
    google: 'JetBrains Mono',
    css: 'JetBrains Mono',
    slug: 'jetbrains-mono',
    nets: [400, 500, 600, 700],
  },
];

/**
 * Chỉ giữ ba subset này. `cyrillic`, `cyrillic-ext` và `greek` bị BỎ: tsudev.com
 * là site tiếng Việt, và mỗi subset giữ lại là một file nữa phải tải, phải lưu
 * trong git, phải đi qua CDN. Mười hai file bị bỏ ở đây.
 *
 * `latin-ext` KHÔNG được bỏ dù nghe có vẻ dư: nó chứa các ký tự châu Âu xuất
 * hiện trong tên riêng và trong thuật ngữ kỹ thuật được trích dẫn.
 */
const SUBSET_GIU = ['latin', 'latin-ext', 'vietnamese'];

// UA của một trình duyệt hiện đại. BẮT BUỘC: Google Fonts trả về định dạng khác
// (ttf, woff) cho UA cũ hoặc cho `curl` trần, và woff2 là thứ duy nhất ta muốn.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function urlCss() {
  const fams = HO_FONT.map(
    (f) => `family=${f.google.replace(/ /g, '+')}:wght@${f.nets.join(';')}`
  ).join('&');
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}

/**
 * Bóc từng khối `@font-face` ra thành bản ghi. Phân tích bằng regex chứ không
 * bằng trình phân tích CSS: đầu ra của Google Fonts có hình dạng ổn định và cố
 * định, và thêm một dependency chỉ để đọc sáu trường là không tương xứng. Nếu
 * hình dạng đó đổi thì `khoiTuCss` trả về mảng rỗng và script THOÁT KHÁC 0 -
 * hỏng ồn ào, không hỏng im lặng.
 */
function khoiTuCss(css) {
  const ra = [];
  // Tên subset nằm trong comment NGAY TRƯỚC khối, đó là cách duy nhất Google
  // nói ra nó. Mất comment là mất tên subset.
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const subset = m[1];
    const than = m[2];
    const lay = (k) => {
      const r = new RegExp(k + ':\\s*([^;]+);');
      const x = than.match(r);
      return x ? x[1].trim() : null;
    };
    const family = (lay('font-family') || '').replace(/^['"]|['"]$/g, '');
    const net = parseInt(lay('font-weight') || '400', 10);
    const style = lay('font-style') || 'normal';
    const range = lay('unicode-range');
    const src = lay('src') || '';
    const u = src.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!family || !u || !range) continue;
    ra.push({ subset, family, net, style, range, url: u[1] });
  }
  return ra;
}

function tenTep(ho, net, subset) {
  return `${ho.slug}-${net}-${subset}.woff2`;
}

async function main() {
  const css = await (async () => {
    const res = await fetch(urlCss(), { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`Google Fonts trả ${res.status}`);
    return res.text();
  })();

  const khoi = khoiTuCss(css);
  if (khoi.length === 0)
    throw new Error('không bóc được khối @font-face nào - hình dạng CSS đã đổi?');

  const canLay = [];
  for (const ho of HO_FONT) {
    for (const net of ho.nets) {
      for (const subset of SUBSET_GIU) {
        const k = khoi.find(
          (x) => x.family === ho.css && x.net === net && x.subset === subset && x.style === 'normal'
        );
        if (!k) throw new Error(`thiếu ${ho.css} nét ${net} subset ${subset} trong CSS của Google`);
        canLay.push({ ...k, ho, tep: tenTep(ho, net, subset) });
      }
    }
  }

  // --- CSS sinh ra -----------------------------------------------------------
  const dong = [];
  dong.push(
    '/* TỆP SINH RA - ĐỪNG SỬA TAY. Nguồn: scripts/sync-fonts.js, chạy `npm run fonts:sync`.'
  );
  dong.push(' *');
  dong.push(' * Sửa tay thì thay đổi sống ở local rồi biến mất im lặng ở lần sinh kế tiếp -');
  dong.push(' * đúng cái bẫy mà `packages/ui/src/tokens.css` đã trả giá. `npm run fonts:check`');
  dong.push(' * canh trong CI.');
  dong.push(' *');
  dong.push(" * Font phục vụ từ `/fonts/` của chính site, nên CSP `font-src 'self'` cho qua.");
  dong.push(' * KHÔNG thêm `@import` tới fonts.googleapis.com ở đâu nữa: `style-src` của');
  dong.push(' * production không cho host ngoài, nên nó im lặng không nạp gì.');
  dong.push(' *');
  dong.push(' * `font-display: swap`: chữ hiện ngay bằng font dự phòng rồi đổi sang font thật.');
  dong.push(' * Chọn `swap` chứ không `optional` vì `optional` cho phép trình duyệt BỎ QUA font');
  dong.push(' * thật trên mạng chậm - tức quay lại đúng tình trạng mỗi thiết bị một font.');
  dong.push(' */');
  dong.push('');

  for (const ho of HO_FONT) {
    dong.push(`/* ===== ${ho.css} ===== */`);
    for (const net of ho.nets) {
      for (const subset of SUBSET_GIU) {
        const k = canLay.find((x) => x.ho === ho && x.net === net && x.subset === subset);
        dong.push('/* ' + subset + ' */');
        dong.push('@font-face {');
        dong.push(`  font-family: '${ho.css}';`);
        dong.push('  font-style: normal;');
        dong.push(`  font-weight: ${net};`);
        dong.push('  font-display: swap;');
        dong.push(`  src: url('/fonts/${k.tep}') format('woff2');`);
        dong.push(`  unicode-range: ${k.range};`);
        dong.push('}');
      }
    }
    dong.push('');
  }

  // Chuỗi dự phòng có METRIC KHỚP. Không có khối này thì lúc font thật tới,
  // chiều cao dòng và bề rộng chữ đổi và cả trang giật một nhịp (CLS) - trên
  // mạng chậm cú giật đó rơi vào đúng lúc người ta bắt đầu đọc.
  dong.push('/* Font dự phòng có metric khớp Be Vietnam Pro, để lúc font thật tới thì');
  dong.push(' * không giật bố cục. `size-adjust` và ba override dưới đây là cách duy nhất');
  dong.push(' * ép font hệ thống chiếm đúng chỗ font thật sẽ chiếm. */');
  dong.push('@font-face {');
  dong.push("  font-family: 'Be Vietnam Pro Fallback';");
  dong.push("  src: local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial');");
  dong.push('  size-adjust: 100%;');
  dong.push('  ascent-override: 92%;');
  dong.push('  descent-override: 24%;');
  dong.push('  line-gap-override: 0%;');
  dong.push('}');
  dong.push('');

  const cssRa = await dinhDang(dong.join('\n'), CSS_OUT);

  // --- Chế độ kiểm -----------------------------------------------------------
  if (CHI_KIEM) {
    const loi = [];
    if (!fs.existsSync(CSS_OUT)) loi.push('thiếu styles/fonts.css - chạy `npm run fonts:sync`');
    else if (fs.readFileSync(CSS_OUT, 'utf8') !== cssRa)
      loi.push('styles/fonts.css lệch nguồn - chạy `npm run fonts:sync`');
    for (const k of canLay) {
      const p = path.join(FONT_DIR, k.tep);
      if (!fs.existsSync(p)) loi.push(`thiếu public/fonts/${k.tep}`);
      else if (fs.statSync(p).size < 1000)
        loi.push(`public/fonts/${k.tep} quá nhỏ (${fs.statSync(p).size}B)`);
    }
    if (loi.length) {
      console.error('\n✗ fonts:check - ' + loi.length + ' vấn đề\n');
      loi.forEach((l) => console.error('  • ' + l));
      console.error('');
      process.exit(1);
    }
    console.log(`✓ fonts:check - ${canLay.length} tệp woff2 + fonts.css khớp nguồn`);
    return;
  }

  // --- Tải về ----------------------------------------------------------------
  fs.mkdirSync(FONT_DIR, { recursive: true });
  let moi = 0;
  for (const k of canLay) {
    const dich = path.join(FONT_DIR, k.tep);
    if (fs.existsSync(dich) && fs.statSync(dich).size > 1000) continue;
    const res = await fetch(k.url, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`tải ${k.tep} trả ${res.status}`);
    fs.writeFileSync(dich, Buffer.from(await res.arrayBuffer()));
    moi += 1;
  }

  fs.writeFileSync(CSS_OUT, cssRa);
  const README = path.join(FONT_DIR, 'README.md');
  fs.writeFileSync(
    README,
    await dinhDang(
      [
        '# Font tự host',
        '',
        'TỆP SINH RA bởi `npm run fonts:sync` (`scripts/sync-fonts.js`). Đừng thêm,',
        'xoá hay đổi tên tệp bằng tay - sửa bảng `HO_FONT` trong script rồi chạy lại.',
        '',
        '| Họ font | Giấy phép | Vì sao chọn |',
        '| --- | --- | --- |',
        '| Be Vietnam Pro | SIL OFL 1.1 | thiết kế GỐC cho tiếng Việt; tổ hợp hai dấu đúng vị trí |',
        '| JetBrains Mono | SIL OFL 1.1 | font mono có subset `vietnamese` thật |',
        '',
        'Cả hai giấy phép CHO PHÉP tự host và nhúng. Thêm họ font mới thì kiểm giấy',
        'phép TRƯỚC khi tải.',
        '',
        'Chỉ giữ subset `latin`, `latin-ext`, `vietnamese`. `cyrillic`/`greek` bị bỏ có',
        'chủ đích - xem lý do trong `scripts/sync-fonts.js`.',
        '',
        'Vì sao tự host chứ không dùng `@import` của Google Fonts: CSP của production',
        'chặn cả stylesheet ngoài host lẫn `fonts.gstatic.com`, nên bản `@import` IM',
        'LẶNG không nạp gì trong nhiều tháng. Chi tiết ở đầu `scripts/sync-fonts.js`.',
        '',
      ].join('\n'),
      README
    )
  );

  const tong = canLay.reduce((s, k) => s + fs.statSync(path.join(FONT_DIR, k.tep)).size, 0);
  console.log(
    `✓ fonts:sync - ${canLay.length} tệp woff2 (${moi} tải mới), ${(tong / 1024).toFixed(
      0
    )} KB tổng`
  );
  console.log(`  ${path.relative(ROOT, CSS_OUT)} đã sinh lại`);
}

main().catch((e) => {
  console.error('✗ fonts:sync:', e && e.message ? e.message : e);
  process.exit(1);
});
