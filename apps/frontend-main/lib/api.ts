// Server-side data helpers for frontend-main.
// In dev these hit the local microservices; override via env in other envs.
import { CONTENT, internalHeaders } from './services';
import type { Doc, Post, Project } from './types';

/**
 * Generic ở đây làm một việc cụ thể: buộc giá trị dự phòng và kiểu trả về là
 * MỘT. Trước đây hàm trả `any`, nên trang gọi `post.tieuDe` (sai chính tả) vẫn
 * biên dịch và chỉ hiện "undefined" trên trang thật.
 */
/**
 * KHÔNG gửi danh tính. Blog, tài liệu và dự án là nội dung CÔNG KHAI, và
 * `optionalAuth` của content-service được thiết kế đúng cho việc đó: không có
 * Authorization thì nó bỏ qua bước xác thực chứ không từ chối.
 *
 * Bản trước cắm cứng `x-dev-user: tsudev` + `x-dev-roles: admin` ở đây. Ở
 * production nó vô hại vì service bỏ qua header đó; nhưng ở local, nơi
 * AUTH_DEV_BYPASS bật, MỌI lượt xem trang của khách vãng lai chạy dưới quyền
 * admin. Một đường đọc ẩn danh không được phép mang theo danh tính cao nhất
 * trong hệ thống "để cho chắc".
 */
async function getJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: internalHeaders() });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

export const api = {
  posts: (limit = 6) => getJSON<Post[]>(`${CONTENT}/api/posts?limit=${limit}`, []),
  post: (slug: string) => getJSON<Post | null>(`${CONTENT}/api/posts/${slug}`, null),
  docs: () => getJSON<Doc[]>(`${CONTENT}/api/docs`, []),
  doc: (slug: string) => getJSON<Doc | null>(`${CONTENT}/api/docs/${slug}`, null),
  projects: (limit = 50) => getJSON<Project[]>(`${CONTENT}/api/projects?limit=${limit}`, []),
  project: (slug: string) => getJSON<Project | null>(`${CONTENT}/api/projects/${slug}`, null),
};

export default api;
