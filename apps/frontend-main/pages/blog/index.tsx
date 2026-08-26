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

type BlogIndexProps = { posts: Post[] };

export default function BlogIndex({ posts }: BlogIndexProps) {
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

        <div className="grid md:grid-cols-2 gap-4">
          {posts.length === 0 && (
            <Card className="p-6 text-fg-muted md:col-span-2">Chưa có bài viết.</Card>
          )}
          {posts.map((p: Post) => (
            <Card
              key={p.id}
              as="a"
              href={`/blog/${p.slug}`}
              hover
              className="p-6 flex flex-col group"
            >
              {/* Thẻ của RIÊNG bài này, để nhận diện chủ đề khi lướt. Chúng
                  không còn là bộ lọc: việc lọc theo thẻ đã dời sang /search,
                  nơi thẻ đứng cạnh chuyên mục và loại nội dung trong cùng một
                  bộ facet. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(p.tags || []).map((t: string) => (
                  <Badge key={t} tone="neutral">
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
  // `/blog?tag=x` KHÔNG chết mà đi tiếp sang /search. Lọc theo thẻ đã dời hẳn
  // sang đó, nhưng liên kết cũ vẫn còn trong bookmark, trong lịch sử trình duyệt
  // và trong chính các bài đã đăng - bỏ nhánh này là biến chúng thành trang
  // "không lọc gì cả", tức im lặng trả về SAI kết quả thay vì đưa người dùng tới
  // đúng chỗ.
  const tag = typeof query.tag === 'string' && query.tag.trim() ? query.tag.trim() : null;
  if (tag) {
    return {
      redirect: { destination: `/search?tag=${encodeURIComponent(tag)}`, permanent: false },
    };
  }

  const posts = await api.posts(50);
  return { props: { posts } };
}
