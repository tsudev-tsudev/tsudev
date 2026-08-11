// Hai frontend chạy trên hai origin khác nhau (dev: tsudev.localhost và
// forum.tsudev.localhost qua dev-proxy; prod: tsudev.vn và forum.tsudev.vn) nhưng
// dùng chung SiteHeader/SiteFooter. Đường dẫn tương đối trong menu sẽ bám theo
// origin đang mở, nên đứng ở forum bấm "Blog" sẽ ra :3001/blog và 404. Vì vậy
// mọi liên kết điều hướng giữa hai app phải là URL tuyệt đối dựng từ đây.
//
// process.env.NEXT_PUBLIC_* phải viết nguyên literal — Next inline giá trị lúc
// build, đọc động qua biến trung gian sẽ ra undefined ở phía trình duyệt.
const stripSlash = (u) => String(u || '').replace(/\/+$/, '');

// Giá trị dự phòng phải khớp config/topology.json (chế độ proxy). Không đọc
// được topology ở đây: file này chạy cả trong trình duyệt.
export const MAIN_URL = stripSlash(
  process.env.NEXT_PUBLIC_MAIN_URL || 'http://tsudev.localhost:8080'
);
export const FORUM_URL = stripSlash(
  process.env.NEXT_PUBLIC_FORUM_URL || 'http://forum.tsudev.localhost:8080'
);

// Khi hai app về chung một domain (đặt hai biến bằng nhau, hoặc để trống) thì
// base rỗng và kết quả tự thu về đường dẫn tương đối — không cần sửa gọi bên.
export const siteUrl = (app, path = '/') => {
  const base = app === 'forum' ? FORUM_URL : MAIN_URL;
  if (!path || path === '/') return base || '/';
  return `${base}${path}`;
};

export default siteUrl;
