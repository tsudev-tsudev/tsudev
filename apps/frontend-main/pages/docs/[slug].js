import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Card, Badge } from '@tsudev/ui';
import { api } from '../../lib/api';
import { renderMarkdown } from '../../lib/md';

export default function DocPage({ doc, slug }) {
  if (!doc)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy tài liệu.</Card>
      </Layout>
    );
  return (
    <Layout active="/docs" bare>
      <Seo title={doc.title} path={`/docs/${slug}`} type="article" />
      <article className="max-w-3xl mx-auto px-4 py-10">
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
        <div
          className="prose-tsu"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.contentMd || '') }}
        />
      </article>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const doc = await api.doc(params.slug);
  return { props: { doc, slug: params.slug } };
}
