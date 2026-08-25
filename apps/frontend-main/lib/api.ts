// Server-side data helpers for frontend-main.
// In dev these hit the local microservices; override via env in other envs.
import { DEFAULT_PAGE_SIZE } from '@tsudev/types';

import { CONTENT, internalHeaders } from './services';
import type { Doc, Post, PostSearchResult, Project } from './types';

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
  posts: (limit = 6, tag?: string) =>
    getJSON<Post[]>(
      `${CONTENT}/api/posts?limit=${limit}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`,
      []
    ),
  post: (slug: string) => getJSON<Post | null>(`${CONTENT}/api/posts/${slug}`, null),
  // Tìm/lọc theo SEARCH_AND_FILTER §7. `query` là chuỗi truy vấn đã ghép sẵn
  // (q, tag, sort, page, page_size). Dùng cho SSR trang /search và proxy client.
  searchPosts: (query: string) =>
    getJSON<PostSearchResult>(`${CONTENT}/api/posts/search?${query}`, {
      data: [],
      meta: {
        total: 0,
        page: 1,
        page_size: DEFAULT_PAGE_SIZE,
        total_pages: 1,
        query_normalized: '',
      },
      facets: { tag: [] },
    }),
  // `/api/docs` trả `{data, meta}` từ 26/08/2026 (mục lục có trần). Gỡ vỏ ở
  // ĐÂY chứ không ở từng trang: ba trang dùng nó (mục lục, trang chủ, sitemap)
  // và chỉ cần danh sách. `lib/api` nuốt lỗi thành giá trị rỗng, nên hình dạng
  // sai ở đây sẽ hiện ra dưới dạng TRANG TRỐNG chứ không phải lỗi - vì thế phép
  // gỡ vỏ phải kiểm `Array.isArray`, đừng tin thẳng.
  docs: async () => {
    const body = await getJSON<{ data?: Doc[] } | Doc[]>(`${CONTENT}/api/docs`, { data: [] });
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.data) ? body.data : [];
  },
  doc: (slug: string) => getJSON<Doc | null>(`${CONTENT}/api/docs/${slug}`, null),
  projects: (limit = 50) => getJSON<Project[]>(`${CONTENT}/api/projects?limit=${limit}`, []),
  project: (slug: string) => getJSON<Project | null>(`${CONTENT}/api/projects/${slug}`, null),
};

export default api;
