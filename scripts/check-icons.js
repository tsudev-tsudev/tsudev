#!/usr/bin/env node
/**
 * CỔNG CANH BỘ ICON.
 *
 * Ba cách bộ icon hỏng, và cả ba đều IM LẶNG trên trang thật:
 *
 *   1. `<Icon name="tai-ve" />` với một tên không có trong bảng.
 *      TypeScript bắt được khi tên là chuỗi literal - nhưng KHÔNG bắt được khi
 *      nó đi qua một biến, một bảng tra, hay `as IconName`. Và mẫu bảng tra là
 *      mẫu phổ biến nhất ở repo này (EVENT_LABEL, AGENT_STATUS, KIND_LABEL...).
 *      Lúc đó `ICONS[name]` là `undefined`, `spec.role` ném lỗi lúc render, và
 *      trang trắng - hoặc tệ hơn, chỉ một nhánh của trang trắng.
 *
 *   2. Đường vẽ ra NGOÀI vùng an toàn 24×24. Icon không báo lỗi, nó chỉ bị cắt
 *      mất một cạnh, và chỉ nhìn thấy ở kích thước lớn.
 *
 *   3. `role` sai chính tả. Khi đó `ROLE_CLASS[role]` là `undefined`, class màu
 *      biến thành chuỗi "undefined", và icon mang màu kế thừa - tức nó hoà vào
 *      chữ xung quanh và mất hẳn tín hiệu màu-theo-chức-năng. Không gì đỏ lên.
 *
 *   npm run icons:check
 *
 * CHỈ ĐỌC. Mã thoát: 0 = ổn · 1 = có vấn đề · 2 = script tự hỏng
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ICONS_TS = path.join(ROOT, 'packages/ui/src/components/icons.ts');

/** Nơi có thể gọi `<Icon name=... />`. */
const VUNG_QUET = ['apps/frontend-main/pages', 'apps/frontend-main/components', 'packages/ui/src'];

const VAI_TRO = new Set(['nav', 'create', 'edit', 'danger', 'info', 'trust']);

/**
 * Đi bộ qua một chuỗi `d` và trả về danh sách toạ độ TUYỆT ĐỐI mà đường vẽ đạt
 * tới (điểm neo và điểm điều khiển Bézier).
 *
 * Phủ đúng những lệnh mà bảng icon này dùng: M m L l H h V v C c A a Z z. Gặp
 * lệnh khác thì NÉM - thà cổng tự hỏng ồn ào còn hơn lặng lẽ bỏ qua một phần
 * đường vẽ rồi báo "an toàn".
 *
 * Điểm điều khiển của Bézier được tính vào: nó không nằm trên đường, nhưng một
 * điểm điều khiển ở toạ độ 40 là dấu hiệu chắc chắn đường vẽ đã đi sai.
 * Độ phồng của cung tròn (`A`) thì KHÔNG tính - cần giải phương trình ellipse,
 * và các cung trong bảng này đều nhỏ nên điểm cuối đã đủ đại diện.
 */
function diemCuaDuongVe(d) {
  const token = d.match(/[MmLlHhVvCcSsQqAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const diem = [];
  let i = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lenh = null;
  const so = () => {
    const v = Number(token[i++]);
    if (Number.isNaN(v)) throw new Error(`số không đọc được gần vị trí ${i} trong "${d}"`);
    return v;
  };
  const ghi = () => diem.push([x, y]);

  while (i < token.length) {
    if (/^[MmLlHhVvCcSsQqAaZz]$/.test(token[i])) lenh = token[i++];
    else if (lenh === 'M') lenh = 'L';
    else if (lenh === 'm') lenh = 'l';

    switch (lenh) {
      case 'M':
        x = so();
        y = so();
        sx = x;
        sy = y;
        ghi();
        break;
      case 'm':
        x += so();
        y += so();
        sx = x;
        sy = y;
        ghi();
        break;
      case 'L':
        x = so();
        y = so();
        ghi();
        break;
      case 'l':
        x += so();
        y += so();
        ghi();
        break;
      case 'H':
        x = so();
        ghi();
        break;
      case 'h':
        x += so();
        ghi();
        break;
      case 'V':
        y = so();
        ghi();
        break;
      case 'v':
        y += so();
        ghi();
        break;
      case 'C': {
        const x1 = so();
        const y1 = so();
        const x2 = so();
        const y2 = so();
        x = so();
        y = so();
        diem.push([x1, y1], [x2, y2], [x, y]);
        break;
      }
      case 'c': {
        const x1 = x + so();
        const y1 = y + so();
        const x2 = x + so();
        const y2 = y + so();
        x += so();
        y += so();
        diem.push([x1, y1], [x2, y2], [x, y]);
        break;
      }
      // `S`/`s` - Bézier bậc ba NỐI TIẾP. Điểm điều khiển thứ nhất là ảnh phản
      // chiếu của điểm điều khiển cuối qua điểm hiện tại; ta không cần nó để đo
      // khung, nên chỉ lấy điểm điều khiển thứ hai và điểm cuối.
      case 'S': {
        const x2 = so();
        const y2 = so();
        x = so();
        y = so();
        diem.push([x2, y2], [x, y]);
        break;
      }
      case 's': {
        const x2 = x + so();
        const y2 = y + so();
        x += so();
        y += so();
        diem.push([x2, y2], [x, y]);
        break;
      }
      // `Q`/`q` - Bézier bậc hai. Chưa dùng trong bảng, nhưng phủ sẵn vì nó là
      // lệnh mà người vẽ icon hay sinh ra từ công cụ đồ hoạ.
      case 'Q': {
        const x1 = so();
        const y1 = so();
        x = so();
        y = so();
        diem.push([x1, y1], [x, y]);
        break;
      }
      case 'q': {
        const x1 = x + so();
        const y1 = y + so();
        x += so();
        y += so();
        diem.push([x1, y1], [x, y]);
        break;
      }
      case 'A':
        so();
        so();
        so();
        so();
        so();
        x = so();
        y = so();
        ghi();
        break;
      case 'a':
        so();
        so();
        so();
        so();
        so();
        x += so();
        y += so();
        ghi();
        break;
      case 'Z':
      case 'z':
        x = sx;
        y = sy;
        break;
      default:
        throw new Error(`lệnh SVG chưa được hỗ trợ: "${lenh}" trong "${d}"`);
    }
  }
  return diem;
}

function tepTrong(d, ra = []) {
  if (!fs.existsSync(d)) return ra;
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    if (fs.statSync(p).isDirectory()) tepTrong(p, ra);
    else if (/\.(tsx?|jsx?)$/.test(e) && !/\.test\./.test(e)) ra.push(p);
  }
  return ra;
}

function main() {
  const src = fs.readFileSync(ICONS_TS, 'utf8');

  // Chỉ đọc phần TRONG `export const ICONS = {` ... `} as const`, nếu không thì
  // các tên trong chú thích và trong ROLE_CLASS cũng bị nhận là icon.
  const i0 = src.indexOf('export const ICONS = {');
  const i1 = src.indexOf('} as const satisfies');
  if (i0 < 0 || i1 < 0) {
    console.error('✘ không tìm thấy khối ICONS trong icons.ts - hình dạng file đã đổi?');
    process.exit(2);
  }
  const than = src.slice(i0, i1);

  // Bỏ chú thích trước khi bóc tên: khối này có rất nhiều chú thích giải thích,
  // và một dòng `//   nav  xanh dương` sẽ bị nhận thành tên icon `nav`.
  const thanSach = than.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1 ');

  // Mỗi icon là một khoá ở ĐẦU DÒNG theo sau là `: {`.
  const khoiIcon = [...thanSach.matchAll(/^\s{2}'?([a-z][a-z0-9-]*)'?:\s*\{([^}]*)\}/gm)];
  const coTrongBang = new Set(khoiIcon.map((m) => m[1]));

  const loi = [];

  if (coTrongBang.size === 0) loi.push('không bóc được icon nào từ bảng');

  // --- 3. role hợp lệ -------------------------------------------------------
  for (const m of khoiIcon) {
    const ten = m[1];
    const r = m[2].match(/role:\s*'([a-z]+)'/);
    if (!r) loi.push(`icon "${ten}" không khai role`);
    else if (!VAI_TRO.has(r[1]))
      loi.push(`icon "${ten}" có role "${r[1]}" không nằm trong sáu vai trò hợp lệ`);
  }

  // --- 2. vùng an toàn ------------------------------------------------------
  //
  // 🔴 BẢN ĐẦU CỦA PHÉP ĐO NÀY SAI, và nó sai theo kiểu trông y hệt lỗi thật.
  //
  // Nó lấy MỌI số trong chuỗi `d` rồi đòi chúng nằm trong 0..24. Kết quả: 19
  // icon báo đỏ, kể cả `seal` - một icon đã chạy trên production từ đầu. Nguyên
  // nhân: SVG có lệnh TƯƠNG ĐỐI (chữ thường `l` `h` `v` `c` `a`) trong đó số âm
  // là một ĐỘ DỊCH hợp lệ, không phải toạ độ. `M12 3l7.5 3.2` nghĩa là đi tới
  // (12,3) rồi dịch (+7.5,+3.2), tức tới (19.5, 6.2) - hoàn toàn trong khung.
  //
  // Đây đúng bài học §0.7 thứ tư: "công cụ ĐO có thể sai theo kiểu trông y hệt
  // lỗi thật - số đo bất thường dồn vào MỘT thành phần thì nghi công cụ trước."
  // Mười chín icon cùng đỏ một lúc, trong đó có icon chưa ai sửa, là đúng hình
  // dạng đó.
  //
  // Bản này ĐI BỘ qua đường vẽ, giữ điểm hiện tại, và chỉ đo toạ độ TUYỆT ĐỐI
  // thật sự đạt tới.
  for (const m of khoiIcon) {
    const ten = m[1];
    const d = (m[2].match(/d:\s*'([^']*)'/) || [])[1] || '';
    if (d) {
      const diem = diemCuaDuongVe(d);
      const ngoai = diem.filter(([x, y]) => x < -0.1 || x > 24.1 || y < -0.1 || y > 24.1);
      if (ngoai.length)
        loi.push(
          `icon "${ten}" vẽ ra ngoài khung 24x24 tại ${ngoai
            .slice(0, 3)
            .map(([x, y]) => `(${x.toFixed(1)},${y.toFixed(1)})`)
            .join(' ')}`
        );
    }

    const cir = (m[2].match(/(?:solidC|c)ircle:\s*\[([^\]]+)\]/) || [])[1];
    if (cir) {
      const [cx, cy, r] = cir.split(',').map((x) => Number(x.trim()));
      if (cx - r < -0.1 || cx + r > 24.1)
        loi.push(`icon "${ten}" có hình tròn vượt khung theo trục ngang`);
      if (cy - r < -0.1 || cy + r > 24.1)
        loi.push(`icon "${ten}" có hình tròn vượt khung theo trục dọc`);
    }
  }

  // --- 1. tên được dùng phải tồn tại ---------------------------------------
  const dungNhung = new Map();
  for (const vung of VUNG_QUET) {
    for (const p of tepTrong(path.join(ROOT, vung))) {
      const t = fs.readFileSync(p, 'utf8');
      // `<Icon name="x"`, và cả `icon="x"` của EmptyState - prop đó nhận
      // IconName nên nó là cùng một hợp đồng.
      for (const m of t.matchAll(/(?:<Icon[^>]*?\sname|\bicon)=["']([a-z][a-z0-9-]*)["']/g)) {
        if (!dungNhung.has(m[1])) dungNhung.set(m[1], path.relative(ROOT, p));
      }
    }
  }
  for (const [ten, noi] of dungNhung) {
    if (!coTrongBang.has(ten)) loi.push(`"${ten}" được dùng ở ${noi} nhưng KHÔNG có trong bảng`);
  }

  if (loi.length) {
    console.error(`\n✘ icons:check - ${loi.length} vấn đề\n`);
    loi.forEach((l) => console.error('  • ' + l));
    console.error('');
    process.exit(1);
  }

  console.log(
    `✓ icons:check - ${coTrongBang.size} icon, ${dungNhung.size} tên được dùng, tất cả hợp lệ`
  );
}

try {
  main();
} catch (e) {
  console.error('✘ icons:check tự hỏng:', e && e.message ? e.message : e);
  process.exit(2);
}
