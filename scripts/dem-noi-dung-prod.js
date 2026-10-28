#!/usr/bin/env node
/**
 * CỔNG ĐẾM: tsudev.com đang phục vụ BAO NHIÊU nội dung thật.
 *
 * Vì sao cổng này phải tồn tại, viết ra để không ai gỡ nó đi vì thấy trùng:
 *
 * Ngày 28/10/2026 đo được tsudev.com trả HTTP 200 ở mọi trang công khai, với
 * nội dung RỖNG HOÀN TOÀN - `/sitemap.xml` còn đúng 7 URL tĩnh, `/feed.xml` 0
 * item, `/blog` hiện "Chưa có bài viết." Nguyên nhân là Neon treo compute vì
 * vượt hạn mức. Việc đó đã sống HAI THÁNG: `logs/STATE.md` ghi 50 bài ngày
 * 27/08, hôm nay là 0.
 *
 * Không một cổng nào trong repo bắt được, vì mọi cổng đều hỏi sai câu:
 *
 *   `newsroom:check`      "toà soạn có chạy không"        → CÓ
 *   `newsroom:chan-doan`  "van nào đang đóng"             → không van nào
 *   `newsroom:canh-kenh`  "kênh nào ngừng ra bài"         → cần DATABASE_URL,
 *                                                           mà DB chính là thứ
 *                                                           đang chết
 *   curl mã trạng thái    "trang có sống không"           → 200
 *
 * Cổng này hỏi câu còn thiếu: **"người lạ mở tsudev.com lúc này thì THẤY được
 * mấy bài?"** Nó gọi production từ BÊN NGOÀI, không cần DATABASE_URL, không cần
 * biến môi trường nào - nên nó vẫn trả lời được đúng lúc database chết, tức đúng
 * lúc cần nhất.
 *
 *   node scripts/dem-noi-dung-prod.js
 *   node scripts/dem-noi-dung-prod.js --json
 *
 * Đo một môi trường khác thì truyền `--base <địa chỉ>`. Ví dụ ở đây KHÔNG in số
 * cổng dev ra: `topology:check` quét cả comment và bắt đúng - một số cổng cắm
 * cứng trong tài liệu cũng sẽ lỗi thời y như trong mã, chỉ là không ai sửa.
 * Địa chỉ dev lấy từ `config/topology.json` hoặc `npm run topology:gen`.
 *
 * CHỈ ĐỌC. Chỉ GET, không gửi thân, không mang danh tính.
 *
 * Mã thoát:  0 = có nội dung thật  ·  1 = TRỐNG hoặc thiếu  ·  2 = script tự hỏng
 */
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Địa chỉ mặc định lấy từ `config/topology.json` - nguồn sự thật duy nhất về
// tên miền. Cắm cứng 'https://tsudev.com' ở đây thì `topology:check` sẽ bắt, và
// nó bắt đúng: đổi tên miền mà cổng vẫn đo tên cũ là một cổng báo xanh về một
// site không còn tồn tại.
function baseMacDinh() {
  const topo = require(path.join(ROOT, 'config/topology.json'));
  return `${topo.prod.scheme}://${topo.prod.domain}`;
}

const args = process.argv.slice(2);
const coCo = (c) => args.includes(c);
const giaTriCo = (c) => {
  const i = args.indexOf(c);
  return i >= 0 ? args[i + 1] : null;
};

const BASE = (giaTriCo('--base') || baseMacDinh()).replace(/\/+$/, '');
const JSON_RA = coCo('--json');
const TIMEOUT_MS = 30000;

/**
 * Ngưỡng ĐẠT của từng phép đếm.
 *
 * `toiThieu: 1` chứ không phải một con số "hợp lý" như 10: cổng này canh việc
 * site bị RỖNG, không canh việc site nghèo nội dung. Một ngưỡng cao sẽ đỏ vào
 * những ngày toà soạn đăng thưa - và một cổng kêu oan là một cổng bị tắt đi,
 * rồi lần sau nó không còn ở đó nữa. Bài học này đã trả giá một lần ở
 * `canh-kenh-toa-soan.js`: bản đầu bắt mọi trục trặc nguồn thành ĐỎ và sẽ đỏ
 * vĩnh viễn.
 *
 * `/projects` cố ý KHÔNG có ngưỡng cứng: agent bị cấm tạo dự án mới, nên trang
 * đó rỗng là một trạng thái HỢP LỆ của hệ thống, không phải sự cố.
 */
const PHEP_DO = [
  {
    ten: 'sitemap.xml',
    duong: '/sitemap.xml',
    dem: (t) => (t.match(/<url>/g) || []).length,
    // 7 URL tĩnh là con số CHÍNH XÁC đã đo lúc site rỗng. Ngưỡng 8 nghĩa là
    // "phải có ít nhất một URL nội dung". Đổi số trang tĩnh thì đổi số này.
    toiThieu: 8,
    donVi: 'URL',
    ghiChu: 'rỗng = tự xin gỡ blog/tài liệu/dự án khỏi chỉ mục Google',
  },
  {
    ten: 'feed.xml',
    duong: '/feed.xml',
    dem: (t) => (t.match(/<item>/g) || []).length,
    toiThieu: 1,
    donVi: 'item',
    ghiChu: 'rỗng = mọi RSS reader hiểu là blog đã ngừng đăng',
  },
  {
    ten: '/blog',
    duong: '/blog',
    dem: (t) => new Set(t.match(/href="\/blog\/[^"]+"/g) || []).size,
    toiThieu: 1,
    donVi: 'bài',
    ghiChu: null,
  },
  {
    ten: '/docs',
    duong: '/docs',
    dem: (t) => new Set(t.match(/href="\/docs\/[^"]+"/g) || []).size,
    toiThieu: 1,
    donVi: 'tài liệu',
    ghiChu: 'kênh DOC có trần 1 bài/ngày nên dày lên chậm - nhưng 0 là bất thường',
  },
  {
    ten: '/projects',
    duong: '/projects',
    dem: (t) => new Set(t.match(/href="\/projects\/[^"]+"/g) || []).size,
    toiThieu: 0,
    donVi: 'dự án',
    ghiChu: 'KHÔNG canh: agent bị cấm tạo dự án, rỗng là trạng thái hợp lệ',
  },
  {
    ten: '/api/search',
    duong: '/api/search?q=a',
    dem: (t) => {
      try {
        const o = JSON.parse(t);
        return typeof o?.meta?.total === 'number' ? o.meta.total : 0;
      } catch {
        return 0;
      }
    },
    toiThieu: 1,
    donVi: 'kết quả',
    ghiChu: null,
  },
];

async function lay(duong) {
  const ac = new AbortController();
  const h = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${duong}`, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'tsudev-dem-noi-dung/1' },
    });
    return { ma: res.status, than: await res.text() };
  } finally {
    clearTimeout(h);
  }
}

async function main() {
  const ketQua = [];

  for (const p of PHEP_DO) {
    try {
      const { ma, than } = await lay(p.duong);
      const so = ma >= 200 && ma < 300 ? p.dem(than) : 0;
      // Mã 2xx là ĐIỀU KIỆN CẦN, không phải điều kiện đủ - toàn bộ lý do cổng
      // này tồn tại. Một trang 200 mà đếm ra 0 vẫn TRƯỢT.
      const dat = ma >= 200 && ma < 300 && so >= p.toiThieu;
      ketQua.push({ ...p, ma, so, dat, canh: p.toiThieu === 0 });
    } catch (e) {
      ketQua.push({
        ...p,
        ma: 0,
        so: 0,
        dat: false,
        canh: p.toiThieu === 0,
        loi: e.name === 'AbortError' ? `quá ${TIMEOUT_MS / 1000}s` : e.message,
      });
    }
  }

  const truot = ketQua.filter((r) => !r.canh && !r.dat);

  if (JSON_RA) {
    console.log(
      JSON.stringify(
        {
          base: BASE,
          dat: truot.length === 0,
          phepDo: ketQua.map((r) => ({
            ten: r.ten,
            ma: r.ma,
            so: r.so,
            toiThieu: r.toiThieu,
            dat: r.canh ? null : r.dat,
            loi: r.loi || null,
          })),
        },
        null,
        2
      )
    );
    process.exit(truot.length === 0 ? 0 : 1);
  }

  console.log(`\nĐẾM NỘI DUNG THẬT · ${BASE}\n`);
  for (const r of ketQua) {
    const dau = r.canh ? '·' : r.dat ? '✔' : '✘';
    const nguong = r.canh ? '(không canh)' : `cần ≥ ${r.toiThieu}`;
    const soStr = r.loi ? `LỖI: ${r.loi}` : `HTTP ${r.ma} · ${r.so} ${r.donVi}`;
    console.log(`  ${dau} ${r.ten.padEnd(14)} ${soStr.padEnd(30)} ${nguong}`);
    if (r.ghiChu) console.log(`      ${r.ghiChu}`);
  }

  if (truot.length === 0) {
    console.log(`\n✔ ĐẠT - site đang phục vụ nội dung thật.\n`);
    process.exit(0);
  }

  console.log(`\n✘ TRƯỢT - ${truot.length}/${ketQua.filter((r) => !r.canh).length} phép đo rỗng.`);
  console.log(`\n  Mã trạng thái 200 KHÔNG chứng minh trang có nội dung.`);
  console.log(`  Nếu mọi phép đo đều rỗng trong khi backend /health còn 200 thì nghi`);
  console.log(`  DATABASE trước, nghi mã sau - đó là hình dạng của sự cố 28/10/2026.`);
  console.log(
    `  Chẩn: npm run newsroom:canh-kenh   ·   hồ sơ: docs/refactor-tsudev-2026-q4.md §0\n`
  );
  process.exit(1);
}

main().catch((e) => {
  console.error('✘ cổng tự hỏng:', e && e.message ? e.message : e);
  process.exit(2);
});
