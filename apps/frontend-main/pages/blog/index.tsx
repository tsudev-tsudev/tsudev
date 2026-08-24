import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, SectionHeading, Avatar, Button, Icon } from '@tsudev/ui';
import { api } from '../../lib/api';
import type { Post } from '../../lib/types';
import type { GetServerSidePropsContext } from 'next';

function timeAgo(d: string | Date): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 86400) return `${Math.max(1, Math.floor(s / 3600))} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

type BlogIndexProps = { posts: Post[]; tag: string | null; allTags: string[] };

export default function BlogIndex({ posts, tag, allTags }: BlogIndexProps) {
  return (
    <Layout active="/blog" bare>
      <Seo title="Blog" path="/blog" description="Bài viết và hướng dẫn kỹ thuật trên tsudev." />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Blog"
          title="Bài viết & hướng dẫn"
          action={
            <Button as="a" href="/search" size="sm" variant="ghost">
              <Icon name="search" />
              Tìm kiếm
            </Button>
          }
        />

        {/* Thanh lọc theo thẻ - bấm để lọc. Thẻ đang chọn nổi bật + có nút bỏ lọc. */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6" aria-label="Lọc theo thẻ">
            <a href="/blog">
              <Badge tone={tag ? 'neutral' : 'brand'}>Tất cả</Badge>
            </a>
            {allTags.map((t) => (
              <a
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                aria-label={`Lọc theo thẻ ${t}`}
              >
                <Badge tone={t === tag ? 'brand' : 'neutral'}>{t}</Badge>
              </a>
            ))}
          </div>
        )}

        {tag && (
          <p className="text-sm text-fg-muted mb-4">
            Đang lọc theo thẻ <span className="font-semibold text-fg">{tag}</span> ·{' '}
            <a href="/blog" className="text-link hover:underline">
              bỏ lọc
            </a>
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {posts.length === 0 && (
            <Card className="p-6 text-fg-muted md:col-span-2">
              {tag ? `Chưa có bài viết nào gắn thẻ "${tag}".` : 'Chưa có bài viết.'}
            </Card>
          )}
          {posts.map((p: Post) => (
            <Card
              key={p.id}
              as="a"
              href={`/blog/${p.slug}`}
              hover
              className="p-6 flex flex-col group"
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(p.tags || []).map((t: string) => (
                  <Badge key={t} tone={t === tag ? 'brand' : 'neutral'}>
                    {t}
                  </Badge>
                ))}
              </div>
              <h2 className="text-xl font-bold text-fg leading-snug group-hover:text-link transition-colors text-balance">
                {p.title}
              </h2>
              <p className="mt-2 text-sm text-fg-muted flex-1">{p.excerpt}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
                <Avatar name={p.author?.displayName || 'tsudev'} size={22} />
                {p.author?.displayName || 'tsudev'} · {timeAgo(p.publishedAt || p.createdAt)}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }: GetServerSidePropsContext) {
  const tag = typeof query.tag === 'string' && query.tag.trim() ? query.tag.trim() : null;
  // Bài để hiển thị (đã lọc nếu có tag) + nguồn để dựng thanh thẻ (luôn đầy đủ).
  const [posts, tagSource] = await Promise.all([
    api.posts(50, tag || undefined),
    tag ? api.posts(50) : Promise.resolve(null),
  ]);
  const source = tagSource ?? posts;
  const allTags = [...new Set(source.flatMap((p) => p.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'vi')
  );
  return { props: { posts, tag, allTags } };
}
