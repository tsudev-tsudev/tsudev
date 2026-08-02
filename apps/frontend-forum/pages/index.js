import React from 'react';
import Head from 'next/head';
import { Layout, Badge, SectionHeading, Avatar, Button, siteUrl } from '@tsudev/ui';
import { forumApi } from '../lib/api';

export default function ForumHome({ categories, members, totals }) {
  return (
    <Layout active="forum" bare>
      <Head>
        <title>Diễn đàn — tsudev</title>
      </Head>

      <section className="relative overflow-hidden border-b border-hairline">
        <div
          className="absolute inset-0 tsu-grid"
          style={{
            maskImage: 'radial-gradient(70% 80% at 50% 0%, #000 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(70% 80% at 50% 0%, #000 40%, transparent 75%)',
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 py-14">
          <Badge tone="teal" mono className="mb-4">
            {'// forum.tsudev'}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink text-balance">
            Diễn đàn cộng đồng tsudev
          </h1>
          <p className="mt-3 text-inksoft max-w-2xl">
            Thảo luận chuyên sâu, hỏi đáp kỹ thuật và chia sẻ kiến thức. Đăng nhập để tham gia và
            xây dựng uy tín của bạn.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 font-mono text-sm text-muted">
            <span>
              <b className="text-ink">{totals.threads}</b> chủ đề
            </span>
            <span>
              <b className="text-ink">{totals.boards}</b> chuyên mục
            </span>
            <span>
              <b className="text-ink">{totals.members}</b> thành viên
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat.id}>
              <SectionHeading eyebrow={`${cat.boards.length} chuyên mục`} title={cat.name} />
              <div className="space-y-3">
                {cat.boards.map((b) => (
                  <a
                    key={b.id}
                    href={`/board/${b.slug}`}
                    className="p-5 flex items-center gap-4 group rounded-xl transition-colors hover:bg-panel"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brandink bg-[var(--glow)] shrink-0">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 5h16v10H8l-4 4z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink group-hover:text-brandink transition-colors">
                        {b.name}
                      </h3>
                      <p className="text-sm text-muted truncate">{b.description}</p>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="font-mono text-lg font-semibold text-ink tabular-nums">
                        {b.threadCount}
                      </div>
                      <div className="text-[10px] uppercase text-muted">chủ đề</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-6">
          <div className="p-5 rounded-xl">
            <h3 className="font-semibold text-ink mb-1">Bắt đầu thảo luận</h3>
            <p className="text-sm text-muted mb-4">Có câu hỏi hoặc muốn chia sẻ? Tạo chủ đề mới.</p>
            <Button
              as="a"
              href={`/board/${categories[0]?.boards[0]?.slug || ''}`}
              className="w-full"
            >
              Chọn chuyên mục →
            </Button>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-teal font-semibold mb-3">
              Bảng xếp hạng
            </div>
            <div className="p-2">
              {members.map((m, i) => (
                <a
                  key={m.id}
                  href={siteUrl('main', `/members/${m.username}`)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-panel transition"
                >
                  <span className="font-mono text-xs text-muted w-4 tabular-nums">{i + 1}</span>
                  <Avatar name={m.displayName || m.username} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">
                      {m.displayName || m.username}
                    </div>
                    <div className="text-[11px] text-muted">{m.rank?.label}</div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-brandink tabular-nums">
                    {m.reputation}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const [categories, members] = await Promise.all([forumApi.categories(), forumApi.members(8)]);
  const boards = categories.flatMap((c) => c.boards || []);
  const totals = {
    threads: boards.reduce((n, b) => n + (b.threadCount || 0), 0),
    boards: boards.length,
    members: members.length,
  };
  return { props: { categories, members, totals } };
}
