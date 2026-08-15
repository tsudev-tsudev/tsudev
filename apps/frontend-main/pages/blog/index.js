import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, SectionHeading, Avatar } from '@tsudev/ui';
import { api } from '../../lib/api';

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 86400) return `${Math.max(1, Math.floor(s / 3600))} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export default function BlogIndex({ posts }) {
  return (
    <Layout active="/blog" bare>
      <Seo title="Blog" path="/blog" description="Bài viết và hướng dẫn kỹ thuật trên tsudev." />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading eyebrow="Blog" title="Bài viết & hướng dẫn" />
        <div className="grid md:grid-cols-2 gap-4">
          {posts.length === 0 && (
            <Card className="p-6 text-muted md:col-span-2">Chưa có bài viết.</Card>
          )}
          {posts.map((p) => (
            <Card
              key={p.id}
              as="a"
              href={`/blog/${p.slug}`}
              hover
              className="p-6 flex flex-col group"
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(p.tags || []).map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <h2 className="text-xl font-bold text-ink leading-snug group-hover:text-brandink transition-colors text-balance">
                {p.title}
              </h2>
              <p className="mt-2 text-sm text-muted flex-1">{p.excerpt}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <Avatar name={p.author?.displayName || 'tsudev'} size={22} />
                {p.author?.displayName || 'tsudev'} · {timeAgo(p.createdAt)}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const posts = await api.posts(50);
  return { props: { posts } };
}
