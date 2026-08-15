import React from 'react';
import Seo from '../../../components/Seo';
import { Layout, Card, Badge, SectionHeading, Stat } from '@tsudev/ui';
import { trust, STATUS_META, fmtDate } from '../../../lib/trust';

// Hồ sơ uy tín của tổ chức mang dấu tsudev.
//
// Trang này cố ý KHÔNG hiển thị một "điểm uy tín" tổng hợp. Điểm số trông có
// thẩm quyền hơn thứ nó đo được, và người đọc không kiểm chứng được cách tính.
// Bốn chỉ số thô, mỗi cái truy về được nguồn (chứng chỉ, tên miền, lịch sử giám
// sát), trung thực hơn — và đó chính là điều một con dấu tín nhiệm phải làm.

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-hairline last:border-0">
      <dt className="text-sm text-muted shrink-0">{label}</dt>
      <dd className="text-sm text-inksoft text-right">{children}</dd>
    </div>
  );
}

export default function OrgProfile({ profile, id }) {
  if (!profile)
    return (
      <Layout active="/trust">
        <Card className="p-8 text-center text-muted">Không tìm thấy hồ sơ tổ chức.</Card>
      </Layout>
    );

  const r = profile.reputation;

  return (
    <Layout active="/trust" bare>
      <Seo
        title={profile.name}
        path={`/trust/org/${id}`}
        description={`Hồ sơ tín nhiệm của ${profile.name}: chứng chỉ đang hiệu lực, tên miền đã xác minh và lịch sử giám sát.`}
      />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/trust" className="hover:text-brandink">
            Con dấu
          </a>{' '}
          <span className="mx-1.5">/</span>{' '}
          <a href="/trust/directory" className="hover:text-brandink">
            Danh bạ
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{profile.name}</span>
        </nav>

        <SectionHeading eyebrow="Hồ sơ tín nhiệm" title={profile.name} />

        <div className="flex flex-wrap gap-10 mb-8">
          <Stat value={String(r.activeCertificates)} label="Chứng chỉ hiệu lực" />
          <Stat value={String(r.verifiedDomains)} label="Tên miền đã xác minh" />
          <Stat
            value={r.firstIssuedAt ? String(new Date(r.firstIssuedAt).getFullYear()) : '—'}
            label="Mang dấu từ"
          />
          <Stat
            value={r.checkPassRate === null ? 'Chưa đo' : `${r.checkPassRate}%`}
            label="Vượt kiểm định kỳ"
          />
        </div>

        <div className="grid md:grid-cols-[1fr_18rem] gap-8 items-start">
          <div>
            <h2 className="font-semibold text-ink mb-3">Chứng chỉ đang hiệu lực</h2>
            <div className="space-y-3">
              {profile.certificates.length === 0 && (
                <Card className="p-5 text-muted">Tổ chức này chưa có chứng chỉ nào hiệu lực.</Card>
              )}
              {profile.certificates.map((c) => (
                <Card
                  key={c.serial}
                  as="a"
                  href={`/trust/verify/${c.serial}`}
                  hover
                  className="p-5"
                >
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge tone="success">{STATUS_META.ACTIVE.label}</Badge>
                    {c.program && <Badge tone="neutral">{c.program.name}</Badge>}
                  </div>
                  <div className="font-mono text-sm text-ink">{c.hostname}</div>
                  <div className="mt-1 text-xs text-muted">
                    Cấp {fmtDate(c.issuedAt)} · hết hạn {fmtDate(c.expiresAt)} ·{' '}
                    <span className="font-mono">{c.serial}</span>
                  </div>
                </Card>
              ))}
            </div>

            {profile.history.length > 0 && (
              <>
                <h2 className="font-semibold text-ink mt-8 mb-3">Lịch sử</h2>
                <p className="text-sm text-muted mb-3">
                  Chứng chỉ đã hết hạn, bị đình chỉ hoặc thu hồi. Hiển thị công khai có chủ đích —
                  một hồ sơ tín nhiệm chỉ khoe phần đẹp thì không đáng tin.
                </p>
                <div className="space-y-2">
                  {profile.history.map((c) => {
                    const meta = STATUS_META[c.status] || STATUS_META.EXPIRED;
                    return (
                      <Card key={c.serial} className="p-4 flex flex-wrap items-center gap-3">
                        <Badge tone={meta.tone === 'error' ? 'warning' : 'outline'}>
                          {meta.label}
                        </Badge>
                        <span className="font-mono text-sm text-inksoft">{c.hostname}</span>
                        <span className="text-xs text-muted">
                          {c.revokedAt ? `Thu hồi ${fmtDate(c.revokedAt)}` : fmtDate(c.expiresAt)}
                        </span>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-2">Tổ chức</h2>
              <dl>
                {profile.legalName && <Row label="Tên pháp lý">{profile.legalName}</Row>}
                {profile.country && <Row label="Quốc gia">{profile.country}</Row>}
                <Row label="Hồ sơ lập">{fmtDate(profile.createdAt)}</Row>
                {profile.websiteUrl && (
                  <Row label="Website">
                    <a
                      href={profile.websiteUrl}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="text-brandink hover:underline break-all"
                    >
                      {profile.websiteUrl}
                    </a>
                  </Row>
                )}
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-2">Giám sát tên miền</h2>
              <dl>
                <Row label="Lần kiểm gần nhất">{fmtDate(r.lastCheckedAt)}</Row>
                <Row label="Số lần đã kiểm">{r.checksTotal}</Row>
                <Row label="Số lần đạt">{r.checksPassed}</Row>
                {r.revokedCertificates > 0 && (
                  <Row label="Chứng chỉ bị thu hồi">{r.revokedCertificates}</Row>
                )}
              </dl>
              {r.checkPassRate === null && (
                <p className="mt-3 text-xs text-muted">
                  Chưa có lần giám sát nào được ghi nhận. &quot;Chưa đo&quot; không phải là
                  &quot;đạt&quot;.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink mb-2">Tên miền đã xác minh</h2>
              {profile.domains.length === 0 ? (
                <p className="text-sm text-muted">Chưa có.</p>
              ) : (
                <ul className="space-y-1">
                  {profile.domains.map((d) => (
                    <li key={d.hostname} className="font-mono text-sm text-inksoft">
                      {d.hostname}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const profile = await trust.profile(params.id);
  return { props: { profile, id: params.id } };
}
