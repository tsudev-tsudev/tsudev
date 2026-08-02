import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button } from '@tsudev/ui';
import { forumApi } from '../../lib/api';

export default function NewThread({ boards, defaultBoard }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [board, setBoard] = useState(defaultBoard || (boards[0] && boards[0].slug) || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/forum/boards/${board}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo chủ đề thất bại');
      router.push(`/thread/${data.id}`);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <Layout active="forum" bare>
      <Head>
        <title>Tạo chủ đề mới — Diễn đàn tsudev</title>
      </Head>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-ink mb-1">Tạo chủ đề mới</h1>
        <p className="text-muted mb-6">Đặt câu hỏi hoặc bắt đầu một cuộc thảo luận.</p>

        {status !== 'loading' && !session ? (
          <Card className="p-8 text-center">
            <p className="text-inksoft mb-4">Bạn cần đăng nhập để tạo chủ đề.</p>
            <Button onClick={() => signIn()}>Đăng nhập</Button>
          </Card>
        ) : (
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="thread-board"
                  className="block text-sm font-medium text-inksoft mb-1.5"
                >
                  Chuyên mục
                </label>
                <select
                  id="thread-board"
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink focus:border-brand outline-none"
                >
                  {boards.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="thread-title"
                  className="block text-sm font-medium text-inksoft mb-1.5"
                >
                  Tiêu đề
                </label>
                <input
                  id="thread-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                  placeholder="Tiêu đề chủ đề…"
                  className="w-full rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="thread-content"
                  className="block text-sm font-medium text-inksoft mb-1.5"
                >
                  Nội dung
                </label>
                <textarea
                  id="thread-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={8}
                  placeholder="Viết nội dung… (hỗ trợ Markdown)"
                  className="w-full rounded-lg border border-hairline bg-surface p-3 text-sm text-ink placeholder:text-muted focus:border-brand outline-none resize-y"
                />
              </div>
              {err && <p className="text-[var(--error)] text-sm">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button as="a" href="/" variant="ghost">
                  Huỷ
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Đang tạo…' : 'Đăng chủ đề'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }) {
  const categories = await forumApi.categories();
  const boards = categories.flatMap((c) =>
    (c.boards || []).map((b) => ({ slug: b.slug, name: `${c.name} › ${b.name}` }))
  );
  return { props: { boards, defaultBoard: query.board || null } };
}
