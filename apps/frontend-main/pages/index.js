import React from 'react';
import Head from 'next/head';
import { Layout, Button, Card, Badge, SectionHeading, Avatar, Stat, siteUrl } from '@tsudev/ui';
import { api } from '../lib/api';

const ECOSYSTEM = [
  {
    title: 'Blog',
    desc: 'Bài viết kỹ thuật, hướng dẫn và góc nhìn công nghệ.',
    href: '/blog',
    icon: 'M4 5h16M4 12h16M4 19h10',
    tone: 'brand',
  },
  {
    title: 'Tài liệu',
    desc: 'Kho tri thức chuẩn hoá, guide và API reference.',
    href: '/docs',
    icon: 'M6 4h9l3 3v13H6zM15 4v3h3',
    tone: 'teal',
  },
  {
    title: 'Diễn đàn',
    desc: 'Thảo luận chuyên sâu, hỏi đáp và chia sẻ.',
    href: siteUrl('forum', '/'),
    icon: 'M4 5h16v10H8l-4 4z',
    tone: 'brand',
  },
  {
    title: 'Kho lưu trữ',
    desc: 'Mã nguồn, tài liệu và media qua object storage.',
    href: '/docs',
    icon: 'M4 7l8-3 8 3v10l-8 3-8-3z M12 4v16',
    tone: 'teal',
  },
];

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export default function Home({ posts, members, boardActivity, totals }) {
  return (
    <Layout active="/" bare>
      <Head>
        <title>tsudev — Hệ sinh thái công nghệ cho Developer</title>
        <meta
          name="description"
          content="tsudev: blog, tài liệu, diễn đàn và kho mã nguồn. Decoding the Future, One Commit at a Time."
        />
      </Head>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div
          className="absolute inset-0 tsu-grid"
          style={{
            maskImage: 'radial-gradient(80% 80% at 60% 0%, #000 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(80% 80% at 60% 0%, #000 30%, transparent 75%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute -top-40 right-0 h-96 w-96 rounded-full blur-3xl animate-pulse-glow"
          style={{ background: 'var(--glow)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div className="animate-fade-up">
            <Badge tone="teal" mono className="mb-5">
              {'// tsudev ecosystem v0.1'}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-ink text-balance leading-[1.05]">
              Giải mã tương lai qua
              <br />
              <span className="text-brandink">từng dòng code</span>.
            </h1>
            <p className="mt-6 text-lg text-inksoft max-w-xl">
              Hệ sinh thái công nghệ đa nền tảng cho developer — chuẩn hoá tri thức qua kho tư liệu,
              diễn đàn thảo luận chuyên sâu và giải pháp mã nguồn ứng dụng cao.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="a" href={siteUrl('forum', '/')} size="lg">
                Vào diễn đàn
              </Button>
              <Button as="a" href="/blog" variant="secondary" size="lg">
                Đọc blog
              </Button>
            </div>
            <div className="mt-12 flex gap-10">
              <Stat value={totals.members} label="Thành viên" />
              <Stat value={totals.posts} label="Bài viết" />
              <Stat value={totals.threads} label="Chủ đề" />
            </div>
          </div>

          {/* terminal-style card */}
          <div className="animate-fade-up hidden lg:block" style={{ animationDelay: '.1s' }}>
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-panel2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 font-mono text-xs text-muted">tsudev@ecosystem: ~</span>
              </div>
              <pre className="p-5 font-mono text-[13px] leading-relaxed text-inksoft overflow-x-auto">
                <span className="text-teal">$</span> tsudev status --all{'\n'}
                <span className="text-[var(--success)]">✔</span> user-service{' '}
                <span className="text-muted">:4000 healthy</span>
                {'\n'}
                <span className="text-[var(--success)]">✔</span> content-service{' '}
                <span className="text-muted">:4001 healthy</span>
                {'\n'}
                <span className="text-[var(--success)]">✔</span> storage-service{' '}
                <span className="text-muted">:4002 healthy</span>
                {'\n'}
                <span className="text-[var(--success)]">✔</span> postgres{' '}
                <span className="text-muted">:5433 connected</span>
                {'\n'}
                <span className="text-teal">$</span> _
              </pre>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        {/* ---------- ECOSYSTEM ---------- */}
        <section className="py-16">
          <SectionHeading eyebrow="Hệ sinh thái" title="Bốn phân hệ, một tài khoản" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ECOSYSTEM.map((e) => (
              <a
                key={e.title}
                href={e.href}
                className="p-5 block group rounded-xl transition-colors hover:bg-panel"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-lg mb-4 ${
                    e.tone === 'teal'
                      ? 'text-teal bg-[var(--glow)]'
                      : 'text-brandink bg-[var(--glow)]'
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d={e.icon}
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h3 className="font-semibold text-ink group-hover:text-brandink transition-colors">
                  {e.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{e.desc}</p>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- FEATURED POSTS ---------- */}
        <section className="py-6">
          <SectionHeading
            eyebrow="Mới nhất"
            title="Bài viết nổi bật"
            action={
              <Button as="a" href="/blog" variant="ghost" size="sm">
                Xem tất cả →
              </Button>
            }
          />
          <div className="grid md:grid-cols-3 gap-4">
            {posts.length === 0 && (
              <p className="p-6 text-muted md:col-span-3">Chưa có bài viết.</p>
            )}
            {posts.slice(0, 3).map((p) => (
              <a
                key={p.id}
                href={`/blog/${p.slug}`}
                className="p-5 flex flex-col group rounded-xl transition-colors hover:bg-panel"
              >
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(p.tags || []).slice(0, 2).map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
                <h3 className="font-semibold text-ink text-lg leading-snug group-hover:text-brandink transition-colors text-balance">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted flex-1">{p.excerpt}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <Avatar name={p.author?.displayName || 'tsudev'} size={22} />
                  <span>{p.author?.displayName || 'tsudev'}</span>
                  <span>·</span>
                  <span>{timeAgo(p.createdAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- COMMUNITY ---------- */}
        <section className="py-16 grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <div>
            <SectionHeading
              eyebrow="Cộng đồng"
              title="Hoạt động diễn đàn"
              action={
                <Button as="a" href={siteUrl('forum', '/')} variant="ghost" size="sm">
                  Tới diễn đàn →
                </Button>
              }
            />
            <div className="space-y-2.5">
              {boardActivity.length === 0 && <p className="p-6 text-muted">Chưa có hoạt động.</p>}
              {boardActivity.map((t) => (
                <a
                  key={t.id}
                  href={siteUrl('forum', `/thread/${t.id}`)}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-panel transition-colors group"
                >
                  <Avatar name={t.author?.displayName || '?'} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate group-hover:text-brandink transition-colors">
                      {t.title}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      bởi {t.author?.displayName || 'khách'} · {timeAgo(t.lastPostAt)}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted shrink-0">{t.replies} trả lời</span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Xếp hạng" title="Thành viên tích cực" />
            <div className="p-2">
              {members.map((m, i) => (
                <a
                  key={m.id}
                  href={`/members/${m.username}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-panel transition"
                >
                  <span className="font-mono text-sm text-muted w-5 tabular-nums">{i + 1}</span>
                  <Avatar name={m.displayName || m.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">
                      {m.displayName || m.username}
                    </div>
                    <div className="text-xs text-muted">{m.rank?.label}</div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-brandink tabular-nums">
                    {m.reputation}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="pb-20">
          <div className="p-10 md:p-14 text-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-ink text-balance">
                Tham gia cộng đồng tsudev
              </h2>
              <p className="mt-3 text-inksoft max-w-lg mx-auto">
                Một tài khoản SSO cho toàn hệ sinh thái — thảo luận, đóng góp và xây dựng uy tín của
                bạn.
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Button as="a" href="/api/auth/signin" size="lg">
                  Đăng nhập / Đăng ký
                </Button>
                <Button as="a" href="/docs" variant="secondary" size="lg">
                  Tài liệu
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const [posts, members, categories] = await Promise.all([
    api.posts(6),
    api.members(5),
    api.categories(),
  ]);

  let boardActivity = [];
  const firstBoard = categories.flatMap((c) => c.boards || []).find((b) => b.threadCount > 0);
  if (firstBoard) {
    const board = await api.board(firstBoard.slug);
    boardActivity = (board?.threads || []).slice(0, 5);
  }

  const totals = {
    members: members.length ? `${members.length}+` : '0',
    posts: String(posts.length),
    threads: String(
      categories.reduce(
        (n, c) => n + (c.boards || []).reduce((m, b) => m + (b.threadCount || 0), 0),
        0
      )
    ),
  };

  return { props: { posts, members, boardActivity, totals } };
}
