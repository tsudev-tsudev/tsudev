import React from 'react';
import Seo from '../../components/Seo';
import { Layout, Badge, SectionHeading } from '@tsudev/ui';
import { trust, fmtDate } from '../../lib/trust';
import { withTrustAccess } from '../../lib/trustGate';
import type { GetServerSidePropsContext } from 'next';
import type { CertificateCard, TrustProgram } from '../../lib/types';

type TrustDirectoryProps = {
  certificates: CertificateCard[];
  programs: TrustProgram[];
  activeProgram: string | null;
};

export default function TrustDirectory({
  certificates,
  programs,
  activeProgram,
}: TrustDirectoryProps) {
  return (
    <Layout active="/trust" bare>
      <Seo
        title="Thư mục website được cấp dấu"
        path="/trust/directory"
        description="Danh sách website đang được tsudev cấp con dấu tín nhiệm, mở cho tài khoản đã có mã mời."
        noindex
      />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <SectionHeading eyebrow="Minh bạch" title="Website đang được cấp dấu" />
        <p className="text-fg-muted -mt-3 mb-8 text-sm max-w-2xl">
          Toàn bộ chứng chỉ còn hiệu lực đều được liệt kê ở đây. Nếu một website trưng huy hiệu
          tsudev nhưng không có mặt trong danh sách này, huy hiệu đó không hợp lệ.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <a
            href="/trust/directory"
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              !activeProgram ? 'bg-glow text-link' : 'text-fg-muted hover:text-fg'
            }`}
          >
            Tất cả
          </a>
          {programs.map((p) => (
            <a
              key={p.slug}
              href={`/trust/directory?program=${p.slug}`}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeProgram === p.slug ? 'bg-glow text-link' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {p.name}
            </a>
          ))}
        </div>

        {certificates.length === 0 && (
          <p className="py-16 text-center text-fg-muted">Chưa có chứng chỉ nào đang hiệu lực.</p>
        )}

        <div className="divide-y divide-line">
          {/* Hàng KHÔNG còn là một thẻ <a> bọc ngoài: nó chứa hai đích khác nhau
              (chứng chỉ và hồ sơ tổ chức), mà <a> lồng trong <a> là HTML không
              hợp lệ - trình duyệt tự gỡ và cả hai link cùng hỏng. */}
          {certificates.map((c) => (
            <div
              key={c.serial}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-4 px-3 -mx-3 rounded-lg hover:bg-surface transition-colors"
            >
              <a
                href={`/trust/verify/${c.serial}`}
                className="font-mono text-fg font-medium hover:text-link transition-colors"
              >
                {c.hostname}
              </a>
              <Badge tone="neutral" mono>
                {c.program?.name}
              </Badge>
              {c.organizationId ? (
                <a
                  href={`/trust/org/${c.organizationId}`}
                  className="text-xs text-fg-muted hover:text-link transition-colors"
                >
                  {c.organization}
                </a>
              ) : (
                <span className="text-xs text-fg-muted">{c.organization}</span>
              )}
              <span className="ml-auto font-mono text-xs text-fg-muted">{c.serial}</span>
              <span className="text-xs text-fg-muted w-24 text-right">
                đến {fmtDate(c.expiresAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return withTrustAccess(ctx, async (access) => {
    const program = typeof ctx.query.program === 'string' ? ctx.query.program : '';
    const [certificates, programs] = await Promise.all([
      trust.directory(access.headers, program ? `?program=${encodeURIComponent(program)}` : ''),
      trust.programs(access.headers),
    ]);
    return { props: { certificates, programs, activeProgram: program || null } };
  });
}
