import React from 'react';
import Head from 'next/head';
import { Layout, Button, Badge } from '@tsudev/ui';
import { trust } from '../../../lib/trust';

export default function ProgramDetail({ program }) {
  return (
    <Layout active="/trust" bare>
      <Head>
        <title>{`${program.name} — Con dấu tín nhiệm tsudev`}</title>
        <meta name="description" content={program.summary} />
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <nav className="text-sm text-muted mb-5">
          <a href="/trust" className="hover:text-brandink">
            Con dấu tín nhiệm
          </a>
          <span className="mx-1.5">/</span>
          <span className="text-inksoft">{program.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-ink">{program.name}</h1>
          <Badge tone="neutral" mono>
            {program.feeCredits > 0 ? `${program.feeCredits} tín dụng` : 'miễn phí'}
          </Badge>
        </div>
        <p className="mt-3 text-lg text-inksoft leading-relaxed">{program.summary}</p>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm text-muted">
          <span>
            Hiệu lực: <span className="text-ink">{program.validityDays} ngày</span>
          </span>
          <span>
            Đang cấp: <span className="text-ink">{program.issuedCount}</span>
          </span>
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink">Tiêu chí đánh giá</h2>
          <p className="mt-1.5 text-sm text-muted">
            Toàn bộ tiêu chí được công bố công khai. Hồ sơ phải đáp ứng tất cả các mục dưới đây.
          </p>
          <ol className="mt-5 divide-y divide-[color:var(--border)]">
            {(program.criteria || []).map((c, i) => (
              <li key={c.key || i} className="flex gap-4 py-3.5">
                <span className="font-mono text-xs text-teal pt-0.5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-ink text-sm">{c.label}</div>
                  {c.detail && <div className="text-muted text-sm mt-0.5">{c.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink">Bằng chứng cần nộp</h2>
          <ul className="mt-5 divide-y divide-[color:var(--border)]">
            {(program.evidenceSpec || []).map((e, i) => (
              <li key={e.kind || i} className="flex items-center gap-3 py-3.5">
                <span className="text-sm text-ink flex-1">{e.label}</span>
                <Badge tone={e.required ? 'warning' : 'outline'} mono>
                  {e.required ? 'bắt buộc' : 'tuỳ chọn'}
                </Badge>
                <span className="font-mono text-xs text-muted w-32 text-right hidden sm:block">
                  {e.kind}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button as="a" href={`/trust/apply?program=${program.slug}`} size="lg">
            Nộp hồ sơ chương trình này
          </Button>
          <Button
            as="a"
            href={`/trust/directory?program=${program.slug}`}
            variant="secondary"
            size="lg"
          >
            Xem website đã được cấp
          </Button>
        </div>

        <p className="mt-12 text-xs text-muted leading-relaxed border-t border-hairline pt-5">
          Con dấu thuộc chương trình này chỉ khẳng định các tiêu chí liệt kê ở trên, tại thời điểm
          đánh giá. Mỗi chứng chỉ ghi rõ cơ sở đánh giá (tự khai / đã thẩm định bằng chứng / đã kiểm
          định) trên trang xác thực.
        </p>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const program = await trust.program(String(params.slug || ''));
  if (!program) return { notFound: true };
  return { props: { program } };
}
