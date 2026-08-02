import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Button, Badge, SectionHeading, Stat } from '@tsudev/ui';
import { STATUS_META, fmtDate } from '../../lib/trust';

const BASIS = [
  { value: 'EVIDENCE_REVIEWED', label: 'Đã thẩm định bằng chứng' },
  { value: 'AUDITED', label: 'Đã kiểm định trực tiếp' },
  { value: 'SELF_DECLARED', label: 'Tổ chức tự khai' },
];

const inputCls =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand outline-none';
const labelCls = 'block text-sm font-medium text-inksoft mb-1.5';

export default function AdminTrust() {
  const { data: session, status } = useSession();
  const [denied, setDenied] = useState(false);
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [certs, setCerts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [recheck, setRecheck] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ basis: 'EVIDENCE_REVIEWED', note: '', scope: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/trust/admin/summary');
    if (r.status === 401 || r.status === 403) {
      setDenied(true);
      return;
    }
    setSummary(await r.json());
    const [q, c, a, cfg] = await Promise.all([
      fetch('/api/trust/admin/applications').then((x) => x.json()),
      fetch('/api/trust/admin/certificates').then((x) => x.json()),
      fetch('/api/trust/admin/audit').then((x) => x.json()),
      fetch('/api/trust/admin/recheck/config')
        .then((x) => (x.ok ? x.json() : null))
        .catch(() => null),
    ]);
    setQueue(q);
    setCerts(c);
    setAudit(a);
    setRecheck(cfg);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  async function openDetail(id) {
    const r = await fetch(`/api/trust/applications/${id}`);
    if (r.ok) {
      const d = await r.json();
      setDetail(d);
      setForm({ basis: 'EVIDENCE_REVIEWED', note: '', scope: d.scope || '' });
    }
  }

  async function act(url, body, okMsg) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || `Lỗi ${r.status}`);
        return;
      }
      // okMsg có thể là hàm để đọc kết quả trả về — tái kiểm cần báo con số thật.
      setMsg(typeof okMsg === 'function' ? okMsg(d) : okMsg);
      setDetail(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'loading' && !session) {
    return (
      <Layout active="/admin" bare>
        <Head>
          <title>Quản trị con dấu — tsudev</title>
        </Head>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-inksoft mb-6">Bạn cần đăng nhập bằng tài khoản có quyền kiểm duyệt.</p>
          <Button onClick={() => signIn()} size="lg">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="/admin" bare>
      <Head>
        <title>Quản trị con dấu — tsudev</title>
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Nội bộ"
          title="Quản trị con dấu tín nhiệm"
          action={
            <Button as="a" href="/trust" variant="ghost" size="sm">
              Trang công khai →
            </Button>
          }
        />

        {denied && (
          <p
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--error) 10%, var(--panel))',
              color: 'var(--error)',
            }}
          >
            ⛔ Tài khoản hiện tại không có quyền kiểm duyệt.
          </p>
        )}
        {err && (
          <p
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--error) 12%, var(--panel))',
              color: 'var(--error)',
            }}
          >
            {err}
          </p>
        )}
        {msg && (
          <p
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--success) 12%, var(--panel))',
              color: 'var(--success)',
            }}
          >
            {msg}
          </p>
        )}

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <Stat value={summary.pending} label="Chờ duyệt" />
            <Stat value={summary.needsInfo} label="Chờ bổ sung" />
            <Stat value={summary.active} label="Đang hiệu lực" />
            <Stat value={summary.expiringSoon} label="Sắp hết hạn" />
            <Stat value={summary.revoked} label="Đã thu hồi" />
          </div>
        )}

        {/* --- Hàng đợi thẩm định --- */}
        <section className="mb-14">
          <h2 className="text-lg font-semibold text-ink mb-4">Hàng đợi thẩm định</h2>
          {queue.length === 0 && (
            <p className="py-8 text-muted text-sm">Không có hồ sơ nào chờ xử lý.</p>
          )}
          <div className="divide-y divide-[color:var(--border)]">
            {queue.map((a) => (
              <button
                key={a.id}
                onClick={() => openDetail(a.id)}
                className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-2 py-4 px-3 -mx-3 rounded-lg hover:bg-panel transition-colors"
              >
                <Badge tone={a.status === 'NEEDS_INFO' ? 'warning' : 'brand'} mono>
                  {a.status}
                </Badge>
                <span className="font-mono text-sm text-ink">{a.hostname}</span>
                <Badge tone={a.domainStatus === 'VERIFIED' ? 'success' : 'warning'} mono>
                  domain {a.domainStatus}
                </Badge>
                <span className="text-sm text-inksoft">{a.program?.name}</span>
                <span className="text-xs text-muted">{a.organization}</span>
                <span className="ml-auto text-xs text-muted">
                  {a.evidenceCount} bằng chứng · {fmtDate(a.submittedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* --- Bảng thẩm định chi tiết --- */}
        {detail && (
          <section className="mb-14 rounded-xl bg-panel p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">{detail.program?.name}</h2>
                <p className="font-mono text-sm text-inksoft mt-0.5">{detail.domain?.hostname}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-muted hover:text-ink"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
              <div>
                <dt className="text-muted">Tổ chức</dt>
                <dd className="text-ink">
                  {detail.organization?.name} · {detail.organization?.contactEmail}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Tên miền</dt>
                <dd className="text-ink">
                  {detail.domain?.status}{' '}
                  {detail.domain?.verifiedAt ? `· ${fmtDate(detail.domain.verifiedAt)}` : ''}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Phạm vi khách khai</dt>
                <dd className="text-ink">{detail.scope || '—'}</dd>
              </div>
            </dl>

            <div className="mb-6">
              <div className="text-sm text-muted mb-2">Tiêu chí chương trình</div>
              <ul className="text-sm text-inksoft space-y-1">
                {(detail.program?.criteria || []).map((c, i) => (
                  <li key={c.key || i}>· {c.label}</li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <div className="text-sm text-muted mb-2">
                Bằng chứng đã nộp ({detail.evidence?.length || 0})
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {(detail.evidence || []).map((e) => (
                  <div key={e.id} className="py-2.5 text-sm">
                    <span className="font-mono text-xs text-muted mr-2">{e.kind}</span>
                    {e.url ? (
                      <a
                        className="text-brandink hover:underline break-all"
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {e.url}
                      </a>
                    ) : (
                      <span className="text-ink">{e.note}</span>
                    )}
                  </div>
                ))}
                {(detail.evidence || []).length === 0 && (
                  <p className="py-2 text-sm text-muted">Không có bằng chứng.</p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <label className="block">
                <span className={labelCls}>
                  Cơ sở đánh giá <span className="text-[var(--warning)]">*</span>
                </span>
                <select
                  value={form.basis}
                  onChange={(e) => setForm({ ...form, basis: e.target.value })}
                  className={inputCls}
                >
                  {BASIS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <span className="block mt-1.5 text-xs text-muted">
                  In lên trang xác thực công khai. Chọn đúng mức bạn thực sự đã làm.
                </span>
              </label>
              <label className="block">
                <span className={labelCls}>Phạm vi ghi lên chứng chỉ</span>
                <input
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>

            <label className="block mb-5">
              <span className={labelCls}>
                Ghi chú cho khách (bắt buộc khi từ chối / yêu cầu bổ sung)
              </span>
              <textarea
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inputCls + ' resize-y'}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy}
                onClick={() =>
                  act(
                    `/api/trust/admin/applications/${detail.id}/approve`,
                    { basis: form.basis, scope: form.scope },
                    'Đã cấp chứng chỉ.'
                  )
                }
              >
                Duyệt &amp; cấp chứng chỉ
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() =>
                  act(
                    `/api/trust/admin/applications/${detail.id}/request-info`,
                    { note: form.note },
                    'Đã yêu cầu bổ sung.'
                  )
                }
              >
                Yêu cầu bổ sung
              </Button>
              <Button
                disabled={busy}
                variant="danger"
                onClick={() =>
                  act(
                    `/api/trust/admin/applications/${detail.id}/reject`,
                    { note: form.note },
                    'Đã từ chối hồ sơ.'
                  )
                }
              >
                Từ chối
              </Button>
            </div>
          </section>
        )}

        {/* --- Chứng chỉ đã cấp --- */}
        <section className="mb-14">
          <h2 className="text-lg font-semibold text-ink mb-4">Chứng chỉ đã cấp</h2>
          <div className="divide-y divide-[color:var(--border)]">
            {certs.map((c) => {
              const meta = STATUS_META[c.status] || {};
              return (
                <div key={c.serial} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                  <a
                    className="font-mono text-sm text-brandink hover:underline"
                    href={`/trust/verify/${c.serial}`}
                  >
                    {c.serial}
                  </a>
                  <Badge tone={c.status === 'ACTIVE' ? 'success' : 'warning'} mono>
                    {meta.label || c.status}
                  </Badge>
                  <span className="font-mono text-sm text-inksoft">{c.hostname}</span>
                  <span className="text-xs text-muted">{c.program?.name}</span>
                  <span className="ml-auto text-xs text-muted">đến {fmtDate(c.expiresAt)}</span>
                  {c.status !== 'REVOKED' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          act(
                            `/api/trust/admin/certificates/${c.serial}/suspend`,
                            { reason: form.note },
                            'Đã đổi trạng thái đình chỉ.'
                          )
                        }
                      >
                        {c.status === 'SUSPENDED' ? 'Bỏ đình chỉ' : 'Đình chỉ'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Lý do thu hồi (bắt buộc):');
                          if (reason && reason.trim())
                            act(
                              `/api/trust/admin/certificates/${c.serial}/revoke`,
                              { reason: reason.trim() },
                              'Đã thu hồi chứng chỉ.'
                            );
                        }}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {certs.length === 0 && (
              <p className="py-8 text-muted text-sm">Chưa cấp chứng chỉ nào.</p>
            )}
          </div>
        </section>

        {/* --- Giám sát tên miền --- */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-ink mb-1">Giám sát tên miền</h2>
          <p className="text-sm text-muted mb-4">
            {recheck && recheck.enabled ? (
              <>
                Hệ thống tự kiểm mỗi {recheck.intervalMin} phút, mỗi lượt tối đa {recheck.batch}{' '}
                chứng chỉ, chỉ kiểm lại chứng chỉ đã cũ hơn {Math.round(recheck.staleAfterMin / 60)}{' '}
                giờ. Chứng chỉ trượt {recheck.graceFailures} lần{' '}
                <strong className="text-inksoft">liên tiếp</strong> sẽ tự bị đình chỉ — tự đình chỉ,
                không bao giờ tự thu hồi. Xác minh lại được thì hệ thống tự bỏ đình chỉ, nhưng chỉ
                với những chứng chỉ do chính nó đình chỉ.
              </>
            ) : recheck ? (
              <>
                Bộ hẹn giờ trong tiến trình đang{' '}
                <strong className="text-[var(--warning)]">tắt</strong> — tái kiểm phải do cron bên
                ngoài hoặc nút dưới đây kích hoạt.
              </>
            ) : (
              'Đang tải cấu hình…'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                act(
                  '/api/trust/admin/recheck',
                  { limit: 25 },
                  (d) =>
                    `Đã kiểm ${d.checked} chứng chỉ: đạt ${d.passed}, trượt ${d.failed}, đình chỉ ${d.suspended}, khôi phục ${d.resumed}.`
                )
              }
            >
              Kiểm các chứng chỉ đến hạn
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                act(
                  '/api/trust/admin/recheck',
                  { limit: 100, all: true },
                  (d) =>
                    `Đã kiểm toàn bộ ${d.checked} chứng chỉ: đạt ${d.passed}, trượt ${d.failed}, đình chỉ ${d.suspended}, khôi phục ${d.resumed}.`
                )
              }
            >
              Kiểm toàn bộ ngay
            </Button>
          </div>
        </section>

        {/* --- Nhật ký --- */}
        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">Nhật ký</h2>
          <div className="divide-y divide-[color:var(--border)]">
            {audit.map((a) => (
              <div key={a.id} className="py-2.5 text-sm flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-teal w-52 shrink-0">{a.action}</span>
                <span className="text-inksoft">{a.targetLabel || a.targetId}</span>
                {a.note && <span className="text-muted">· {a.note}</span>}
                <span className="ml-auto text-xs text-muted">
                  {a.actorName} · {fmtDate(a.createdAt)}
                </span>
              </div>
            ))}
            {audit.length === 0 && <p className="py-8 text-muted text-sm">Chưa có hoạt động.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
