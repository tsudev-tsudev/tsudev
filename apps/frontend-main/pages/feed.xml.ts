import { MAIN_URL } from '@tsudev/ui';
import { api } from '../lib/api';
import type { GetServerSidePropsContext } from 'next';

// RSS 2.0 cho blog. Đọc bằng trình đọc feed, và cũng là cách các trang tổng hợp
// nội dung kỹ thuật lấy bài mà không cần crawl.
//
// Cố ý chỉ phát TÓM TẮT (excerpt), không phát toàn văn: nội dung bài là markdown
// được render phía trang, nhồi nguyên vào <description> sẽ ra HTML sai và trùng
// nội dung với chính trang gốc.

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

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  const posts = await api.posts(50);

  const items = posts
    .map((p) =>
      [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(`${MAIN_URL}/blog/${p.slug}`)}</link>`,
        // guid phải ổn định và duy nhất; URL bài viết thoả cả hai.
        `      <guid isPermaLink="true">${esc(`${MAIN_URL}/blog/${p.slug}`)}</guid>`,
        p.createdAt ? `      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>` : null,
        p.author && p.author.displayName
          ? `      <dc:creator>${esc(p.author.displayName)}</dc:creator>`
          : null,
        ...(Array.isArray(p.tags) ? p.tags.map((t) => `      <category>${esc(t)}</category>`) : []),
        `      <description>${esc(p.excerpt || '')}</description>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');

  const newest = posts[0];
  const latest = newest?.createdAt ? new Date(newest.createdAt) : new Date(0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Blog tsudev</title>
    <link>${esc(`${MAIN_URL}/blog`)}</link>
    <description>Bài viết &amp; hướng dẫn kỹ thuật trên tsudev.</description>
    <language>vi</language>
    <lastBuildDate>${latest.toUTCString()}</lastBuildDate>
    <atom:link href="${esc(`${MAIN_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function Feed() {
  return null;
}
