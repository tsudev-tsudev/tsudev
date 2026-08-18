import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../../components/Seo';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Button, Badge, SectionHeading } from '@tsudev/ui';
import type { BadgeTone } from '@tsudev/ui';
import { statusMeta, fmtDate } from '../../lib/trust';
import { withTrustAccess } from '../../lib/trustGate';
import type { GetServerSidePropsContext } from 'next';
import type { PortalApplication, PortalOrg, SealEmbed } from '../../lib/types';

// Nhãn trạng thái hồ sơ. `tone` khai đúng union của Badge để một tông sai chính
// tả là lỗi biên dịch chứ không phải một huy hiệu xám xuất hiện lặng lẽ.
const APP_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Nháp', tone: 'outline' },
  SUBMITTED: { label: 'Đã nộp', tone: 'brand' },
  IN_REVIEW: { label: 'Đang thẩm định', tone: 'brand' },
  NEEDS_INFO: { label: 'Cần bổ sung', tone: 'warning' },
  APPROVED: { label: 'Đã cấp', tone: 'success' },
  REJECTED: { label: 'Từ chối', tone: 'warning' },
  WITHDRAWN: { label: 'Đã rút', tone: 'outline' },
};

export default function TrustPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orgs, setOrgs] = useState<PortalOrg[]>([]);
  const [apps, setApps] = useState<PortalApplication[]>([]);
  const [embed, setEmbed] = useState<SealEmbed | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/trust/orgs'),
      fetch('/api/trust/applications'),
    ]);
    if (r1.ok) setOrgs(await r1.json());
    if (r2.ok) setApps(await r2.json());
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  async function showEmbed(serial: string) {
    const r = await fetch(`/api/trust/certificates/${serial}/embed`);
    if (r.ok) {
      setEmbed(await r.json());
      setCopied(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      /* trình duyệt chặn clipboard */
    }
  }

  if (status !== 'loading' && !session) {
    return (
      <Layout active="/trust" bare>
        <Seo title="Hồ sơ con dấu" path="/trust/portal" noindex />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-ink mb-2">Hồ sơ con dấu của bạn</h1>
          <p className="text-inksoft mb-6">
            Đăng nhập để xem tổ chức, tên miền và chứng chỉ của bạn.
          </p>
          <Button onClick={() => signIn()} size="lg">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  const certificates = orgs.flatMap((o) => o.certificates || []);

  return (
    <Layout active="/trust" bare>
      <Seo title="Hồ sơ con dấu" path="/trust/portal" noindex />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <SectionHeading
          eyebrow="Cổng khách hàng"
          title="Hồ sơ con dấu của bạn"
          action={
            <Button as="a" href="/trust/apply" size="sm">
              + Nộp hồ sơ mới
            </Button>
          }
        />

        {router.query.submitted && (
          <p
            className="mb-8 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--success) 12%, var(--panel))',
              color: 'var(--success)',
            }}
          >
            Đã nộp hồ sơ. tsudev sẽ thẩm định và phản hồi qua email liên hệ của tổ chức.
          </p>
        )}

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink mb-1">Chứng chỉ</h2>
          <p className="text-sm text-muted mb-4">Bấm một chứng chỉ để lấy mã nhúng huy hiệu.</p>
          {certificates.length === 0 && (
            <p className="py-8 text-muted text-sm">Chưa có chứng chỉ nào.</p>
          )}
          <div className="divide-y divide-[color:var(--border)]">
            {certificates.map((c) => {
              const meta = statusMeta(c.status);
              return (
                <div key={c.serial} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <span className="font-mono text-sm text-ink">{c.serial}</span>
                  <Badge
                    tone={
                      meta.tone === 'success'
                        ? 'success'
                        : meta.tone === 'error'
                        ? 'warning'
                        : 'outline'
                    }
                    mono
                  >
                    {meta.label || c.status}
                  </Badge>
                  <span className="font-mono text-sm text-inksoft">{c.hostname}</span>
                  <span className="text-xs text-muted">{c.program?.name}</span>
                  <span className="ml-auto text-xs text-muted">đến {fmtDate(c.expiresAt)}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => showEmbed(c.serial)}>
                      Mã nhúng
                    </Button>
                    <Button size="sm" variant="ghost" as="a" href={`/trust/verify/${c.serial}`}>
                      Xác thực
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {embed && (
            <div className="mt-6 rounded-lg bg-panel2 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="font-semibold text-ink text-sm">Mã nhúng - {embed.serial}</span>
                <button
                  onClick={() => setEmbed(null)}
                  className="text-muted hover:text-ink text-sm"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              {/* eslint-disable-next-line */}
              <img src={embed.sealUrl} alt={`Huy hiệu ${embed.serial}`} width={188} height={62} />
              <pre className="mt-3 text-[11px] text-inksoft overflow-x-auto whitespace-pre-wrap break-all">
                {embed.html}
              </pre>
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" onClick={() => copy(embed.html)}>
                  {copied ? 'Đã sao chép' : 'Sao chép mã'}
                </Button>
                <span className="text-xs text-muted">{embed.note}</span>
              </div>
            </div>
          )}
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink mb-4">Hồ sơ đã nộp</h2>
          {apps.length === 0 && <p className="py-8 text-muted text-sm">Chưa có hồ sơ nào.</p>}
          <div className="divide-y divide-[color:var(--border)]">
            {apps.map((a) => {
              const st = APP_STATUS[a.status] ?? { label: a.status, tone: 'outline' as BadgeTone };
              return (
                <div key={a.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Badge tone={st.tone} mono>
                      {st.label}
                    </Badge>
                    <span className="font-mono text-sm text-inksoft">{a.hostname}</span>
                    <span className="text-sm text-ink">{a.program?.name}</span>
                    {a.serial && (
                      <a
                        className="font-mono text-xs text-brandink hover:underline"
                        href={`/trust/verify/${a.serial}`}
                      >
                        {a.serial}
                      </a>
                    )}
                  </div>
                  {a.scope && <p className="mt-1.5 text-sm text-muted">{a.scope}</p>}
                  {a.reviewNote && (
                    <p
                      className="mt-2 text-sm rounded-lg px-3 py-2"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--warning) 10%, var(--panel))',
                        color: 'var(--warning)',
                      }}
                    >
                      Phản hồi từ tsudev: {a.reviewNote}
                      {a.status === 'NEEDS_INFO' && (
                        <>
                          {' '}
                          -{' '}
                          <a className="underline" href="/trust/apply">
                            bổ sung và nộp lại
                          </a>{' '}
                          (không tính phí thêm).
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">Tổ chức &amp; tên miền</h2>
          {orgs.length === 0 && <p className="py-8 text-muted text-sm">Chưa có tổ chức nào.</p>}
          <div className="space-y-6">
            {orgs.map((o) => (
              <div key={o.id}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">{o.name}</span>
                  <span className="text-xs text-muted">{o.contactEmail}</span>
                </div>
                <div className="mt-2 divide-y divide-[color:var(--border)]">
                  {(o.domains || []).map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="font-mono text-sm text-inksoft flex-1">{d.hostname}</span>
                      <Badge
                        tone={
                          d.status === 'VERIFIED'
                            ? 'success'
                            : d.status === 'FAILED'
                            ? 'warning'
                            : 'outline'
                        }
                        mono
                      >
                        {d.status}
                      </Badge>
                      {d.verifiedAt && (
                        <span className="text-xs text-muted">xác minh {fmtDate(d.verifiedAt)}</span>
                      )}
                      {d.lastError && (
                        <span className="text-xs text-[var(--warning)] w-full">{d.lastError}</span>
                      )}
                    </div>
                  ))}
                  {(o.domains || []).length === 0 && (
                    <p className="py-2 text-sm text-muted">Chưa có tên miền.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

// Cổng khách hàng: dữ liệu do trang tự gọi ở phía client qua /api/trust/*, nên
// cổng thật nằm ở proxy và ở trust-service. Gác thêm ở đây để người chưa đủ
// quyền không nhìn thấy một trang rỗng rồi tự hỏi mình làm sai gì.
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return withTrustAccess(ctx, async () => ({ props: {} }));
}
