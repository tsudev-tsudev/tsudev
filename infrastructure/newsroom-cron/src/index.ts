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
 * Phụ đề quan trọng: mỗi 5 phút gõ cửa Render cũng chính là bộ ping giữ ấm mà
 * HANDOFF.md §1.1 còn nợ - Render free ngủ sau ~15 phút không có request. Nghĩa
 * là cron chết thì MẤT CẢ HAI. Vẫn nên có giám sát ngoài (UptimeRobot free).
 */

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
    // làm gì hơn là một dòng log. Lượt sau cách đây 5 phút.
    console.log(`[cron] tick → ${res.status}`);
  } catch (err) {
    console.error('[cron] tick thất bại:', err instanceof Error ? err.message : String(err));
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(tick(env));
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
