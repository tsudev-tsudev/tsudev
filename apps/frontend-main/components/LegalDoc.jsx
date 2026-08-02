import React from 'react';
import Head from 'next/head';
import { Layout, Badge } from '@tsudev/ui';

// Khung chung cho các trang văn bản dài (Điều khoản, Quyền riêng tư, Nội quy).
// Mỗi mục có `id` để trích dẫn được bằng liên kết neo — văn bản pháp lý hay bị
// dẫn chiếu tới từng mục nên đây là yêu cầu bắt buộc, không phải trang trí.
export const LegalDoc = ({ eyebrow, title, lead, updated, effective, sections, note, active }) => (
  <Layout active={active} bare>
    <Head>
      <title>{`${title} — tsudev`}</title>
      <meta name="description" content={lead} />
    </Head>

    <div className="max-w-6xl mx-auto px-4 py-12">
      <header className="max-w-3xl">
        <Badge tone="teal" mono className="mb-4">
          {eyebrow}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink text-balance leading-tight">
          {title}
        </h1>
        <p className="mt-5 text-lg text-inksoft leading-relaxed">{lead}</p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm font-mono text-muted">
          <div className="flex gap-2">
            <dt>Hiệu lực:</dt>
            <dd className="text-inksoft">{effective}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Cập nhật:</dt>
            <dd className="text-inksoft">{updated}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_15rem] lg:items-start">
        <div className="prose-tsu max-w-3xl order-2 lg:order-1">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="flex items-baseline gap-3">
                <span className="font-mono text-base text-teal shrink-0">{i + 1}.</span>
                <span>{s.heading}</span>
              </h2>
              {s.body}
            </section>
          ))}
          {note && (
            <aside className="mt-14 border-t border-hairstrong pt-6 text-sm text-muted">
              {note}
            </aside>
          )}
        </div>

        <nav
          aria-label="Mục lục"
          className="order-1 lg:order-2 lg:sticky lg:top-24 border-l border-hairline pl-5"
        >
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted font-semibold mb-3">
            Mục lục
          </div>
          <ol className="space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.id} className="flex gap-2.5">
                <span className="font-mono text-muted shrink-0">{i + 1}.</span>
                <a href={`#${s.id}`} className="text-inksoft hover:text-brandink transition-colors">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  </Layout>
);

export default LegalDoc;
