import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, Avatar } from '@tsudev/ui';
import { api } from '../../lib/api';
import { renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Post } from '../../lib/types';
import { routeParam } from '../../lib/identity';

type BlogPostProps = { post: Post | null; slug: string };

export default function BlogPost({ post, slug }: BlogPostProps) {
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
      <article className="max-w-3xl mx-auto px-4 py-10">
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
        <div
          className="prose-tsu"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMd || '') }}
        />
      </article>
    </Layout>
  );
}

export async function getServerSideProps({ params }: GetServerSidePropsContext) {
  const post = await api.post(routeParam(params, 'slug'));
  return { props: { post, slug: routeParam(params, 'slug') } };
}
