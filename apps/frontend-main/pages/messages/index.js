import React, { useEffect, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Avatar, SectionHeading } from '@tsudev/ui';

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)}p`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Messages() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState('');
  const [newUser, setNewUser] = useState('');
  const endRef = useRef(null);

  const loadConvos = useCallback(async () => {
    const r = await fetch('/api/msg/conversations');
    if (r.ok) setConvos(await r.json());
  }, []);
  const loadThread = useCallback(async (id) => {
    if (!id) return;
    const r = await fetch(`/api/msg/conversations/${id}`);
    if (r.ok) setThread(await r.json());
  }, []);

  useEffect(() => {
    if (status === 'authenticated') loadConvos();
  }, [status, loadConvos]);
  useEffect(() => {
    if (router.query.c) setActiveId(router.query.c);
  }, [router.query.c]);
  useEffect(() => {
    loadThread(activeId);
  }, [activeId, loadThread]);
  // polling
  useEffect(() => {
    if (status !== 'authenticated') return;
    const t = setInterval(() => {
      loadConvos();
      if (activeId) loadThread(activeId);
    }, 4000);
    return () => clearInterval(t);
  }, [status, activeId, loadConvos, loadThread]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() || !activeId) return;
    const r = await fetch(`/api/msg/conversations/${activeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (r.ok) {
      setBody('');
      loadThread(activeId);
      loadConvos();
    }
  }
  async function startNew(e) {
    e.preventDefault();
    const r = await fetch('/api/msg/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUser }),
    });
    const d = await r.json();
    if (r.ok) {
      setNewUser('');
      await loadConvos();
      setActiveId(d.id);
    } else alert(d.error || 'Lỗi');
  }

  if (status === 'loading')
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Đang tải…</Card>
      </Layout>
    );
  if (!session)
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-inksoft mb-3">Đăng nhập để nhắn tin.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  return (
    <Layout active="/messages" bare>
      <Head>
        <title>Tin nhắn — tsudev</title>
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <SectionHeading eyebrow="Hộp thư" title="Tin nhắn riêng" />
        <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[70vh]">
          <Card className="p-0 overflow-hidden flex flex-col">
            <form onSubmit={startNew} className="p-3 flex gap-2">
              <input
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                placeholder="Nhắn tới username…"
                className="flex-1 min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
              />
              <Button size="sm" type="submit">
                +
              </Button>
            </form>
            <div className="overflow-y-auto flex-1">
              {convos.length === 0 && (
                <div className="p-5 text-sm text-muted">Chưa có hội thoại.</div>
              )}
              {convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-panel2 transition ${
                    activeId === c.id ? 'bg-panel2' : ''
                  }`}
                >
                  <Avatar name={c.with} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          c.unread ? 'font-bold text-ink' : 'font-medium text-inksoft'
                        }`}
                      >
                        {c.with}
                      </span>
                      <span className="text-[10px] text-muted shrink-0">
                        {timeAgo(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className={`text-xs truncate ${c.unread ? 'text-ink' : 'text-muted'}`}>
                      {c.lastMessage}
                    </div>
                  </div>
                  {c.unread && <span className="h-2 w-2 rounded-full bg-brand shrink-0" />}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden flex flex-col">
            {!thread ? (
              <div className="flex-1 grid place-items-center text-muted text-sm">
                Chọn một hội thoại để bắt đầu
              </div>
            ) : (
              <>
                <div className="px-5 py-3 flex items-center gap-3">
                  <Avatar name={thread.with} size={34} />
                  <span className="font-semibold text-ink">{thread.with}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {thread.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          m.mine ? 'bg-brand text-[var(--primary-contrast)]' : 'bg-panel2 text-ink'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${m.mine ? 'opacity-80' : 'text-muted'}`}>
                          {timeAgo(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                <form onSubmit={send} className="p-3 flex gap-2">
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Nhập tin nhắn…"
                    className="flex-1 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
                  />
                  <Button type="submit">Gửi</Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
