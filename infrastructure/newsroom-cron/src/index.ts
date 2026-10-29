/**
 * Nhịp đập của Toà soạn Agent AI - và bộ giữ ấm Render, cùng một lượt gọi.
 *
 * Vì sao là một Worker RIÊNG, không phải scheduled handler nhét vào
 * apps/frontend-main:
 *
 *   `frontend-main` được dựng bởi opennextjs-cloudflare, và `.open-next/worker.js`
 *   là mã SINH TỰ ĐỘNG chỉ có `fetch` handler. Thêm `scheduled` vào đó nghĩa là
 *   bọc entry của open-next - một điểm sẽ vỡ mỗi lần nâng cấp opennext, đổi lấy
 *   thứ mà 30 dòng ở tệp này làm được. Tách ra còn có nghĩa: cron hỏng thì trang
 *   web vẫn chạy, và deploy trang web không đụng tới cron.
 *
 * Worker này CỐ Ý rất ngu: nó không chạm database, không gọi LLM, không giữ
 * trạng thái. Nó chỉ gõ cửa backend. Mọi quyết định nằm ở newsroom-service.
 *
 * Chi phí: 0đ. Cron Triggers có trên gói Workers Free (100.000 request/ngày,
 * 10ms CPU mỗi lần gọi). Lượt gọi này chỉ `fetch` rồi chờ I/O - thời gian chờ
 * mạng KHÔNG tính vào hạn mức CPU, nên 10ms là thừa thãi.
 *
 * Phụ đề quan trọng: lượt gõ cửa Render mỗi 5 phút cũng chính là bộ ping giữ ấm
 * mà HANDOFF.md §1.1 còn nợ - Render free ngủ sau ~15 phút không có request.
 * Nghĩa là cron chết thì MẤT CẢ HAI. Vẫn nên có giám sát ngoài (UptimeRobot
 * free).
 *
 * ⚠️ CẢ HAI NHỊP ĐỀU NGHỈ 01:00-06:00 GIỜ VIỆT NAM, viết trong cron là giờ UTC
 * `0-17,23`. Giữ ấm 24/7 tiêu 744 trên 750 giờ instance/tháng của Render (tháng
 * 31 ngày) và hạn mức đó tính cho CẢ workspace; nghỉ 5 giờ mỗi đêm hạ xuống
 * ~589 giờ. Cái giá đã được chốt: khách đầu tiên sau khung nghỉ chờ cold start
 * ~50 giây. Nhịp toà soạn phải nghỉ CÙNG khung - nó cũng là một request tới
 * Render, để nó chạy suốt đêm là khung nghỉ chỉ còn hình thức.
 *
 * ⚠️ MỘT NHỊP DUY NHẤT, và nó KHÔNG chạm database.
 *
 * Nhịp 5 phút gọi `GET /health`. Route đó trả JSON tĩnh, không đụng Prisma. Việc
 * duy nhất của nó là không cho Render ngủ.
 * (Không viết chuỗi cron 5 phút vào chú thích khối: nó chứa dấu đóng comment và
 * sẽ cắt cụt khối này - đã trả giá một lần.)
 *
 * 🔴 NHỊP THỨ HAI ĐÃ BỊ GỠ 29/10/2026. Đừng dựng lại.
 *
 * Nó là `'7 0-17,23 * * *'` - nhịp đập của Toà soạn Agent AI, gọi
 * `POST /api/newsroom/tick` và CÓ truy vấn database. Chủ dự án chốt bỏ hoàn toàn
 * cơ chế Toà soạn và việc tự động đăng bài (docs/refactor-tsudev-2026-q4.md §8).
 *
 * Hệ quả kỹ thuật lớn hơn việc bớt một nhịp: nó là **nguồn đánh thức Neon theo
 * LỊCH duy nhất** của hệ thống. Gỡ nó, cộng bản vá vòng poll 3 giây của
 * `/admin/newsroom` (phát hành 29/10), thì database chỉ còn thức khi có người
 * thật dùng trang quản trị. Neon free cho 100 CU-giờ/tháng và tự ngủ sau ~5 phút
 * không truy vấn; chính việc giữ nó thức là thứ đã treo compute và làm cả site
 * trống suốt hai tháng.
 *
 * ⚠️ ĐỪNG đổi nhịp giữ ấm sang một endpoint CHẠM DATABASE "cho chắc là backend
 * còn sống". Làm vậy là dựng lại đúng cái bẫy vừa gỡ, ở dạng dày hơn 12 lần:
 * truy vấn mỗi 5 phút = compute KHÔNG BAO GIỜ ngủ = ~186 CU-giờ/tháng ở 0,25 CU
 * ⇒ vượt hạn mức ⇒ Neon treo compute ⇒ CẢ SITE trống.
 *
 * 🟢 Việc sắp tới của Worker này: cắm `prod:dem-noi-dung` vào đây (kế hoạch
 * §6.1). Nó là chỗ ĐÚNG vì Worker này miễn phí, có lịch, và KHÔNG có kết nối
 * Postgres - tức vẫn trả lời được đúng lúc database chết, tức đúng lúc cần nhất.
 */

import { doNoiDung, thanhDong } from './demNoiDung';

/** Nhịp ĐO NỘI DUNG. Phải TRÙNG NGUYÊN VĂN một phần tử trong `triggers.crons`. */
const CRON_DEM_NOI_DUNG = '23 1,13 * * *';

export interface Env {
  /** URL gốc của backend trên Render, ví dụ https://tsudev-backend.onrender.com */
  BACKEND_URL: string;
  /** Địa chỉ công khai của site, ví dụ https://tsudev.com */
  SITE_URL: string;
  /** Bot Telegram để báo động. Đặt bằng `wrangler secret put`. Thiếu = chỉ log. */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

// `NEWSROOM_TICK_TOKEN` đã bị gỡ khỏi đây 29/10/2026. Nó gác đường `/tick`, và
// đường đó không còn làm gì - nên giữ lại là giữ một phụ thuộc vào secret chỉ để
// bảo vệ một endpoint đã chết.
//
// Secret trên Cloudflare thì CHƯA xoá, có chủ đích: xoá secret là việc không
// quay lui được, và nó thuộc bước dọn biến môi trường của kế hoạch §8 (bước C2).
// Mã không đọc nó nữa là đủ để nó vô hại.

/**
 * Chỉ giữ cho Render khỏi ngủ. `GET /health` trả JSON tĩnh - không Prisma,
 * không truy vấn, nên Neon vẫn ngủ yên (xem chú thích đầu tệp).
 */
async function keepWarm(env: Env): Promise<void> {
  if (!env.BACKEND_URL) {
    console.error('[cron] thiếu BACKEND_URL - bỏ qua lượt giữ ấm');
    return;
  }
  try {
    const res = await fetch(`${env.BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    console.log(`[cron] giữ ấm → ${res.status}`);
  } catch (err) {
    console.error('[cron] giữ ấm thất bại:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Gửi báo động, và SUY GIẢM ỒN ÀO khi chưa cấu hình.
 *
 * ⚠️ Kênh báo động của repo hiện CHƯA được cấu hình ở đâu cả: `notify.js` hỗ trợ
 * Telegram và email webhook, nhưng `TELEGRAM_BOT_TOKEN` không được khai trong
 * `render.yaml` lẫn `.env.example` - nghĩa là báo động của `migrationGate` cũng
 * đang đi vào hư không. Đặt hai secret dưới đây bằng `npm run cron:secret-telegram`.
 *
 * Khi chưa có secret thì hàm này `console.error` toàn bộ nội dung, nên
 * `npm run cron:tail` vẫn đọc được. Im lặng là thứ duy nhất không được phép:
 * một cổng canh mà hỏng đường báo cũng im lặng thì nó chỉ là một cổng chết đang
 * chạy - đúng điều đợt này ra đời để chấm dứt.
 */
async function baoDong(env: Env, tieuDe: string, than: string): Promise<void> {
  const text = `🚨 *tsudev* — ${tieuDe}\n\n${than}`;
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error('[cron] CHƯA cấu hình Telegram - báo động chỉ nằm ở log này:\n' + text);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // Log CẢ KHI thành công: không có nó thì không phân biệt được "đã gửi" với
    // "chưa bao giờ chạy tới đây".
    console.log(`[cron] báo động → Telegram ${res.status}`);
    if (!res.ok) console.error('[cron] Telegram từ chối:\n' + text);
  } catch (err) {
    console.error(
      '[cron] gửi báo động thất bại:',
      err instanceof Error ? err.message : String(err),
      '\n' + text
    );
  }
}

/**
 * Đo nội dung thật mà site đang phục vụ, báo động khi rỗng.
 *
 * KHÔNG báo động khi ĐẠT. Một tin nhắn "site vẫn ổn" hai lần mỗi ngày là cách
 * nhanh nhất để người ta tắt thông báo, và lúc đó tin ĐỎ cũng không ai đọc.
 */
async function demNoiDung(env: Env): Promise<void> {
  if (!env.SITE_URL) {
    console.error('[cron] thiếu SITE_URL - bỏ qua lượt đo nội dung');
    return;
  }
  const bc = await doNoiDung(env.SITE_URL);
  const dong = bc.ketQua.map(thanhDong);
  console.log(`[cron] đếm nội dung ${bc.base} — ${bc.dat ? 'ĐẠT' : 'TRƯỢT'}\n` + dong.join('\n'));
  if (bc.dat) return;

  const soCanh = bc.ketQua.filter((r) => !r.chiGhiNhan).length;
  await baoDong(
    env,
    `site đang phục vụ nội dung RỖNG (${bc.truot.length}/${soCanh} phép đo)`,
    [
      dong.join('\n'),
      '',
      'Mã trạng thái 200 KHÔNG chứng minh trang có nội dung.',
      'Mọi phép đo rỗng trong khi backend /health còn 200 ⇒ nghi DATABASE trước.',
      'Chẩn: npm run newsroom:canh-kenh · hồ sơ: docs/refactor-tsudev-2026-q4.md §0',
    ].join('\n')
  );
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // HAI nhịp, và sự khác nhau giữa chúng là CHẠM DATABASE hay không:
    //
    //   nhịp 5 phút     → keepWarm, gọi GET /health (JSON tĩnh, không Prisma)
    //   CRON_DEM_NOI_DUNG → đo trang công khai, các trang đó CÓ chạm database
    //
    // Vì thế nhịp đo nội dung phải THƯA. Xem khối chú thích ở `demNoiDung.ts`.
    ctx.waitUntil(event.cron === CRON_DEM_NOI_DUNG ? demNoiDung(env) : keepWarm(env));
  },

  /**
   * Đường `/tick` gõ tay trước đây ép một lượt toà soạn chạy ngay để nghiệm thu.
   * Nay nó trả 410 vô điều kiện.
   *
   * 410 Gone chứ không 404: 404 nói "đường này chưa bao giờ có", còn 410 nói
   * đúng sự thật - nó từng có và đã bị bỏ có chủ đích. Ai gõ lại nó sau này đọc
   * được ngay lý do thay vì tưởng mình gõ sai URL.
   *
   * KHÔNG còn gác bằng token. Cổng đó tồn tại vì để mở thì ai cũng ép toà soạn
   * quay vòng cho tới khi cạn hạn mức Neuron - nhưng không còn toà soạn để ép,
   * nên gác một endpoint chết chỉ để lại một phụ thuộc vào secret.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    void ctx;
    const url = new URL(request.url);

    // Đường gõ tay để nghiệm thu cổng đếm mà không phải chờ tới nhịp kế tiếp.
    // KHÔNG gác bằng secret: nó chỉ ĐỌC các trang công khai của chính site và
    // trả về con số, không đổi gì, không gọi LLM, không tốn hạn mức nào đáng kể.
    // Gác một endpoint chỉ-đọc công khai là thêm một secret để bảo vệ thông tin
    // mà ai cũng tự đo được bằng curl.
    if (url.pathname === '/dem') {
      const bc = await doNoiDung(env.SITE_URL || '');
      return new Response(JSON.stringify(bc, null, 2), {
        status: bc.dat ? 200 : 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname !== '/tick') return new Response('not found', { status: 404 });
    return new Response(
      JSON.stringify({
        error: 'Toà soạn Agent AI đã bị gỡ 29/10/2026',
        why: 'docs/refactor-tsudev-2026-q4.md §8',
      }),
      { status: 410, headers: { 'content-type': 'application/json' } }
    );
  },
};
