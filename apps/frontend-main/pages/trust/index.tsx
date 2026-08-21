// Trang mặt tiền của Con dấu, và là trang /trust/* DUY NHẤT khách chưa đủ quyền
// còn mở được. Nó phục vụ hai vai:
//
//   - VIP trở lên: nội dung thật (chương trình, số liệu, quy trình).
//   - Còn lại: giải thích chế độ mời và chỉ đúng một lối đi tiếp.
//
// Giữ nó mở có chủ đích: mọi trang khác chuyển hướng VỀ ĐÂY, nên đây phải là
// nơi trả lời được "vì sao tôi không vào được, giờ làm gì" - chuyển hướng tới
// một trang cũng bị gác là một vòng lặp.
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { hasAtLeastRole } from '@tsudev/types';
import Seo from '../../components/Seo';
import { Layout, Button, Card, SectionHeading } from '@tsudev/ui';
import { trust } from '../../lib/trust';
import { trustAccess } from '../../lib/trustGate';
import type { GetServerSidePropsContext } from 'next';
import type { TrustProgram } from '../../lib/types';

const STEPS = [
  {
    n: '01',
    title: 'Nhận mã mời',
    desc: 'Quản trị viên tsudev cấp mã mời. Đổi mã ở /trust/redeem để mở bề mặt Con dấu.',
  },
  {
    n: '02',
    title: 'Xác minh tên miền',
    desc: 'Chứng minh bạn kiểm soát tên miền bằng bản ghi DNS, thẻ meta hoặc tệp xác minh.',
  },
  {
    n: '03',
    title: 'Nộp hồ sơ',
    desc: 'Chọn chương trình, khai phạm vi và đính kèm bằng chứng theo tiêu chí công bố.',
  },
  {
    n: '04',
    title: 'Nhận huy hiệu',
    desc: 'Nhúng một đoạn HTML. Huy hiệu do tsudev dựng theo thời gian thực và luôn dẫn tới trang xác thực.',
  },
];

type TrustStats = { active: number | string };

type TrustLandingProps =
  | { invited: true; programs: TrustProgram[]; stats: TrustStats }
  | { invited: false; anonymous: boolean };

const SEO = (
  <Seo
    title="Con dấu tín nhiệm"
    path="/trust"
    description="Con dấu tín nhiệm tsudev: chứng chỉ ký số cho website, cấp và tra cứu theo lời mời."
    // Con dấu đã rút khỏi chỉ mục tìm kiếm - Quyết định 2 của kế hoạch chế độ
    // mời. Trang này vẫn trả 200 cho bot ĐỂ bot đọc được thẻ này; chặn cứng thì
    // thẻ nằm ở nơi không ai đọc và URL vẫn lọt vào kết quả qua liên kết ngoài.
    noindex
  />
);

/**
 * Màn hình cho người chưa đủ quyền.
 *
 * ⚠️ Nó cũng là chỗ vá cái bẫy vai trò cũ: `token.role` chỉ được ghi ở lần đăng
 * nhập ĐẦU, nên người vừa đổi mã mời ở một tab khác (hoặc tới đây bằng liên kết
 * cũ) có DB nói VIP mà phiên vẫn nói MEMBER - và họ sẽ thấy đúng màn hình này,
 * trông y hệt như mã mời không có tác dụng. Gọi `update()` một lần buộc callback
 * `jwt` đọc lại vai trò TỪ DB; đổi thật thì tải lại trang để cổng SSR chạy lại.
 */
function InviteWall({ anonymous }: { anonymous: boolean }) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const refreshed = useRef(false);
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (anonymous || refreshed.current) return;
    refreshed.current = true;
    update();
  }, [anonymous, update]);

  useEffect(() => {
    if (refreshed.current && hasAtLeastRole(role, 'VIP')) {
      router.replace(router.asPath);
    }
  }, [role, router]);

  return (
    <Layout active="/trust" bare>
      {SEO}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 tsu-grid opacity-70" aria-hidden="true" />
        <div className="relative max-w-3xl mx-auto px-4 py-24">
          <span className="inline-flex items-center rounded-sm border border-line-control px-3 py-1 font-mono text-xs text-accent">
            {'// trust.tsudev'}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-fg text-balance">
            Con dấu tín nhiệm cấp theo lời mời
          </h1>
          <p className="mt-5 text-lg text-fg-secondary leading-relaxed">
            Chương trình con dấu, danh bạ website đã cấp dấu và trang tra cứu chứng chỉ chỉ mở cho
            tài khoản đã đổi mã mời do quản trị viên tsudev cấp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {anonymous ? (
              <Button as="a" href="/login?callbackUrl=%2Ftrust" size="lg">
                Đăng nhập
              </Button>
            ) : (
              <Button as="a" href="/trust/redeem" size="lg">
                Nhập mã mời
              </Button>
            )}
            <Button as="a" href="/docs" variant="secondary" size="lg">
              Tài liệu
            </Button>
          </div>
          <Card className="mt-10 p-6">
            <h2 className="font-semibold text-fg">Chưa có mã mời?</h2>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">
              Mã mời do quản trị viên cấp cho từng tài khoản. Nếu website của bạn dùng mã nguồn
              tsudev hoặc do tsudev thực hiện, hãy liên hệ để được cấp mã.
            </p>
            <p className="mt-3 text-sm text-fg-muted leading-relaxed">
              Khoá công khai để tự xác minh chữ ký chứng chỉ vẫn mở cho mọi người tại{' '}
              <a className="text-link hover:underline" href="/.well-known/tsudev-trust-jwks.json">
                /.well-known/tsudev-trust-jwks.json
              </a>
              .
            </p>
          </Card>
        </div>
      </section>
    </Layout>
  );
}

export default function TrustLanding(props: TrustLandingProps) {
  if (!props.invited) return <InviteWall anonymous={props.anonymous} />;
  const { programs, stats } = props;

  return (
    <Layout active="/trust" bare>
      {SEO}

      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 tsu-grid opacity-70" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <span className="inline-flex items-center rounded-sm border border-line-control px-3 py-1 font-mono text-xs text-accent">
            {'// trust.tsudev'}
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight text-fg text-balance max-w-2xl">
            Con dấu tín nhiệm cho website của bạn
          </h1>
          <p className="mt-5 text-lg text-fg-secondary max-w-2xl leading-relaxed">
            tsudev cấp và phân phối huy hiệu chứng nhận cho website tuân thủ bản quyền, bảo mật và
            bảo vệ dữ liệu. Mỗi huy hiệu gắn với một chứng chỉ có chữ ký số, tra cứu được bằng tài
            khoản đã có mã mời.
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
              <div className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-fg">
                {stats.active}
              </div>
              <div className="text-xs uppercase tracking-wider text-fg-muted mt-1">
                Chứng chỉ hiệu lực
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-fg">
                {programs.length}
              </div>
              <div className="text-xs uppercase tracking-wider text-fg-muted mt-1">
                Chương trình
              </div>
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
                className="block group rounded-md p-5 -m-1 transition-colors hover:bg-surface"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-fg text-lg group-hover:text-link transition-colors">
                    {p.name}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{p.summary}</p>
                <p className="mt-3 font-mono text-xs text-fg-muted">
                  {(p.criteria || []).length} tiêu chí · hiệu lực {p.validityDays} ngày
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="py-10">
          <SectionHeading eyebrow="Quy trình" title="Từ mã mời tới huy hiệu" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="font-mono text-sm font-bold text-accent">{s.n}</div>
                <h3 className="mt-2 font-semibold text-fg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <SectionHeading eyebrow="Chống giả mạo" title="Vì sao huy hiệu này đáng tin" />
          <div className="grid md:grid-cols-3 gap-x-8 gap-y-10 max-w-5xl">
            <div>
              <h3 className="font-semibold text-fg">Dựng theo thời gian thực</h3>
              <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">
                Huy hiệu không phải ảnh tĩnh. Nó do tsudev dựng mỗi lần hiển thị, nên khi một chứng
                chỉ bị thu hồi thì huy hiệu trên website đổi trạng thái trong vòng vài phút.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-fg">Gắn với tên miền</h3>
              <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">
                Mỗi chứng chỉ chỉ có giá trị cho đúng tên miền đã xác minh. Sao chép huy hiệu sang
                website khác sẽ hiện cảnh báo sai tên miền.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-fg">Chữ ký số kiểm chứng độc lập</h3>
              <p className="mt-1.5 text-sm text-fg-muted leading-relaxed">
                Nội dung chứng chỉ được ký bằng Ed25519. Bất kỳ ai cũng có thể tự xác minh bằng
                <a className="text-link hover:underline" href="/.well-known/tsudev-trust-jwks.json">
                  {' '}
                  khoá công khai
                </a>{' '}
                mà không cần tin API của tsudev - khoá đó cố ý vẫn công khai.
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-3xl text-sm text-fg-muted leading-relaxed border-t border-line pt-5">
            Nói thẳng về giới hạn: không cơ chế nào ngăn được việc ai đó chụp ảnh huy hiệu rồi tự
            đăng lên website của họ. Điều chống được giả mạo là{' '}
            <a className="text-link hover:underline" href="/trust/verify">
              trang tra cứu
            </a>{' '}
            và
            <a className="text-link hover:underline" href="/trust/directory">
              {' '}
              thư mục
            </a>{' '}
            - huy hiệu nào không tra ra chứng chỉ tương ứng thì không có giá trị. Từ khi Con dấu
            chuyển sang chế độ mời, cả hai chỉ mở cho tài khoản đã có mã mời.
          </p>
        </section>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const access = await trustAccess(ctx);
  // KHÔNG chuyển hướng ở đây - đây là trang đích của mọi chuyển hướng khác.
  if (!access.ok) {
    return { props: { invited: false as const, anonymous: access.reason === 'anonymous' } };
  }
  const [programs, directory] = await Promise.all([
    trust.programs(access.headers),
    trust.directory(access.headers, '?limit=100'),
  ]);
  return {
    props: { invited: true as const, programs, stats: { active: directory.length } },
  };
}
