import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Avatar, Badge } from '@tsudev/ui';
import { forumApi } from '../../lib/api';

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

function ReportButton({ targetType, targetId }) {
  const { data: session } = useSession();
  const [state, setState] = useState('idle');
  if (!session) return null;
  async function report() {
    const reason = window.prompt('Lý do báo cáo nội dung này?');
    if (!reason) return;
    setState('sending');
    try {
      const res = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      setState(res.ok ? 'done' : 'idle');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Báo cáo thất bại');
      }
    } catch (e) {
      setState('idle');
    }
  }
  return (
    <button
      onClick={report}
      disabled={state !== 'idle'}
      className="text-xs text-muted hover:text-[var(--error)] transition-colors disabled:opacity-60"
    >
      {state === 'done' ? '✓ Đã báo cáo' : state === 'sending' ? 'Đang gửi…' : '⚑ Báo cáo'}
    </button>
  );
}

function ReplyForm({ threadId, locked }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (locked)
    return (
      <Card className="p-5 text-center text-muted">🔒 Chủ đề đã bị khoá, không thể trả lời.</Card>
    );
  if (!session)
    return (
      <Card className="p-6 text-center">
        <p className="text-inksoft mb-3">Đăng nhập để tham gia thảo luận.</p>
        <Button onClick={() => signIn()}>Đăng nhập</Button>
      </Card>
    );

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/forum/threads/${threadId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gửi thất bại');
      setContent('');
      router.replace(router.asPath, undefined, { scroll: false });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-ink mb-3">Viết trả lời</h3>
      <form onSubmit={submit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={4}
          placeholder="Chia sẻ ý kiến của bạn… (hỗ trợ Markdown)"
          className="w-full rounded-lg border border-hairline bg-surface p-3 text-sm text-ink placeholder:text-muted focus:border-brand outline-none resize-y"
        />
        {err && <p className="text-[var(--error)] text-sm mt-2">{err}</p>}
        <div className="mt-3 flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi trả lời'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ThreadView({ thread }) {
  if (!thread)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy chủ đề.</Card>
      </Layout>
    );
  return (
    <Layout active="forum" bare>
      <Head>
        <title>{thread.title} — Diễn đàn tsudev</title>
      </Head>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="text-sm text-muted mb-4">
          <a href="/" className="hover:text-brandink">
            Diễn đàn
          </a>{' '}
          <span className="mx-1.5">/</span>
          <a href={`/board/${thread.board.slug}`} className="hover:text-brandink">
            {thread.board.name}
          </a>
        </nav>

        <div className="flex items-center gap-2 mb-1">
          {thread.pinned && (
            <Badge tone="teal" mono>
              Ghim
            </Badge>
          )}
          {thread.locked && (
            <Badge tone="warning" mono>
              Khoá
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink text-balance">{thread.title}</h1>
        <div className="text-sm text-muted mt-2 mb-6 font-mono">
          {thread.views} lượt xem · {thread.posts.length} bài viết
        </div>

        <div className="space-y-4">
          {thread.posts.map((p, i) => (
            <Card key={p.id} className="p-0 overflow-hidden">
              <div className="grid sm:grid-cols-[180px_1fr]">
                <div className="bg-panel2 p-4 flex sm:flex-col items-center sm:items-start gap-3">
                  <Avatar name={p.author?.displayName || p.author?.username || '?'} size={44} />
                  <div>
                    <div className="font-semibold text-ink text-sm">
                      {p.author?.displayName || p.author?.username || 'khách'}
                    </div>
                    <div className="text-xs text-teal font-mono">{p.author?.rank?.label}</div>
                    <div className="text-xs text-muted mt-1 font-mono">
                      {p.author?.reputation ?? 0} uy tín
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted font-mono">
                      #{i + 1} · {timeAgo(p.createdAt)}
                    </span>
                    <div className="flex items-center gap-3">
                      {p.isSolution && <Badge tone="success">✓ Giải pháp</Badge>}
                      {!p.deleted && <ReportButton targetType="POST" targetId={p.id} />}
                    </div>
                  </div>
                  <div
                    className={`prose-tsu whitespace-pre-wrap text-[15px] ${
                      p.deleted ? 'italic text-muted' : ''
                    }`}
                  >
                    {p.contentMd}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <ReplyForm threadId={thread.id} locked={thread.locked} />
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const thread = await forumApi.thread(params.id);
  return { props: { thread } };
}
