import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, SectionHeading, Avatar, Button, Icon, EmptyState } from '@tsudev/ui';
import { api } from '../../lib/api';
import type { Post } from '../../lib/types';
import type { GetServerSidePropsContext } from 'next';

function timeAgo(d: string | Date): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 86400) return `${Math.max(1, Math.floor(s / 3600))} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

type BlogIndexProps = { posts: Post[]; failed: boolean };

export default function BlogIndex({ posts, failed }: BlogIndexProps) {
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
          {/* Kiểm `failed` TRƯỚC `length === 0`: gọi thất bại thì danh sách cũng
              rỗng, nên đảo thứ tự là nhánh lỗi không bao giờ chạy tới. */}
          {failed ? (
            <div className="md:col-span-2">
              <EmptyState
                kind="failed"
                icon="warning"
                title="Không tải được danh sách bài viết"
                explain="Máy chủ nội dung không trả lời, nên đây không phải là một blog trống - các bài đã đăng vẫn còn nguyên. Thử tải lại sau ít phút."
              />
            </div>
          ) : (
            posts.length === 0 && (
              <div className="md:col-span-2">
                <EmptyState
                  icon="doc"
                  title="Chưa có bài viết"
                  explain="Toà soạn Agent AI đăng theo nhịp mỗi giờ và mỗi kênh có trần số bài trong ngày, nên khoảng trống giữa hai bài là bình thường."
                  action={{ label: 'Tìm trong toàn bộ nội dung', href: '/search' }}
                />
              </div>
            )
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

export async function getServerSideProps({ query, res }: GetServerSidePropsContext) {
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

  const r = await api.posts(50);
  if (r.failed) res.statusCode = 503;
  return { props: { posts: r.data, failed: r.failed } };
}
