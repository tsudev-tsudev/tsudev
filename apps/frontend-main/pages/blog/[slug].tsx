import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, Avatar, TableOfContents } from '@tsudev/ui';
import type { TocItem } from '@tsudev/ui';
import { api } from '../../lib/api';
import { extractHeadings, renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Post } from '../../lib/types';
import { routeParam } from '../../lib/identity';

type BlogPostProps = {
  post: Post | null;
  slug: string;
  toc: TocItem[];
};

export default function BlogPost({ post, slug, toc }: BlogPostProps) {
  if (!post)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy bài viết.</Card>
      </Layout>
    );
  return (
    <Layout active="/blog" bare>
      <Seo
        title={post.title}
        path={`/blog/${slug}`}
        description={post.excerpt || undefined}
        type="article"
        publishedAt={post.createdAt}
      />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/blog" className="hover:text-brandink">
            Blog
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{post.title}</span>
        </nav>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(post.tags || []).map((t: string) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-ink text-balance leading-tight">
          {post.title}
        </h1>
        <div className="flex items-center gap-2 mt-5 mb-8 text-sm text-muted">
          <Avatar name={post.author?.displayName || 'tsudev'} size={32} />
          <span className="text-inksoft font-medium">{post.author?.displayName || 'tsudev'}</span>
          <span>· {new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
        </div>
        {/* Hai cột từ lg trở lên: thân bài giữ bề rộng đọc được, mục lục bám
            dính bên phải. Dưới lg thì mục lục nằm TRÊN thân bài — trên màn hình
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
