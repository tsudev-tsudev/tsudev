/**
 * CỔNG ĐẾM NỘI DUNG - bản chạy trong Cloudflare Worker.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CỔNG NÀY TỒN TẠI
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Ngày 28/10/2026 đo được tsudev.com trả HTTP 200 ở mọi trang công khai với nội
 * dung RỖNG HOÀN TOÀN - `sitemap.xml` còn đúng 7 URL tĩnh, `feed.xml` 0 item.
 * Nguyên nhân là Neon treo compute. Việc đó sống **HAI THÁNG** vì mọi cổng đang
 * có đều hỏi sai câu: "tiến trình có chạy không" chứ không phải "người lạ mở
 * site lúc này thì THẤY được mấy bài".
 *
 * `npm run prod:dem-noi-dung` trả lời đúng câu đó, nhưng **không có gì chạy nó**.
 * Một cổng không chạy tự động thì không phải cổng - nó chỉ là một lệnh ai đó có
 * thể gõ. Tệp này là bản chạy tự động của nó.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VÌ SAO Ở TRONG WORKER NÀY, KHÔNG PHẢI MỘT GITHUB ACTION
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Worker này miễn phí, có lịch, và **KHÔNG có kết nối Postgres** - nên nó vẫn
 * trả lời được đúng lúc database chết, tức đúng lúc cần nhất.
 * `newsroom:canh-kenh` thì cần `DATABASE_URL`, mà database chính là thứ đang
 * chết, nên nó im lặng đúng lúc đáng nói nhất.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 VÌ SAO NHỊP PHẢI THƯA - ĐỌC TRƯỚC KHI ĐỔI LỊCH
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Các trang cổng này đo là **SSR**: mỗi lượt fetch đi Worker → Render → Neon.
 * Neon free tự ngủ sau ~5 phút không truy vấn, nên mỗi lượt đo giữ nó thức thêm
 * ~5 phút.
 *
 * Cắm cổng này vào nhịp 5 phút của `keepWarm` = 288 lượt/ngày = Neon KHÔNG BAO
 * GIỜ ngủ = ~186 CU-giờ/tháng trên hạn mức 100 ⇒ **chính xác cái bẫy đã làm site
 * trống hai tháng, chỉ lần này do cổng canh nó tự gây ra.**
 *
 * Hai lượt/ngày ≈ 10 phút compute ≈ 5 CU-giờ/tháng. Đó là cái giá đúng cho việc
 * biết sớm.
 *
 * ⚠️ Nếu sau này đường đọc đã được cache ở biên (kế hoạch §6.2-6.3) thì các
 * trang này không còn chạm Neon và nhịp CÓ THỂ dày lên. Đừng dày lên TRƯỚC khi
 * việc đó xong.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ BẢNG NGƯỠNG BỊ TRÙNG LẶP với `scripts/dem-noi-dung-prod.js` - CÓ CHỦ ĐÍCH
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Script Node đọc `config/topology.json` bằng `require` và dùng `process.argv`;
 * cả hai không tồn tại trong workerd. Gộp lại thành một package dùng chung thì
 * phải dựng một workspace mới cho bốn mươi dòng logic thuần.
 *
 * Nên bản trùng lặp được canh bằng TEST, đúng khuôn mà Worker này đã dùng cho
 * hợp đồng cron: `services/newsroom-service/test/cronContract.test.ts` đối chiếu
 * hai bảng ngưỡng và đỏ khi chúng lệch nhau. Trùng lặp có cổng canh khác hẳn
 * trùng lặp trôi tự do.
 */

export type PhepDo = {
  ten: string;
  duong: string;
  /** Đếm số đơn vị nội dung trong thân phản hồi. */
  dem: (than: string) => number;
  /** Ngưỡng ĐẠT. `0` = chỉ ghi nhận, không bao giờ trượt. */
  toiThieu: number;
  donVi: string;
};

/**
 * Ngưỡng `1` chứ không phải một con số "hợp lý" như 10: cổng này canh việc site
 * bị RỖNG, không canh việc site nghèo nội dung. Ngưỡng cao sẽ đỏ vào những ngày
 * chủ dự án không viết gì - và một cổng kêu oan là một cổng bị tắt đi.
 *
 * `/projects` cố ý không có ngưỡng: trang đó rỗng là trạng thái HỢP LỆ.
 */
export const PHEP_DO: PhepDo[] = [
  {
    ten: 'sitemap.xml',
    duong: '/sitemap.xml',
    dem: (t) => (t.match(/<url>/g) || []).length,
    // 7 URL tĩnh là con số CHÍNH XÁC đã đo lúc site rỗng. Ngưỡng 8 nghĩa là
    // "phải có ít nhất một URL nội dung". Đổi số trang tĩnh thì đổi số này.
    toiThieu: 8,
    donVi: 'URL',
  },
  {
    ten: 'feed.xml',
    duong: '/feed.xml',
    dem: (t) => (t.match(/<item>/g) || []).length,
    toiThieu: 1,
    donVi: 'item',
  },
  {
    ten: '/blog',
    duong: '/blog',
    dem: (t) => new Set(t.match(/href="\/blog\/[^"]+"/g) || []).size,
    toiThieu: 1,
    donVi: 'bài',
  },
  {
    ten: '/docs',
    duong: '/docs',
    dem: (t) => new Set(t.match(/href="\/docs\/[^"]+"/g) || []).size,
    toiThieu: 1,
    donVi: 'tài liệu',
  },
  {
    ten: '/projects',
    duong: '/projects',
    dem: (t) => new Set(t.match(/href="\/projects\/[^"]+"/g) || []).size,
    toiThieu: 0,
    donVi: 'dự án',
  },
  {
    ten: '/api/search',
    // ⚠️ Truy vấn PHẢI dài ít nhất `MIN_QUERY` (=2, khai ở pages/search.tsx).
    // Bản đầu của script Node probe bằng `q=a`: một ký tự nằm dưới ngưỡng nên
    // đường tìm kiếm short-circuit và trả rỗng mà KHÔNG chạm database - cổng sẽ
    // đỏ vĩnh viễn kể cả trên một site hoàn toàn khoẻ mạnh.
    duong: '/api/search?q=the',
    dem: (t) => {
      try {
        const o = JSON.parse(t) as { meta?: { total?: unknown } };
        return typeof o?.meta?.total === 'number' ? o.meta.total : 0;
      } catch {
        return 0;
      }
    },
    toiThieu: 1,
    donVi: 'kết quả',
  },
];

export type KetQua = {
  ten: string;
  ma: number;
  so: number;
  toiThieu: number;
  donVi: string;
  dat: boolean;
  /** `true` = chỉ ghi nhận, không tính vào đạt/trượt. */
  chiGhiNhan: boolean;
  loi?: string;
};

const TIMEOUT_MS = 25_000;

/** Đo MỘT phép. Không ném: mọi lỗi thành `loi` để lượt đo khác vẫn chạy. */
async function doMot(base: string, p: PhepDo): Promise<KetQua> {
  const chung = { ten: p.ten, toiThieu: p.toiThieu, donVi: p.donVi, chiGhiNhan: p.toiThieu === 0 };
  try {
    const res = await fetch(`${base}${p.duong}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'tsudev-cong-dem-noi-dung/1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const than = await res.text();
    const co2xx = res.status >= 200 && res.status < 300;
    const so = co2xx ? p.dem(than) : 0;
    // Mã 2xx là ĐIỀU KIỆN CẦN, không phải điều kiện đủ - toàn bộ lý do cổng này
    // tồn tại. Một trang 200 mà đếm ra 0 vẫn TRƯỢT.
    return { ...chung, ma: res.status, so, dat: co2xx && so >= p.toiThieu };
  } catch (e) {
    return {
      ...chung,
      ma: 0,
      so: 0,
      dat: false,
      loi: e instanceof Error ? e.message : String(e),
    };
  }
}

export type BaoCao = {
  base: string;
  dat: boolean;
  ketQua: KetQua[];
  truot: KetQua[];
};

/**
 * Đo toàn bộ. Chạy TUẦN TỰ chứ không `Promise.all`.
 *
 * Lý do rất cụ thể: sáu lượt fetch song song tới các trang SSR sẽ mở sáu kết nối
 * database cùng lúc trên một instance Render free. Tuần tự thì chậm hơn vài giây
 * - với một cổng chạy hai lần một ngày thì vài giây không là gì.
 */
export async function doNoiDung(base: string): Promise<BaoCao> {
  const goc = base.replace(/\/+$/, '');
  const ketQua: KetQua[] = [];
  for (const p of PHEP_DO) ketQua.push(await doMot(goc, p));
  const truot = ketQua.filter((r) => !r.chiGhiNhan && !r.dat);
  return { base: goc, dat: truot.length === 0, ketQua, truot };
}

/** Một dòng cho mỗi phép đo, dùng cho log và cho thân tin báo động. */
export function thanhDong(r: KetQua): string {
  const dau = r.chiGhiNhan ? '·' : r.dat ? '✔' : '✘';
  const so = r.loi ? `LỖI: ${r.loi}` : `HTTP ${r.ma} · ${r.so} ${r.donVi}`;
  const nguong = r.chiGhiNhan ? '(không canh)' : `cần ≥ ${r.toiThieu}`;
  return `${dau} ${r.ten} — ${so} — ${nguong}`;
}
