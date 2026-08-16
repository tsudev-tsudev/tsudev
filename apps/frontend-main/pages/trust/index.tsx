import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Button, SectionHeading, Badge } from '@tsudev/ui';
import { trust } from '../../lib/trust';
import type { TrustProgram } from '../../lib/types';

const STEPS = [
  {
    n: '01',
    title: 'Xác minh tên miền',
    desc: 'Chứng minh bạn kiểm soát tên miền bằng bản ghi DNS, thẻ meta hoặc tệp xác minh.',
  },
  {
    n: '02',
    title: 'Nộp hồ sơ',
    desc: 'Chọn chương trình, khai phạm vi và đính kèm bằng chứng theo tiêu chí công bố.',
  },
  {
    n: '03',
    title: 'tsudev thẩm định',
    desc: 'Đội ngũ tsudev đối chiếu bằng chứng và ghi rõ cơ sở đánh giá lên chứng chỉ.',
  },
  {
    n: '04',
    title: 'Nhận huy hiệu',
    desc: 'Nhúng một đoạn HTML. Huy hiệu do tsudev dựng theo thời gian thực và luôn dẫn tới trang xác thực.',
  },
];

/** Số liệu tổng quan hiển thị ở đầu trang. Luôn có — getServerSideProps dựng đủ. */
type TrustStats = { active: number | string; programs: number | string; domains: number | string };

type TrustLandingProps = { programs: TrustProgram[]; stats: TrustStats };

export default function TrustLanding({ programs, stats }: TrustLandingProps) {
  return (
    <Layout active="/trust" bare>
      <Seo
        title="Con dấu tín nhiệm"
        path="/trust"
        description="tsudev cấp con dấu tín nhiệm cho website: xác minh bản quyền, chứng nhận sở hữu, chứng chỉ bảo mật và tuân thủ bảo vệ dữ liệu."
      />

      <section className="relative overflow-hidden border-b border-hairline">
        <div className="absolute inset-0 tsu-grid opacity-70" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <span className="inline-flex items-center rounded-full border border-hairstrong px-3 py-1 font-mono text-xs text-teal">
            {'// trust.tsudev'}
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight text-ink text-balance max-w-2xl">
            Con dấu tín nhiệm cho website của bạn
          </h1>
          <p className="mt-5 text-lg text-inksoft max-w-2xl leading-relaxed">
            tsudev cấp và phân phối huy hiệu chứng nhận cho website tuân thủ bản quyền, bảo mật và
            bảo vệ dữ liệu. Mỗi huy hiệu gắn với một chứng chỉ có chữ ký số, tra cứu công khai được.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button as="a" href="/trust/apply" size="lg">
              Đăng ký cấp dấu
            </Button>
            <Button as="a" href="/trust/verify" variant="secondary" size="lg">
              Tra cứu con dấu
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap gap-10">
            <div>
              <div className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-ink">
                {stats.active}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted mt-1">
                Chứng chỉ hiệu lực
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-ink">
                {programs.length}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted mt-1">Chương trình</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <section className="py-16">
          <SectionHeading eyebrow="Chương trình" title="Bốn loại con dấu" />
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
            {programs.map((p) => (
              <a
                key={p.slug}
                href={`/trust/programs/${p.slug}`}
                className="block group rounded-md p-5 -m-1 transition-colors hover:bg-panel"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-ink text-lg group-hover:text-brandink transition-colors">
                    {p.name}
                  </h3>
                  <Badge tone="neutral" mono>
                    {(p.feeCredits ?? 0) > 0 ? `${p.feeCredits} tín dụng` : 'miễn phí'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted leading-relaxed">{p.summary}</p>
                <p className="mt-3 font-mono text-xs text-muted">
                  {(p.criteria || []).length} tiêu chí · hiệu lực {p.validityDays} ngày
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="py-10">
          <SectionHeading eyebrow="Quy trình" title="Từ đăng ký tới huy hiệu" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="font-mono text-sm font-bold text-teal">{s.n}</div>
                <h3 className="mt-2 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <SectionHeading eyebrow="Chống giả mạo" title="Vì sao huy hiệu này đáng tin" />
          <div className="grid md:grid-cols-3 gap-x-8 gap-y-10 max-w-5xl">
            <div>
              <h3 className="font-semibold text-ink">Dựng theo thời gian thực</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">
                Huy hiệu không phải ảnh tĩnh. Nó do tsudev dựng mỗi lần hiển thị, nên khi một chứng
                chỉ bị thu hồi thì huy hiệu trên website đổi trạng thái trong vòng vài phút.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-ink">Gắn với tên miền</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">
                Mỗi chứng chỉ chỉ có giá trị cho đúng tên miền đã xác minh. Sao chép huy hiệu sang
                website khác sẽ hiện cảnh báo sai tên miền.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-ink">Chữ ký số kiểm chứng độc lập</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">
                Nội dung chứng chỉ được ký bằng Ed25519. Bất kỳ ai cũng có thể tự xác minh bằng
                <a
                  className="text-brandink hover:underline"
                  href="/.well-known/tsudev-trust-jwks.json"
                >
                  {' '}
                  khoá công khai
                </a>{' '}
                mà không cần tin API của tsudev.
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-3xl text-sm text-muted leading-relaxed border-t border-hairline pt-5">
            Nói thẳng về giới hạn: không cơ chế nào ngăn được việc ai đó chụp ảnh huy hiệu rồi tự
            đăng lên website của họ. Điều chống được giả mạo là{' '}
            <a className="text-brandink hover:underline" href="/trust/verify">
              trang tra cứu
            </a>{' '}
            và
            <a className="text-brandink hover:underline" href="/trust/directory">
              {' '}
              thư mục công khai
            </a>{' '}
            — huy hiệu nào không tra ra chứng chỉ tương ứng thì không có giá trị.
          </p>
        </section>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const [programs, directory] = await Promise.all([
    trust.programs(),
    trust.directory('?limit=100'),
  ]);
  return { props: { programs, stats: { active: directory.length } } };
}
