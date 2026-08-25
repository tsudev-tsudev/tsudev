import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Giới hạn tần suất DÙNG CHUNG cho các service backend.
 *
 * Tách ra từ trust-service (nơi nó ra đời để chặn lạm dụng các endpoint CÔNG
 * KHAI của con dấu) để content-service và storage-service dùng lại mà không sao
 * chép. Ba service gộp thành MỘT tiến trình (`services/backend-bundle`), nên bộ
 * đếm trong bộ nhớ tiến trình là chia sẻ đúng như giả định dưới đây.
 *
 * VÌ SAO Ở ĐÂY MÀ KHÔNG PHẢI Ở DB
 *
 * Các endpoint này bị gọi bởi trình duyệt của khách trên site BÊN THỨ BA - mỗi
 * lượt xem một trang có gắn huy hiệu là một request. Ghi một dòng DB cho mỗi
 * lượt xem đó là biến bộ đếm chống lạm dụng thành chính nguồn tải.
 *
 * GIẢ ĐỊNH MỘT TIẾN TRÌNH
 *
 * Bộ đếm nằm trong bộ nhớ tiến trình. Giả định: production chạy ĐÚNG MỘT tiến
 * trình (`services/backend-bundle`, xem render.yaml). Giả định đó ghi ra đây vì
 * nó VỠ nếu sau này chạy nhiều bản - lúc đó mỗi bản có xô riêng và ngưỡng thực
 * tế nhân lên theo số bản.
 *
 * KEY LÀ IP CLIENT THẬT, KHÔNG PHẢI IP HẠ TẦNG
 *
 * `callerIp` đọc `x-forwarded-for`. Lưu ý: BFF của Next (Cloudflare Workers)
 * KHÔNG chuyển IP client xuống khi gọi service, nên lưu lượng hợp lệ đi qua BFF
 * mang chung một IP egress. Vì thế nơi gọi phải MIỄN TRỪ lưu lượng tin cậy (mang
 * `x-internal-token` đúng) khỏi limiter, và chỉ giới hạn lưu lượng TRỰC TIẾP
 * (không token) theo IP thật - đó mới là mối đe dọa. trust-service cố ý không có
 * internal token nên giới hạn toàn bộ nhánh công khai của nó.
 *
 * Thuật toán là cửa sổ trượt xấp xỉ bằng hai xô: đơn giản hơn token bucket,
 * không cần hẹn giờ, và không bao giờ cho qua quá 2× ngưỡng trong một cửa sổ.
 */

type Bucket = { windowStart: number; count: number; prevCount: number };

/**
 * Giới hạn số mục nhớ.
 *
 * Không có nó thì chính bộ giới hạn trở thành lỗ hổng: kẻ tấn công gửi request
 * từ các IP giả khác nhau và bảng lớn tới lúc hết bộ nhớ. Chạm trần thì xoá
 * sạch - thà mất bộ đếm một nhịp còn hơn chết vì hết RAM.
 */
const MAX_KEYS = 20_000;

export function createRateLimit(opts: {
  windowMs: number;
  max: number;
  /** Tiền tố log, để biết bộ nào đang chặn. */
  name: string;
  /**
   * Khoá của một xô. Mặc định là IP người gọi.
   *
   * Đổi được vì có giới hạn phải đếm theo TÀI KHOẢN chứ không theo IP: mốc
   * `page_size` lớn (DATA_TABLE.md mục 8.4) là quyền của một tài khoản đã đăng
   * nhập, và đếm theo IP thì cả một văn phòng dùng chung NAT sẽ chặn lẫn nhau,
   * trong khi một tài khoản đổi IP lại thoát.
   */
  keyOf?: (req: Request) => string;
  /**
   * Chỉ tính giới hạn khi hàm này trả true. Mặc định: mọi request.
   *
   * Dùng cho giới hạn CÓ ĐIỀU KIỆN - ví dụ chỉ chặn khi client xin mốc lớn, còn
   * lưu lượng bình thường đi thẳng. Trả false là KHÔNG đếm, không chỉ là không
   * chặn: nếu vẫn đếm thì một người lật trang mốc 10 cả ngày sẽ tự khoá mình ra
   * khỏi mốc 200.
   */
  when?: (req: Request) => boolean;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    if (opts.when && !opts.when(req)) return next();

    const now = Date.now();
    const key = opts.keyOf ? opts.keyOf(req) : callerIp(req);

    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= MAX_KEYS) buckets.clear();
      b = { windowStart: now, count: 0, prevCount: 0 };
      buckets.set(key, b);
    }

    const elapsed = now - b.windowStart;
    if (elapsed >= opts.windowMs) {
      // Cửa sổ mới. Giữ lại số đếm của cửa sổ trước để nội suy - nếu không thì
      // đúng lúc chuyển cửa sổ, một kẻ tấn công gửi được 2× ngưỡng liền nhau.
      b.prevCount = elapsed >= opts.windowMs * 2 ? 0 : b.count;
      b.count = 0;
      b.windowStart = now;
    }

    const weight = 1 - (now - b.windowStart) / opts.windowMs;
    const estimated = b.count + b.prevCount * weight;

    if (estimated >= opts.max) {
      const retryAfter = Math.ceil((opts.windowMs - (now - b.windowStart)) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ error: 'Quá nhiều yêu cầu, thử lại sau' });
    }

    b.count += 1;
    return next();
  };
}

/**
 * IP của người gọi.
 *
 * Đọc `x-forwarded-for` là bắt buộc: service luôn đứng sau proxy (dev-proxy ở
 * local, Render ở production), nên `req.ip` là địa chỉ của proxy - giới hạn
 * theo nó sẽ gộp cả thế giới vào một xô.
 */
export function callerIp(req: Request): string {
  const raw = req.headers['x-forwarded-for'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const ip = first?.split(',')[0]?.trim() || req.ip || 'unknown';
  return ip.slice(0, 45);
}

/**
 * Giới hạn riêng cho yêu cầu xin mốc `page_size` LỚN (>= 100).
 *
 * DATA_TABLE.md mục 8.4 gọi đây là "cái giá của việc nâng trần từ 100 lên 200,
 * và là điều kiện của việc nâng đó" - nên nó không phải tuỳ chọn. Một tài khoản
 * kéo 200 bản ghi mỗi lần, lặp liên tục, là đường cạn tài nguyên rẻ nhất mà một
 * người ĐÃ ĐĂNG NHẬP có thể tạo ra.
 *
 * Đếm theo TÀI KHOẢN (mục 8.4 nói "/tài khoản"), lùi về IP khi chưa nhận dạng
 * được. Chỉ đếm khi request thật sự xin mốc lớn: người lật trang ở mốc 10 cả
 * ngày không được phép tự khoá mình ra khỏi mốc 200.
 *
 * `identify` do service truyền vào vì mỗi service nhận dạng người gọi một kiểu
 * (khẳng định danh tính của BFF, phiên, token nội bộ) - module này cố ý không
 * biết gì về xác thực.
 */
export function largePageRateLimit(opts: {
  /** Mặc định 10 yêu cầu / phút / tài khoản, đúng đề xuất của mục 8.4. */
  max?: number;
  windowMs?: number;
  name?: string;
  identify?: (req: Request) => string | null | undefined;
}): RequestHandler {
  const threshold = 100;
  return createRateLimit({
    windowMs: opts.windowMs ?? 60_000,
    max: opts.max ?? 10,
    name: opts.name ?? 'page_size lớn',
    when: (req) => {
      // Đọc CẢ query lẫn body: bộ tham số chuẩn là của một GET, nhưng vài
      // endpoint danh sách trong repo này là POST (chúng gác bằng khẳng định
      // danh tính trong body). Chỉ đọc query thì giới hạn im lặng không bao giờ
      // kích hoạt trên đúng những endpoint quản trị cần nó nhất.
      const q = (req.query as Record<string, unknown> | undefined)?.page_size;
      const b = (req.body as Record<string, unknown> | undefined)?.page_size;
      const n = parseInt(String(q ?? b ?? ''), 10);
      return Number.isFinite(n) && n >= threshold;
    },
    keyOf: (req) => {
      const who = opts.identify?.(req);
      return who ? `u:${who}` : `ip:${callerIp(req)}`;
    },
  });
}
