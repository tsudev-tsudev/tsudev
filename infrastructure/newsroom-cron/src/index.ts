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
 * ⚠️ HAI NHỊP, KHÔNG PHẢI MỘT - và lý do là hạn mức của NEON, không phải của
 * Cloudflare:
 *
 *   - Nhịp 5 phút gọi `GET /health`. Route đó trả JSON tĩnh, KHÔNG chạm
 *     database. Việc duy nhất của nó là không cho Render ngủ.
 *     (Không viết chuỗi cron 5 phút vào chú thích khối: nó chứa dấu đóng
 *     comment và sẽ cắt cụt khối này - đã trả giá một lần.)
 *   - `TICK_CRON` (mỗi giờ) mới gọi `POST /api/newsroom/tick`, và lượt đó
 *     truy vấn database.
 *
 * Gộp cả hai vào nhịp 5 phút thì mỗi lượt đều đánh thức Neon, mà Neon free chỉ
 * cho 100 CU-giờ/tháng và tự ngủ sau ~5 phút không có truy vấn. Truy vấn đúng
 * mỗi 5 phút = compute KHÔNG BAO GIỜ ngủ = ~186 CU-giờ/tháng ở 0,25 CU ⇒ vượt
 * hạn mức ⇒ Neon treo compute tới đầu tháng sau ⇒ CẢ SITE chết, không chỉ toà
 * soạn. Nhịp giờ để Neon ngủ lại giữa hai lượt.
 *
 * Toà soạn viết vài bài một ngày, nên nhịp giờ là thừa sức. Đổi TICK_CRON thì
 * phải đổi ĐỒNG THỜI chuỗi trong `wrangler.jsonc` - so khớp bằng chuỗi nguyên
 * văn, lệch một ký tự là lượt đó rơi xuống nhánh giữ ấm và toà soạn đứng yên.
 */

/** Phải TRÙNG NGUYÊN VĂN một phần tử trong `triggers.crons` của wrangler.jsonc. */
const TICK_CRON = '7 0-17,23 * * *';

export interface Env {
  /** URL gốc của backend trên Render, ví dụ https://tsudev-backend.onrender.com */
  BACKEND_URL: string;
  /** Bí mật khớp với NEWSROOM_TICK_TOKEN ở Render. Đặt bằng `wrangler secret put`. */
  NEWSROOM_TICK_TOKEN: string;
}

async function tick(env: Env): Promise<void> {
  if (!env.BACKEND_URL || !env.NEWSROOM_TICK_TOKEN) {
    console.error('[cron] thiếu BACKEND_URL hoặc NEWSROOM_TICK_TOKEN - bỏ qua lượt này');
    return;
  }

  // Timeout cứng 30 giây: endpoint tick trả 202 NGAY rồi chạy việc ở nền, nên
  // một lượt gọi lành mạnh phải xong trong vài trăm mili giây. Chờ lâu hơn thế
  // nghĩa là Render đang khởi động lại từ trạng thái ngủ - lượt sau sẽ tới.
  try {
    const res = await fetch(`${env.BACKEND_URL}/api/newsroom/tick`, {
      method: 'POST',
      headers: {
        'x-newsroom-token': env.NEWSROOM_TICK_TOKEN,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(30_000),
    });
    // Không ném khi lỗi: cron không có ai để báo, và một lượt hỏng không đáng
    // làm gì hơn là một dòng log. Lượt sau cách đây một giờ.
    console.log(`[cron] tick → ${res.status}`);
  } catch (err) {
    console.error('[cron] tick thất bại:', err instanceof Error ? err.message : String(err));
  }
}

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

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(event.cron === TICK_CRON ? tick(env) : keepWarm(env));
  },

  /**
   * Đường gõ tay để nghiệm thu mà không phải chờ 5 phút.
   *
   * Gác bằng CHÍNH token đó: Worker này có URL công khai, và để mở thì bất kỳ
   * ai cũng ép toà soạn quay vòng liên tục cho tới khi cạn hạn mức Neuron.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/tick') return new Response('not found', { status: 404 });
    if (request.headers.get('x-newsroom-token') !== env.NEWSROOM_TICK_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    ctx.waitUntil(tick(env));
    return new Response(JSON.stringify({ accepted: true }), {
      headers: { 'content-type': 'application/json' },
    });
  },
};
