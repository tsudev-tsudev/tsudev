import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Badge, Avatar, TableOfContents, EmptyState } from '@tsudev/ui';
import type { TocItem } from '@tsudev/ui';
import { api } from '../../lib/api';
import { extractHeadings, renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Post } from '../../lib/types';
import { routeParam } from '../../lib/identity';
import { formatDateVN } from '../../lib/format';

type BlogPostProps = {
  post: Post | null;
  failed: boolean;
  slug: string;
  toc: TocItem[];
};

export default function BlogPost({ post, failed, slug, toc }: BlogPostProps) {
  // Hai nhánh, không một nhánh. Mã trạng thái tương ứng đã được đặt ở
  // getServerSideProps - xem khối chú thích ở đó.
  if (failed)
    return (
      <Layout active="/blog">
        <Seo title="Không tải được bài viết" path={`/blog/${slug}`} noindex />
        <EmptyState
          kind="failed"
          icon="warning"
          title="Không tải được bài viết"
          explain={
            <>
              Bài viết này có thể vẫn còn nguyên - lượt gọi tới máy chủ nội dung đã thất bại. Thử
              tải lại sau ít phút.
            </>
          }
          action={{ label: 'Về danh sách bài viết', href: '/blog' }}
          className="my-10"
        />
      </Layout>
    );
  if (!post)
    return (
      <Layout active="/blog">
        <Seo title="Không tìm thấy bài viết" path={`/blog/${slug}`} noindex />
        <EmptyState
          icon="doc"
          title="Không tìm thấy bài viết"
          explain="Đường dẫn này không trỏ tới bài viết nào. Có thể nó đã được đổi slug."
          action={{ label: 'Về danh sách bài viết', href: '/blog' }}
          className="my-10"
        />
      </Layout>
    );
  return (
    <Layout active="/blog" bare>
      <Seo
        title={post.title}
        path={`/blog/${slug}`}
        description={post.metaDescription || post.excerpt || undefined}
        image={post.coverImageUrl || undefined}
        type="article"
        publishedAt={post.publishedAt || post.createdAt}
      />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <nav className="text-sm text-fg-muted mb-4">
          <a href="/blog" className="hover:text-link">
            Blog
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-fg-secondary">{post.title}</span>
        </nav>
        {post.coverImageUrl && (
          <img
            src={post.coverImageUrl}
            alt=""
            className="w-full rounded-lg mb-6 max-h-96 object-cover border border-line"
          />
        )}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(post.tags || []).map((t: string) => (
            <a key={t} href={`/blog?tag=${encodeURIComponent(t)}`} aria-label={`Lọc theo thẻ ${t}`}>
              <Badge tone="neutral">{t}</Badge>
            </a>
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-fg text-balance leading-tight">
          {post.title}
        </h1>
        <div className="flex items-center gap-2 mt-5 mb-8 text-sm text-fg-muted">
          <Avatar name={post.author?.displayName || 'tsudev'} size={32} />
          <span className="text-fg-secondary font-medium">
            {post.author?.displayName || 'tsudev'}
          </span>
          <span>· {formatDateVN(post.publishedAt || post.createdAt)}</span>
        </div>
        {/* Hai cột từ lg trở lên: thân bài giữ bề rộng đọc được, mục lục bám
            dính bên phải. Dưới lg thì mục lục nằm TRÊN thân bài - trên màn hình
            hẹp nó phải là thứ người đọc gặp trước, không phải thứ họ cuộn qua
            hết bài mới thấy. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
          <div
            className="prose-tsu order-2 lg:order-1 min-w-0"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMd || '') }}
          />
          <aside className="order-1 lg:order-2 lg:sticky lg:top-20">
            <TableOfContents items={toc} />
          </aside>
        </div>

        {(post.references?.length ?? 0) > 0 && (
          <section
            aria-labelledby="nguon-tham-khao"
            className="mt-12 pt-6 border-t border-line max-w-[minmax(0,1fr)]"
          >
            <h2 id="nguon-tham-khao" className="text-lg font-bold text-fg mb-3">
              Nguồn tham khảo
            </h2>
            <ol className="list-decimal pl-5 space-y-1.5 marker:text-fg-muted">
              {(post.references || []).map((r, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline break-words"
                  >
                    {r.label || r.url}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Layout>
  );
}

/// 🔴 BA MÃ TRẠNG THÁI, KHÔNG PHẢI MỘT. Đọc trước khi gộp lại cho gọn.
///
/// Bản trước gọi `api.post()` rồi render "Không tìm thấy bài viết" cho MỌI trường
/// hợp nó trả về null - kể cả khi lượt gọi THẤT BẠI. Nghĩa là lúc content-service
/// hoặc database chết, một bài viết đang tồn tại thật sẽ trả HTTP 200 kèm dòng chữ
/// "không tìm thấy". Với công cụ tìm kiếm đó là soft 404: nó gỡ URL khỏi chỉ mục,
/// và nó không đọc lại nữa vì ta đã trả lời 200 rất dứt khoát.
///
/// Đã xảy ra thật: ngày 28/10/2026 Neon treo compute và toàn bộ nội dung
/// tsudev.com biến mất khỏi mọi trang trong khi mọi trang vẫn 200 (xem
/// `lib/api.ts` § vì sao `Fetched` tồn tại).
///
///   gọi thất bại         -> 503, "không tải được"  -> crawler THỬ LẠI, không gỡ
///   gọi xong, null       -> 404, "không tìm thấy"  -> đúng, bài viết này không có
///   gọi xong, có dữ liệu -> 200
export async function getServerSideProps({ params, res }: GetServerSidePropsContext) {
  const r = await api.post(routeParam(params, 'slug'));
  const post = r.data;
  if (r.failed) res.statusCode = 503;
  else if (!post) res.statusCode = 404;
  // Mục lục dựng ở SERVER: dựng ở client thì nó nháy vào sau khi bài đã hiện,
  // và bố cục hai cột nhảy một nhịp ở mỗi lần tải trang.
  const toc = extractHeadings(post?.contentMd || '');
  return { props: { failed: r.failed, post, slug: routeParam(params, 'slug'), toc } };
}
