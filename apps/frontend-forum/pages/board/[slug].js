import React from 'react';
import Head from 'next/head';
import { Layout, Card, Button, SectionHeading, ThreadRow } from '@tsudev/ui';
import { forumApi } from '../../lib/api';

export default function BoardView({ board, threads }) {
  if (!board)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy chuyên mục.</Card>
      </Layout>
    );
  return (
    <Layout active="forum" bare>
      <Head>
        <title>{board.name} — Diễn đàn tsudev</title>
      </Head>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <nav className="text-sm text-muted mb-4">
          <a href="/" className="hover:text-brandink">
            Diễn đàn
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{board.name}</span>
        </nav>
        <SectionHeading
          eyebrow="Chuyên mục"
          title={board.name}
          action={
            <Button as="a" href={`/thread/new?board=${board.slug}`}>
              + Tạo chủ đề
            </Button>
          }
        />
        <p className="text-muted -mt-3 mb-6">{board.description}</p>
        <div className="space-y-2.5">
          {threads.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-muted">Chưa có chủ đề nào. Hãy là người đầu tiên!</p>
              <Button as="a" href={`/thread/new?board=${board.slug}`} className="mt-4">
                + Tạo chủ đề
              </Button>
            </Card>
          )}
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} href={`/thread/${t.id}`} />
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const data = await forumApi.board(params.slug);
  return { props: { board: data?.board || null, threads: data?.threads || [] } };
}
