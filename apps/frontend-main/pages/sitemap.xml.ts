import { MAIN_URL } from '@tsudev/ui';
import { api } from '../lib/api';
import { trust } from '../lib/trust';
import type { GetServerSidePropsContext } from 'next';

// Sinh động chứ không phải file tĩnh trong public/: bài viết, tài liệu, dự án và
// chứng chỉ đều nằm trong DB và thay đổi mà không cần build lại.
//
// KHÔNG liệt kê: /admin/* (riêng tư), /trust/apply và /trust/portal (chỉ có
// nghĩa khi đã đăng nhập). robots.txt chặn thêm một lớp nữa.

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/projects', priority: '0.9', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/docs', priority: '0.7', changefreq: 'weekly' },
  { path: '/trust', priority: '0.8', changefreq: 'weekly' },
  { path: '/trust/directory', priority: '0.7', changefreq: 'daily' },
  { path: '/trust/verify', priority: '0.5', changefreq: 'monthly' },
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
  // Mỗi lời gọi tự nuốt lỗi thành [] (lib/api.js, lib/trust.js). Nghĩa là một
  // service chết chỉ làm sitemap thiếu phần đó, không làm cả sitemap 500 —
  // đúng đánh đổi cho một file mà bot đọc chứ người không đọc.
  const [posts, docs, projects, programs, directory] = await Promise.all([
    api.posts(50),
    api.docs(),
    api.projects(100),
    trust.programs(),
    trust.directory('?limit=100'),
  ]);

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
    ...programs.map((p) =>
      urlTag({ path: `/trust/programs/${p.slug}`, priority: '0.6', changefreq: 'monthly' })
    ),
    ...directory.map((c) =>
      urlTag({
        path: `/trust/verify/${c.serial}`,
        lastmod: c.issuedAt,
        priority: '0.5',
        changefreq: 'monthly',
      })
    ),
    // Một tổ chức có thể có nhiều chứng chỉ nhưng chỉ một trang hồ sơ.
    ...[...new Set(directory.map((c) => c.organizationId).filter(Boolean))].map((id) =>
      urlTag({ path: `/trust/org/${id}`, priority: '0.6', changefreq: 'weekly' })
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
