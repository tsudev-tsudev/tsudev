// Server-side data helpers for frontend-main.
// In dev these hit the local microservices; override via env in other envs.
import { DEFAULT_PAGE_SIZE } from '@tsudev/types';

import { CONTENT, internalHeaders } from './services';
import type {
  Doc,
  Post,
  PostSearchResult,
  Project,
  ProjectRelease,
  ProjectWithReleases,
} from './types';

/**
 * Kết quả một lượt đọc, mang theo CẢ dữ liệu LẪN việc lượt gọi có thất bại hay
 * không.
 *
 * 🔴 VÌ SAO HÀM NÀY KHÔNG CHỈ TRẢ VỀ DỮ LIỆU - đây là bài học đắt nhất của repo.
 *
 * Bản trước trả thẳng `T` và nuốt mọi lỗi thành giá trị rỗng. Lý do gốc đúng và
 * vẫn đúng: trang công khai không nên 500 vì một service phụ chết. Nhưng nó gộp
 * HAI trạng thái khác nhau về bản chất thành MỘT:
 *
 *   - "truy vấn xong, không có dữ liệu"   → trang trống là ĐÚNG
 *   - "không truy vấn được"                → trang trống là LỖI
 *
 * Người xem thấy y hệt nhau. Agent nghiệm thu thấy y hệt nhau. CI thấy y hệt
 * nhau. Và vì thế ngày 28/10/2026 đo được: Neon treo compute vì vượt hạn mức,
 * MỌI trang công khai của tsudev.com trả HTTP 200 với nội dung rỗng,
 * `sitemap.xml` còn đúng 7 URL tĩnh, `feed.xml` 0 item - và việc đó đã sống
 * HAI THÁNG mà không một cổng kiểm nào đỏ lên, vì mọi cổng đều chỉ hỏi "trang
 * có trả 200 không".
 *
 * Nay `failed` buộc mỗi nơi gọi phải TỰ QUYẾT ĐỊNH, và TypeScript không cho bỏ
 * qua: trang người đọc thì hiện khối lỗi nhìn thấy được, tài nguyên máy đọc thì
 * `orThrow()`.
 */
export type Fetched<T> = { data: T; failed: boolean };

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
 *
 * Hàm này vẫn KHÔNG NÉM LỖI - đó là hợp đồng, và `orThrow()` là chỗ duy nhất
 * được phép đổi ý về điều đó.
 */
async function getJSON<T>(url: string, fallback: T): Promise<Fetched<T>> {
  try {
    const res = await fetch(url, { headers: internalHeaders() });
    if (!res.ok) {
      // Log ở phía server: đây là tầng duy nhất BIẾT lượt gọi đã thất bại, nên
      // im lặng ở đây là mất dấu vĩnh viễn. `console.error` của Worker đi vào
      // `wrangler tail`.
      console.error(`[api] ${res.status} ${res.statusText} khi gọi ${url}`);
      return { data: fallback, failed: true };
    }
    return { data: (await res.json()) as T, failed: false };
  } catch (e) {
    console.error(`[api] không gọi được ${url}:`, e instanceof Error ? e.message : e);
    return { data: fallback, failed: true };
  }
}

/**
 * Bóc dữ liệu, NÉM LỖI nếu lượt gọi thất bại. Dùng cho tài nguyên MÁY ĐỌC:
 * `sitemap.xml`, `feed.xml`.
 *
 * Vì sao chúng phải ném thay vì phát ra file rỗng: một sitemap rỗng không phải
 * "thiếu thông tin", nó là THÔNG TIN SAI gửi cho công cụ tìm kiếm - nó khẳng
 * định "site này chỉ có 7 trang", và hệ quả là phần còn lại bị gỡ khỏi chỉ mục.
 * Một RSS 0 item nói với mọi reader rằng blog đã ngừng. Crawler hiểu 5xx là
 * "thử lại sau" và không gỡ gì; nó không có cách nào hiểu một file rỗng như vậy.
 */
export function orThrow<T>(r: Fetched<T>, what: string): T {
  if (r.failed) throw new Error(`[api] không đọc được ${what} từ content-service`);
  return r.data;
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
      facets: { tag: [], category: [], type: [] },
    }),
  // `/api/docs` trả `{data, meta}` từ 26/08/2026 (mục lục có trần). Gỡ vỏ ở
  // ĐÂY chứ không ở từng trang: ba trang dùng nó (mục lục, trang chủ, sitemap)
  // và chỉ cần danh sách. Phép gỡ vỏ phải kiểm `Array.isArray`, đừng tin thẳng -
  // hình dạng sai sẽ hiện ra dưới dạng danh sách rỗng, và `failed: false` sẽ nói
  // rằng đó là rỗng THẬT.
  docs: async (): Promise<Fetched<Doc[]>> => {
    const r = await getJSON<{ data?: Doc[] } | Doc[]>(`${CONTENT}/api/docs`, { data: [] });
    const body = r.data;
    const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    return { data: list, failed: r.failed };
  },
  doc: (slug: string) => getJSON<Doc | null>(`${CONTENT}/api/docs/${slug}`, null),
  projects: (limit = 50) => getJSON<Project[]>(`${CONTENT}/api/projects?limit=${limit}`, []),
  project: (slug: string) => getJSON<Project | null>(`${CONTENT}/api/projects/${slug}`, null),

  /// Bản phát hành của MỘT dự án. Dùng ở trang chi tiết dự án.
  projectReleases: (slug: string) =>
    getJSON<ProjectRelease[]>(`${CONTENT}/api/projects/${slug}/releases`, []),

  /// MỌI dự án CÓ bản phát hành, gộp sẵn. Một lượt mạng, không phải N+1 - xem
  /// lý do ở chính endpoint trong content-service.
  releases: (limit = 20) =>
    getJSON<ProjectWithReleases[]>(`${CONTENT}/api/releases?limit=${limit}`, []),
};

export default api;
