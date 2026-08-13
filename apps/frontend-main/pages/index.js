import React from 'react';
import Head from 'next/head';
import { Layout, Button, Card, Badge, SectionHeading, Avatar, Stat } from '@tsudev/ui';
import { api } from '../lib/api';
import { trust } from '../lib/trust';
import { KIND_LABEL, STATUS_LABEL, COPYRIGHT } from '../lib/projectLabels';

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
    title: 'Con dấu tín nhiệm',
    desc: 'Chứng nhận website dùng mã nguồn hoặc do tsudev thực hiện.',
    href: '/trust',
    icon: 'M12 3l7 4v6c0 4-3 6-7 8-4-2-7-4-7-8V7z M9 12l2 2 4-4',
    tone: 'brand',
  },
  {
    title: 'Dự án',
    desc: 'Ứng dụng, công cụ và thư viện do tsudev phát triển, kèm bản quyền.',
    href: '/projects',
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

export default function Home({ posts, certified, projects, totals }) {
  return (
    <Layout active="/" bare>
      <Head>
        <title>tsudev — Hệ sinh thái công nghệ cho Developer</title>
        <meta
          name="description"
          content="tsudev: blog, tài liệu, dự án mã nguồn và con dấu tín nhiệm. Decoding the Future, One Commit at a Time."
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
              Dự án cá nhân của tsudev — tri thức kỹ thuật được chuẩn hoá, mã nguồn dùng được, và
              con dấu tín nhiệm cho những website mang dấu ấn tsudev.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="a" href="/trust" size="lg">
                Con dấu tín nhiệm
              </Button>
              <Button as="a" href="/blog" variant="secondary" size="lg">
                Đọc blog
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap gap-10">
              <Stat value={totals.projects} label="Dự án" />
              <Stat value={totals.posts} label="Bài viết" />
              <Stat value={totals.docs} label="Tài liệu" />
              <Stat value={totals.certified} label="Website đã cấp dấu" />
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

        {/* ---------- PROJECTS ---------- */}
        <section className="py-6">
          <SectionHeading
            eyebrow="Sản phẩm"
            title="Dự án của tsudev"
            action={
              <Button as="a" href="/projects" variant="ghost" size="sm">
                Xem tất cả →
              </Button>
            }
          />
          <div className="grid md:grid-cols-3 gap-4">
            {projects.length === 0 && (
              <p className="p-6 text-muted md:col-span-3">Chưa có dự án nào.</p>
            )}
            {projects.slice(0, 3).map((p) => {
              const cr = COPYRIGHT[p.copyrightStatus] || COPYRIGHT.NONE;
              return (
                <a
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className="p-5 flex flex-col group rounded-xl transition-colors hover:bg-panel"
                >
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge tone="neutral">{KIND_LABEL[p.kind] || p.kind}</Badge>
                    <Badge tone="outline">{STATUS_LABEL[p.status] || p.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-ink text-lg leading-snug group-hover:text-brandink transition-colors text-balance">
                    {p.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted flex-1">{p.summary}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={cr.tone}>{cr.label}</Badge>
                    {p.license && <span className="font-mono">{p.license}</span>}
                  </div>
                </a>
              );
            })}
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

        {/* ---------- TRUST ---------- */}
        <section className="py-16">
          <SectionHeading
            eyebrow="Tín nhiệm"
            title="Website mang dấu tsudev"
            action={
              <Button as="a" href="/trust/directory" variant="ghost" size="sm">
                Xem danh bạ →
              </Button>
            }
          />
          {certified.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted">Chưa có chứng chỉ nào được cấp.</p>
              <Button as="a" href="/trust/apply" size="sm" className="mt-4">
                Đăng ký cấp dấu
              </Button>
            </Card>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {certified.slice(0, 6).map((c) => (
              <Card
                key={c.serial}
                as="a"
                href={`/trust/verify/${c.serial}`}
                hover
                className="p-5 block group"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink truncate group-hover:text-brandink transition-colors">
                    {c.orgName || c.hostname}
                  </span>
                  <Badge tone="teal" mono>
                    {c.programCode || 'SEAL'}
                  </Badge>
                </div>
                <div className="text-xs text-muted mt-1 font-mono truncate">{c.hostname}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="pb-20">
          <div className="p-10 md:p-14 text-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-ink text-balance">
                Website của bạn dùng mã nguồn tsudev?
              </h2>
              <p className="mt-3 text-inksoft max-w-lg mx-auto">
                Đăng ký cấp con dấu tín nhiệm — chứng chỉ ký số, xác minh quyền sở hữu tên miền và
                giám sát định kỳ.
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Button as="a" href="/trust/apply" size="lg">
                  Đăng ký cấp dấu
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
  const [posts, docs, certified, projects] = await Promise.all([
    api.posts(6),
    api.docs(),
    trust.directory(),
    api.projects(100),
  ]);

  const totals = {
    posts: String(posts.length),
    docs: String(docs.length),
    certified: String(certified.length),
    projects: String(projects.length),
  };

  return { props: { posts, certified, projects, totals } };
}
