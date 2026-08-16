import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge, TableOfContents } from '@tsudev/ui';
import type { TocItem } from '@tsudev/ui';
import { api } from '../../lib/api';
import { extractHeadings, renderMarkdown } from '../../lib/md';
import type { GetServerSidePropsContext } from 'next';
import type { Doc } from '../../lib/types';
import { routeParam } from '../../lib/identity';

type DocPageProps = {
  doc: Doc | null;
  slug: string;
  toc: TocItem[];
};

export default function DocPage({ doc, slug, toc }: DocPageProps) {
  if (!doc)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy tài liệu.</Card>
      </Layout>
    );
  return (
    <Layout active="/docs" bare>
      <Seo title={doc.title} path={`/docs/${slug}`} type="article" />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/docs" className="hover:text-brandink">
            Tài liệu
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{doc.title}</span>
        </nav>
        <Badge tone="teal" mono className="mb-3">
          {doc.category}
        </Badge>
        <h1 className="text-3xl font-extrabold text-ink text-balance leading-tight mb-8">
          {doc.title}
        </h1>
        {/* Hai cột từ lg trở lên: thân bài giữ bề rộng đọc được, mục lục bám
            dính bên phải. Dưới lg thì mục lục nằm TRÊN thân bài — trên màn hình
            hẹp nó phải là thứ người đọc gặp trước, không phải thứ họ cuộn qua
            hết bài mới thấy. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
          <div
            className="prose-tsu order-2 lg:order-1 min-w-0"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.contentMd || '') }}
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
  const doc = await api.doc(routeParam(params, 'slug'));
  // Mục lục dựng ở SERVER: dựng ở client thì nó nháy vào sau khi bài đã hiện,
  // và bố cục hai cột nhảy một nhịp ở mỗi lần tải trang.
  const toc = extractHeadings(doc?.contentMd || '');
  return { props: { doc, slug: routeParam(params, 'slug'), toc } };
}
