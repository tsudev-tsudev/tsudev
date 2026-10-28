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

export interface Env {
  /** URL gốc của backend trên Render, ví dụ https://tsudev-backend.onrender.com */
  BACKEND_URL: string;
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

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // KHÔNG còn phân nhánh theo `event.cron`: chỉ còn một nhịp, và nó là giữ ấm.
    // `event` giữ trong chữ ký vì runtime truyền vào, nhưng không đọc nữa.
    void event;
    ctx.waitUntil(keepWarm(env));
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
    void env;
    void ctx;
    const url = new URL(request.url);
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
