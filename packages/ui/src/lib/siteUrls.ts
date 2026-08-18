// tsudev là MỘT site. Trước đây có hai origin (trang chính và diễn đàn) nên mọi
// link điều hướng phải là URL tuyệt đối dựng từ siteUrl(); bỏ diễn đàn rồi thì
// link tương đối vừa đúng vừa gọn hơn - và không nhúng cứng origin vào HTML.
//
// MAIN_URL giữ lại cho các chỗ BẮT BUỘC cần URL tuyệt đối: thẻ canonical, ảnh
// Open Graph, URL nhúng trong huy hiệu con dấu.
//
// process.env.NEXT_PUBLIC_* phải viết nguyên literal - Next inline giá trị lúc
// build, đọc động qua biến trung gian sẽ ra undefined ở phía trình duyệt.
// Giá trị dự phòng khớp config/topology.json.
const stripSlash = (u: unknown): string => String(u || '').replace(/\/+$/, '');

export const MAIN_URL = stripSlash(
  process.env.NEXT_PUBLIC_MAIN_URL || 'http://tsudev.localhost:8080'
);

export default MAIN_URL;
