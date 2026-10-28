import { MAIN_URL } from '@tsudev/ui';
import { api, orThrow } from '../lib/api';
import type { GetServerSidePropsContext } from 'next';

// Sinh động chứ không phải file tĩnh trong public/: bài viết, tài liệu và dự án
// đều nằm trong DB và thay đổi mà không cần build lại.
//
// KHÔNG liệt kê: /admin/*, /settings/* và TOÀN BỘ /trust/*. Con dấu chạy ở chế
// độ mời từ 18/08/2026 nên không trang nào của nó phục vụ được cho khách chưa
// đăng nhập; liệt kê chúng chỉ mời bot đi vào một chuỗi chuyển hướng. SEO của
// site nay do blog, tài liệu và dự án gánh - Quyết định 2 trong
// docs/refactor-trust-invite-access.md.

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/projects', priority: '0.9', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/docs', priority: '0.7', changefreq: 'weekly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/rules', priority: '0.3', changefreq: 'yearly' },
];

const XML_ENTITY: Record<string, string> = {
  '<': 'lt',
  '>': 'gt',
  '&': 'amp',
  "'": 'apos',
  '"': 'quot',
};

// `?? c` giữ nguyên ký tự khi bảng thiếu, thay vì chèn "undefined" vào giữa XML.
const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => `&${XML_ENTITY[c] ?? c};`);

type UrlEntry = {
  path: string;
  /** Chỉ trang có nội dung đổi theo thời gian mới khai. */
  lastmod?: string | Date | null;
  priority?: string;
  changefreq?: string;
};

const urlTag = ({ path, lastmod, priority = '0.6', changefreq = 'weekly' }: UrlEntry) =>
  [
    '  <url>',
    `    <loc>${esc(MAIN_URL + path)}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  // 🔴 ĐỔI CHIỀU 28/10/2026 - đọc trước khi "sửa lại cho khỏi 500".
  //
  // Bản trước cố ý để mỗi lời gọi nuốt lỗi thành [], lập luận rằng "một service
  // chết chỉ làm sitemap thiếu phần đó, không làm cả sitemap 500 - đúng đánh đổi
  // cho một file mà bot đọc chứ người không đọc".
  //
  // Lập luận đó SAI, và cái giá đã được trả. Sitemap không phải "thiếu thông
  // tin" khi rỗng; nó là THÔNG TIN SAI: nó khẳng định với Google rằng site này
  // chỉ có đúng 7 trang tĩnh. Đo ngày 28/10/2026, khi Neon treo compute:
  // `/sitemap.xml` trả 200 với đúng 7 `<url>` - tức tsudev.com tự nguyện xin gỡ
  // toàn bộ blog, tài liệu và dự án khỏi chỉ mục, trong im lặng, suốt hai tháng.
  //
  // Crawler hiểu 5xx là "thử lại sau" và KHÔNG gỡ gì. Nó không có cách nào hiểu
  // một file 7 URL như vậy. Nên ở đây thà ném.
  //
  // Hai lời gọi trust.programs()/trust.directory() đã bị GỠ: sau khi gác, chúng
  // chỉ trả 401 rồi rơi về [], tức một chặng mạng vô nghĩa ở mỗi lần dựng
  // sitemap.
  const [rPosts, rDocs, rProjects] = await Promise.all([
    api.posts(50),
    api.docs(),
    api.projects(100),
  ]);
  const posts = orThrow(rPosts, 'danh sách bài viết');
  const docs = orThrow(rDocs, 'mục lục tài liệu');
  const projects = orThrow(rProjects, 'danh sách dự án');

  const entries = [
    ...STATIC_ROUTES.map((r) => urlTag(r)),
    ...posts.map((p) =>
      urlTag({
        path: `/blog/${p.slug}`,
        lastmod: p.createdAt,
        priority: '0.7',
        changefreq: 'monthly',
      })
    ),
    ...docs.map((d) => urlTag({ path: `/docs/${d.slug}`, priority: '0.6', changefreq: 'monthly' })),
    ...projects.map((p) =>
      urlTag({
        path: `/projects/${p.slug}`,
        lastmod: p.releasedAt,
        priority: '0.8',
        changefreq: 'monthly',
      })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
