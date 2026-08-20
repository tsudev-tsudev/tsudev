import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../../components/Seo';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Button, Badge, SectionHeading, Stat } from '@tsudev/ui';
import { statusMeta, fmtDate } from '../../lib/trust';
import type {
  AdminApplication,
  AdminApplicationDetail,
  AdminCertificate,
  AuditEntry,
  RecheckConfig,
  TrustAdminSummary,
  TrustInvite,
} from '../../lib/types';

const BASIS = [
  { value: 'EVIDENCE_REVIEWED', label: 'Đã thẩm định bằng chứng' },
  { value: 'AUDITED', label: 'Đã kiểm định trực tiếp' },
  { value: 'SELF_DECLARED', label: 'Tổ chức tự khai' },
];

const inputCls =
  'w-full rounded-md border border-line bg-base px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary outline-none';
const labelCls = 'block text-sm font-medium text-fg-secondary mb-1.5';

export default function AdminTrust() {
  const { data: session, status } = useSession();
  // useState KHÔNG có tham số kiểu sẽ suy ra `never[]` cho `[]` và `null` cho
  // `null` - nghĩa là mọi trường đọc từ dữ liệu API đều báo lỗi "không tồn tại".
  // Khai kiểu ở đây là chỗ duy nhất mô tả hợp đồng giữa trang này và
  // /api/trust/admin/*.
  const [denied, setDenied] = useState(false);
  const [summary, setSummary] = useState<TrustAdminSummary | null>(null);
  const [queue, setQueue] = useState<AdminApplication[]>([]);
  const [certs, setCerts] = useState<AdminCertificate[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [recheck, setRecheck] = useState<RecheckConfig | null>(null);
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [invites, setInvites] = useState<TrustInvite[]>([]);
  // Mã thô hiện ĐÚNG MỘT LẦN, ngay sau khi cấp. Nó không nằm trong `invites`
  // và không đọc lại được từ đâu - DB chỉ giữ SHA-256.
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ label: '', maxUses: '1', expiresInDays: '' });
  const [form, setForm] = useState({ basis: 'EVIDENCE_REVIEWED', note: '', scope: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
    // Mã mời do auth-service quản, không phải trust-service - đổi mã ghi vào
    // User.role nên nó thuộc ranh giới danh tính. Đường đi cũng khác: proxy CÓ
    // PHIÊN /api/account/*, không phải /api/trust/*.
    const inv = await fetch('/api/account/invite/list', { method: 'POST' });
    setInvites(inv.ok ? await inv.json() : []);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  async function openDetail(id: string) {
    const r = await fetch(`/api/trust/applications/${id}`);
    if (r.ok) {
      const d = await r.json();
      setDetail(d);
      setForm({ basis: 'EVIDENCE_REVIEWED', note: '', scope: d.scope || '' });
    }
  }

  /** `okMsg` có thể là chuỗi cố định hoặc hàm đọc kết quả trả về (xem bên dưới). */
  async function act(
    url: string,
    body: Record<string, unknown> | null,
    okMsg: string | ((d: Record<string, unknown>) => string)
  ) {
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
      // okMsg có thể là hàm để đọc kết quả trả về - tái kiểm cần báo con số thật.
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
        <Seo title="Quản trị con dấu" path="/admin/trust" noindex />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-fg-secondary mb-6">
            Bạn cần đăng nhập bằng tài khoản có quyền kiểm duyệt.
          </p>
          <Button onClick={() => signIn()} size="lg">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="/admin" bare>
      <Seo title="Quản trị con dấu" path="/admin/trust" noindex />
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
              backgroundColor: 'var(--danger-tint)',
              color: 'var(--danger)',
            }}
          >
            ⛔ Tài khoản hiện tại không có quyền kiểm duyệt.
          </p>
        )}
        {err && (
          <p
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'var(--danger-tint)',
              color: 'var(--danger)',
            }}
          >
            {err}
          </p>
        )}
        {msg && (
          <p
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'var(--success-tint)',
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
          <h2 className="text-lg font-semibold text-fg mb-4">Hàng đợi thẩm định</h2>
          {queue.length === 0 && (
            <p className="py-8 text-fg-muted text-sm">Không có hồ sơ nào chờ xử lý.</p>
          )}
          <div className="divide-y divide-line">
            {queue.map((a) => (
              <button
                key={a.id}
                onClick={() => openDetail(a.id)}
                className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-2 py-4 px-3 -mx-3 rounded-lg hover:bg-surface transition-colors"
              >
                <Badge tone={a.status === 'NEEDS_INFO' ? 'warning' : 'brand'} mono>
                  {a.status}
                </Badge>
                <span className="font-mono text-sm text-fg">{a.hostname}</span>
                <Badge tone={a.domainStatus === 'VERIFIED' ? 'success' : 'warning'} mono>
                  domain {a.domainStatus}
                </Badge>
                <span className="text-sm text-fg-secondary">{a.program?.name}</span>
                <span className="text-xs text-fg-muted">{a.organization}</span>
                <span className="ml-auto text-xs text-fg-muted">
                  {a.evidenceCount} bằng chứng · {fmtDate(a.submittedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* --- Bảng thẩm định chi tiết --- */}
        {detail && (
          <section className="mb-14 rounded-md bg-surface p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-fg">{detail.program?.name}</h2>
                <p className="font-mono text-sm text-fg-secondary mt-0.5">
                  {detail.domain?.hostname}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-fg-muted hover:text-fg"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
              <div>
                <dt className="text-fg-muted">Tổ chức</dt>
                <dd className="text-fg">
                  {detail.organization?.name} · {detail.organization?.contactEmail}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">Tên miền</dt>
                <dd className="text-fg">
                  {detail.domain?.status}{' '}
                  {detail.domain?.verifiedAt ? `· ${fmtDate(detail.domain.verifiedAt)}` : ''}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-fg-muted">Phạm vi khách khai</dt>
                <dd className="text-fg">{detail.scope || '-'}</dd>
              </div>
            </dl>

            <div className="mb-6">
              <div className="text-sm text-fg-muted mb-2">Tiêu chí chương trình</div>
              <ul className="text-sm text-fg-secondary space-y-1">
                {(detail.program?.criteria || []).map((c, i) => (
                  <li key={c.key || i}>· {c.label}</li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <div className="text-sm text-fg-muted mb-2">
                Bằng chứng đã nộp ({detail.evidence?.length || 0})
              </div>
              <div className="divide-y divide-line">
                {(detail.evidence || []).map((e) => (
                  <div key={e.id} className="py-2.5 text-sm">
                    <span className="font-mono text-xs text-fg-muted mr-2">{e.kind}</span>
                    {e.url ? (
                      <a
                        className="text-link hover:underline break-all"
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {e.url}
                      </a>
                    ) : (
                      <span className="text-fg">{e.note}</span>
                    )}
                  </div>
                ))}
                {(detail.evidence || []).length === 0 && (
                  <p className="py-2 text-sm text-fg-muted">Không có bằng chứng.</p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <label className="block">
                <span className={labelCls}>
                  Cơ sở đánh giá <span className="text-warning-ink">*</span>
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
                <span className="block mt-1.5 text-xs text-fg-muted">
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
          <h2 className="text-lg font-semibold text-fg mb-4">Chứng chỉ đã cấp</h2>
          <div className="divide-y divide-line">
            {certs.map((c) => {
              const meta = statusMeta(c.status);
              return (
                <div key={c.serial} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                  <a
                    className="font-mono text-sm text-link hover:underline"
                    href={`/trust/verify/${c.serial}`}
                  >
                    {c.serial}
                  </a>
                  <Badge tone={c.status === 'ACTIVE' ? 'success' : 'warning'} mono>
                    {meta.label || c.status}
                  </Badge>
                  <span className="font-mono text-sm text-fg-secondary">{c.hostname}</span>
                  <span className="text-xs text-fg-muted">{c.program?.name}</span>
                  <span className="ml-auto text-xs text-fg-muted">đến {fmtDate(c.expiresAt)}</span>
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
              <p className="py-8 text-fg-muted text-sm">Chưa cấp chứng chỉ nào.</p>
            )}
          </div>
        </section>

        {/* --- Giám sát tên miền --- */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-fg mb-1">Giám sát tên miền</h2>
          <p className="text-sm text-fg-muted mb-4">
            {recheck && recheck.enabled ? (
              <>
                Hệ thống tự kiểm mỗi {recheck.intervalMin} phút, mỗi lượt tối đa {recheck.batch}{' '}
                chứng chỉ, chỉ kiểm lại chứng chỉ đã cũ hơn {Math.round(recheck.staleAfterMin / 60)}{' '}
                giờ. Chứng chỉ trượt {recheck.graceFailures} lần{' '}
                <strong className="text-fg-secondary">liên tiếp</strong> sẽ tự bị đình chỉ - tự đình
                chỉ, không bao giờ tự thu hồi. Xác minh lại được thì hệ thống tự bỏ đình chỉ, nhưng
                chỉ với những chứng chỉ do chính nó đình chỉ.
              </>
            ) : recheck ? (
              <>
                Bộ hẹn giờ trong tiến trình đang <strong className="text-warning-ink">tắt</strong> -
                tái kiểm phải do cron bên ngoài hoặc nút dưới đây kích hoạt.
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

        {/* --- Mã mời --- */}
        <section className="mb-14">
          <h2 className="text-lg font-semibold text-fg mb-1">Mã mời</h2>
          <p className="text-sm text-fg-muted mb-4 max-w-2xl leading-relaxed">
            Đổi mã hợp lệ nâng tài khoản lên <span className="font-mono text-xs">VIP</span> - mức
            tối đa mà mã mời cấp được, và trần đó nằm trong mã nguồn chứ không trong dữ liệu. Mã thô
            chỉ hiện một lần ngay sau khi cấp; hệ thống chỉ lưu bản băm.
          </p>

          {freshCode && (
            <div className="mb-4 rounded-md border border-line-strong bg-surface p-4">
              <p className="text-sm text-fg-secondary">
                Mã vừa cấp - chép lại ngay, nó không hiện lại lần nào nữa:
              </p>
              <p className="mt-2 font-mono text-lg font-bold tracking-wider text-fg select-all">
                {freshCode}
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-fg-muted hover:text-fg underline"
                onClick={() => setFreshCode(null)}
              >
                Tôi đã chép xong, ẩn đi
              </button>
            </div>
          )}

          <form
            className="mb-6 flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              setMsg(null);
              setBusy(true);
              try {
                const r = await fetch('/api/account/invite/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    label: inviteForm.label,
                    maxUses: Number(inviteForm.maxUses) || 1,
                    expiresInDays: Number(inviteForm.expiresInDays) || 0,
                  }),
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) {
                  setErr(d.error || `Lỗi ${r.status}`);
                  return;
                }
                setFreshCode(d.code);
                setInviteForm({ label: '', maxUses: '1', expiresInDays: '' });
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="min-w-56 flex-1">
              <label className={labelCls} htmlFor="invite-label">
                Nhãn (chỉ người vận hành thấy)
              </label>
              <input
                id="invite-label"
                className={inputCls}
                value={inviteForm.label}
                onChange={(e) => setInviteForm({ ...inviteForm, label: e.target.value })}
                placeholder="Đối tác ABC"
              />
            </div>
            <div className="w-28">
              <label className={labelCls} htmlFor="invite-uses">
                Số lượt
              </label>
              <input
                id="invite-uses"
                className={inputCls}
                type="number"
                min={1}
                value={inviteForm.maxUses}
                onChange={(e) => setInviteForm({ ...inviteForm, maxUses: e.target.value })}
              />
            </div>
            <div className="w-36">
              <label className={labelCls} htmlFor="invite-days">
                Hết hạn sau (ngày)
              </label>
              <input
                id="invite-days"
                className={inputCls}
                type="number"
                min={0}
                value={inviteForm.expiresInDays}
                onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: e.target.value })}
                placeholder="không hạn"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy || !inviteForm.label.trim()}>
              Cấp mã
            </Button>
          </form>

          <div className="divide-y divide-line">
            {invites.map((i) => {
              const expired = !!i.expiresAt && new Date(i.expiresAt).getTime() <= Date.now();
              const dead = !!i.revokedAt || expired || i.usedCount >= i.maxUses;
              return (
                <div
                  key={i.id}
                  className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="font-medium text-fg">{i.label}</span>
                  <Badge tone={dead ? 'outline' : 'success'}>
                    {i.revokedAt
                      ? 'đã thu hồi'
                      : expired
                      ? 'hết hạn'
                      : i.usedCount >= i.maxUses
                      ? 'hết lượt'
                      : 'còn dùng được'}
                  </Badge>
                  <span className="font-mono text-xs text-fg-muted">
                    {i.usedCount}/{i.maxUses} lượt · cấp {i.grantsRole}
                  </span>
                  {i.expiresAt && (
                    <span className="text-xs text-fg-muted">hạn {fmtDate(i.expiresAt)}</span>
                  )}
                  <span className="ml-auto text-xs text-fg-muted">{fmtDate(i.createdAt)}</span>
                  {!i.revokedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        act('/api/account/invite/revoke', { id: i.id }, 'Đã thu hồi mã.')
                      }
                    >
                      Thu hồi
                    </Button>
                  )}
                </div>
              );
            })}
            {invites.length === 0 && <p className="py-8 text-fg-muted text-sm">Chưa cấp mã nào.</p>}
          </div>
        </section>

        {/* --- Nhật ký --- */}
        <section>
          <h2 className="text-lg font-semibold text-fg mb-4">Nhật ký</h2>
          <div className="divide-y divide-line">
            {audit.map((a) => (
              <div key={a.id} className="py-2.5 text-sm flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-accent w-52 shrink-0">{a.action}</span>
                <span className="text-fg-secondary">{a.targetLabel || a.targetId}</span>
                {a.note && <span className="text-fg-muted">· {a.note}</span>}
                <span className="ml-auto text-xs text-fg-muted">
                  {a.actorName} · {fmtDate(a.createdAt)}
                </span>
              </div>
            ))}
            {audit.length === 0 && <p className="py-8 text-fg-muted text-sm">Chưa có hoạt động.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
