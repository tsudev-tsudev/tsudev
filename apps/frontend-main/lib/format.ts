/**
 * Định dạng ngày giờ - BẮT BUỘC toàn hệ thống, `docs/DESIGN_SYSTEM.md` §4.
 *
 *   Ngày     `DD/MM/YYYY`        ví dụ 01/02/2027
 *   Ngày giờ `HH:mm DD/MM/YYYY`  ví dụ 14:30 19/08/2026
 *
 * Vì sao không gọi thẳng `toLocaleDateString('vi-VN')` như trước: nó bỏ số 0 đầu
 * ở ngày và tháng, nên 05/08/2026 in ra thành `5/8/2026`. Sai lệch đó không làm
 * gì đỏ và không ai báo lỗi - nó chỉ làm mỗi trang hiện một độ rộng ngày khác
 * nhau, và cột ngày trong bảng thôi thẳng hàng.
 *
 * `timeZone` ghim vào Asia/Ho_Chi_Minh chứ không lấy theo máy: trang được dựng
 * SSR trên Cloudflare Workers (UTC) rồi hydrate ở trình duyệt người đọc. Để múi
 * giờ trôi theo nơi chạy thì cùng một bài viết hiện hai ngày khác nhau giữa HTML
 * server dựng và HTML client vẽ - React báo lệch hydration, và với bài đăng lúc
 * đêm thì ngày hiển thị lệch hẳn một hôm.
 */
const TZ = 'Asia/Ho_Chi_Minh';

const DATE = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
});

const TIME = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});

type DateLike = string | number | Date | null | undefined;

/** Giá trị hiện khi không có ngày. Dấu gạch, KHÔNG phải chuỗi `dd/mm/yyyy`. */
export const NO_DATE = '-';

const parse = (d: DateLike): Date | null => {
  if (d === null || d === undefined || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/** `DD/MM/YYYY`. */
export const formatDateVN = (d: DateLike): string => {
  const dt = parse(d);
  return dt ? DATE.format(dt) : NO_DATE;
};

/** `HH:mm DD/MM/YYYY`. */
export const formatDateTimeVN = (d: DateLike): string => {
  const dt = parse(d);
  return dt ? `${TIME.format(dt)} ${DATE.format(dt)}` : NO_DATE;
};

/**
 * Gợi ý cho ô nhập ngày. §4 đòi ví dụ bằng SỐ THẬT - `VD: 01/02/2027` - chứ
 * không phải chuỗi chữ `dd/mm/yyyy`, thứ mà người dùng hay gõ y nguyên vào ô.
 */
export const DATE_PLACEHOLDER = 'VD: 01/02/2027';
