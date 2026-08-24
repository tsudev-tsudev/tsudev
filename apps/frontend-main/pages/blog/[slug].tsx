import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, Avatar, TableOfContents } from '@tsudev/ui';
import type { TocItem } from '@tsudev/ui';
import { api } from '../../lib/api';
import { extractHeadings, renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Post } from '../../lib/types';
import { routeParam } from '../../lib/identity';
import { formatDateVN } from '../../lib/format';

type BlogPostProps = {
  post: Post | null;
  slug: string;
  toc: TocItem[];
};

export default function BlogPost({ post, slug, toc }: BlogPostProps) {
  if (!post)
    return (
      <Layout>
        <Card className="p-8 text-center text-fg-muted">Không tìm thấy bài viết.</Card>
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

export async function getServerSideProps({ params }: GetServerSidePropsContext) {
  const post = await api.post(routeParam(params, 'slug'));
  // Mục lục dựng ở SERVER: dựng ở client thì nó nháy vào sau khi bài đã hiện,
  // và bố cục hai cột nhảy một nhịp ở mỗi lần tải trang.
  const toc = extractHeadings(post?.contentMd || '');
  return { props: { post, slug: routeParam(params, 'slug'), toc } };
}
