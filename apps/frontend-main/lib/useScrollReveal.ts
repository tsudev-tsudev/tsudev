import { useEffect } from 'react';

/**
 * Bật scroll-reveal cho mọi phần tử mang class `reveal` trên trang hiện tại.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BA QUYẾT ĐỊNH, CẢ BA ĐỀU ĐỂ TRÁNH MỘT CÁCH HỎNG IM LẶNG
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * 1. TRẠNG THÁI ẨN DO HOOK NÀY BẬT, KHÔNG PHẢI DO CSS MẶC ĐỊNH.
 *
 *    Cách viết hiển nhiên là để CSS đặt `opacity: 0` rồi JavaScript thêm class để
 *    hiện. Cách đó ẩn nội dung VĨNH VIỄN nếu JavaScript không chạy: lỗi bundle,
 *    người dùng tắt JS, hoặc một ngoại lệ ở component khác làm hỏng cả lượt
 *    hydrate. Trang vẫn 200, HTML vẫn đủ chữ, và người ta thấy trang trắng.
 *
 *    Nên hook này đặt `data-reveal="on"` lên <html>, và CSS chỉ ẩn khi thấy
 *    thuộc tính đó. Không có JavaScript ⇒ không có thuộc tính ⇒ mọi thứ hiện
 *    bình thường. Xem khối SCROLL-REVEAL trong `styles/globals.css`.
 *
 * 2. `prefers-reduced-motion` ⇒ KHÔNG BẬT GÌ CẢ, không phải "chạy nhanh hơn".
 *
 *    `globals.css` đã có khối ép mọi transition về 0.001ms dưới reduced-motion,
 *    nên về lý thuyết chỉ cần thế. Nhưng nó vẫn để lại một khoảnh khắc nội dung
 *    ở `opacity: 0` - và với người thật sự cần cài đặt đó (rối loạn tiền đình,
 *    động kinh ánh sáng), "nhấp nháy rất nhanh" còn tệ hơn "không chuyển động".
 *
 * 3. `unobserve` sau khi hiện. Không có nó thì mỗi lần cuộn qua lại là một lượt
 *    callback cho mọi phần tử đã hiện xong - trên một trang danh sách 50 bài đó
 *    là hàng nghìn lượt gọi vô ích trong lúc cuộn, đúng lúc cần mượt nhất.
 *
 * Dùng: gọi `useScrollReveal()` một lần trong component trang, rồi đặt class
 * `reveal` (kèm `reveal-1`/`reveal-2`/`reveal-3` nếu muốn bậc thang trễ) lên các
 * khối muốn hiện dần.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    // `matchMedia` có thể không tồn tại trong môi trường test/jsdom cũ.
    const giamChuyenDong =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Không có IntersectionObserver thì không bật trạng thái ẩn - thà không có
    // chuyển động còn hơn có nội dung không bao giờ hiện.
    if (giamChuyenDong || typeof IntersectionObserver === 'undefined') return undefined;

    const goc = document.documentElement;
    goc.dataset.reveal = 'on';

    const obs = new IntersectionObserver(
      (muc) => {
        for (const m of muc) {
          if (!m.isIntersecting) continue;
          m.target.classList.add('is-in');
          obs.unobserve(m.target);
        }
      },
      {
        // Ngưỡng 0.1 + lề đáy âm: khối phải vào thật sự trong khung nhìn mới
        // hiện. Ngưỡng 0 làm mọi thứ hiện ngay khi mép trên vừa chạm đáy màn
        // hình, tức người ta không bao giờ THẤY chuyển động - chỉ thấy nội dung
        // đã sẵn ở đó, và cả cơ chế này thành vô nghĩa.
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const dsach = Array.from(document.querySelectorAll('.reveal'));
    // Khối nào ĐANG ở trong khung nhìn lúc tải trang thì hiện NGAY, không chờ
    // observer. Không làm vậy thì phần đầu trang nhấp một nhịp ở mỗi lần tải -
    // và đó là phần duy nhất ai cũng thấy.
    for (const el of dsach) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
      else obs.observe(el);
    }

    return () => {
      obs.disconnect();
      // Gỡ thuộc tính khi rời trang: trang kế tiếp có thể không gọi hook này, và
      // để `data-reveal="on"` ở lại sẽ ẩn mọi `.reveal` của trang đó mà không
      // có observer nào hiện chúng ra.
      delete goc.dataset.reveal;
    };
  }, []);
}

export default useScrollReveal;
