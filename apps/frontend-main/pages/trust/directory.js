import React from 'react';
import Head from 'next/head';
import { Layout, Badge, SectionHeading } from '@tsudev/ui';
import { trust, fmtDate } from '../../lib/trust';

export default function TrustDirectory({ certificates, programs, activeProgram }) {
  return (
    <Layout active="/trust" bare>
      <Head>
        <title>Thư mục website được cấp dấu — tsudev</title>
        <meta
          name="description"
          content="Danh sách công khai các website đang được tsudev cấp con dấu tín nhiệm."
        />
      </Head>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <SectionHeading eyebrow="Minh bạch" title="Website đang được cấp dấu" />
        <p className="text-muted -mt-3 mb-8 text-sm max-w-2xl">
          Toàn bộ chứng chỉ còn hiệu lực đều được liệt kê ở đây. Nếu một website trưng huy hiệu
          tsudev nhưng không có mặt trong danh sách này, huy hiệu đó không hợp lệ.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <a
            href="/trust/directory"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !activeProgram ? 'bg-[var(--glow)] text-brandink' : 'text-muted hover:text-ink'
            }`}
          >
            Tất cả
          </a>
          {programs.map((p) => (
            <a
              key={p.slug}
              href={`/trust/directory?program=${p.slug}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeProgram === p.slug
                  ? 'bg-[var(--glow)] text-brandink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {p.name}
            </a>
          ))}
        </div>

        {certificates.length === 0 && (
          <p className="py-16 text-center text-muted">Chưa có chứng chỉ nào đang hiệu lực.</p>
        )}

        <div className="divide-y divide-[color:var(--border)]">
          {certificates.map((c) => (
            <a
              key={c.serial}
              href={`/trust/verify/${c.serial}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-4 px-3 -mx-3 rounded-lg hover:bg-panel transition-colors group"
            >
              <span className="font-mono text-ink font-medium group-hover:text-brandink transition-colors">
                {c.hostname}
              </span>
              <Badge tone="neutral" mono>
                {c.program?.name}
              </Badge>
              <span className="text-xs text-muted">{c.organization}</span>
              <span className="ml-auto font-mono text-xs text-muted">{c.serial}</span>
              <span className="text-xs text-muted w-24 text-right">đến {fmtDate(c.expiresAt)}</span>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }) {
  const program = typeof query.program === 'string' ? query.program : '';
  const [certificates, programs] = await Promise.all([
    trust.directory(program ? `?program=${encodeURIComponent(program)}` : ''),
    trust.programs(),
  ]);
  return { props: { certificates, programs, activeProgram: program || null } };
}
