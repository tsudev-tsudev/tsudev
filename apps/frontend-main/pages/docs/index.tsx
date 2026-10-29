import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, SectionHeading, EmptyState, Icon } from '@tsudev/ui';
import { api } from '../../lib/api';
import type { Doc } from '../../lib/types';
import type { GetServerSidePropsContext } from 'next';

type DocGroup = { category: string; items: Doc[] };
type DocsIndexProps = { groups: DocGroup[]; failed: boolean };

export default function DocsIndex({ groups, failed }: DocsIndexProps) {
  return (
    <Layout active="/docs" bare>
      <Seo title="Tài liệu" path="/docs" description="Kho tri thức và hướng dẫn của tsudev." />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <SectionHeading eyebrow="Tài liệu" title="Kho tri thức & hướng dẫn" />
        {/* Kiểm `failed` TRƯỚC `length === 0` - xem lý do ở blog/index.tsx. */}
        {failed ? (
          <EmptyState
            kind="failed"
            icon="warning"
            title="Không tải được mục lục tài liệu"
            explain="Máy chủ nội dung không trả lời. Tài liệu đã đăng vẫn còn nguyên; thử tải lại sau ít phút."
          />
        ) : (
          groups.length === 0 && (
            <EmptyState
              icon="doc"
              title="Chưa có tài liệu"
              explain="Kênh tài liệu của toà soạn có trần 1 bài/ngày và hàng đợi được nhặt theo thứ tự, nên mục lục này dày lên chậm hơn blog. Đó là thiết kế, không phải sự cố."
              action={{ label: 'Đọc blog', href: '/blog' }}
            />
          )
        )}
        <div className="space-y-8">
          {groups.map((g: DocGroup) => (
            <div key={g.category}>
              <div className="font-mono text-xs uppercase tracking-wider text-accent font-semibold mb-3">
                {g.category}
              </div>
              <Card className="p-2">
                {g.items.map((d: Doc) => (
                  <a
                    key={d.slug}
                    href={`/docs/${d.slug}`}
                    className="flex items-center gap-3 px-5 py-3.5 rounded-lg hover:bg-subtle transition group"
                  >
                    {/* Dùng icon của hệ thống thay cho bản inline + `text-fg-muted`.
                        Màu đổi từ xám sang xanh dương là CÓ CHỦ ĐÍCH: vai trò
                        `nav` nói rằng mỗi hàng này là một liên kết điều hướng,
                        và đó đúng là việc nó làm. Xám trần không nói gì cả. */}
                    <Icon name="doc" size={18} />
                    <span className="text-fg font-medium group-hover:text-link transition-colors">
                      {d.title}
                    </span>
                  </a>
                ))}
              </Card>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  const r = await api.docs();
  const docs = r.data;
  if (r.failed) res.statusCode = 503;
  // `d.category` có thể null. Bản cũ dùng nó làm khoá object, nên nhóm không
  // phân loại hiện ra với tiêu đề "null" trên trang thật.
  const byCat: Record<string, Doc[]> = {};
  for (const d of docs) {
    const cat = d.category || 'Khác';
    (byCat[cat] = byCat[cat] || []).push(d);
  }
  const groups: DocGroup[] = Object.keys(byCat).map((category) => ({
    category,
    items: byCat[category] ?? [],
  }));
  return { props: { groups, failed: r.failed } };
}
