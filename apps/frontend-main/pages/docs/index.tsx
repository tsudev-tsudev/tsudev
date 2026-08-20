import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, SectionHeading } from '@tsudev/ui';
import { api } from '../../lib/api';
import type { Doc } from '../../lib/types';

type DocGroup = { category: string; items: Doc[] };
type DocsIndexProps = { groups: DocGroup[] };

export default function DocsIndex({ groups }: DocsIndexProps) {
  return (
    <Layout active="/docs" bare>
      <Seo title="Tài liệu" path="/docs" description="Kho tri thức và hướng dẫn của tsudev." />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <SectionHeading eyebrow="Tài liệu" title="Kho tri thức & hướng dẫn" />
        {groups.length === 0 && <Card className="p-6 text-fg-muted">Chưa có tài liệu.</Card>}
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
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-fg-muted"
                    >
                      <path
                        d="M6 4h9l3 3v13H6zM15 4v3h3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
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

export async function getServerSideProps() {
  const docs = await api.docs();
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
  return { props: { groups } };
}
