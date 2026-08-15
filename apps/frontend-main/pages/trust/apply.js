import React, { useCallback, useEffect, useState } from 'react';
import Seo from '../../components/Seo';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Button, Badge, SectionHeading } from '@tsudev/ui';
import { trust } from '../../lib/trust';

const METHOD_LABEL = { DNS_TXT: 'Bản ghi DNS TXT', META_TAG: 'Thẻ meta', FILE: 'Tệp xác minh' };

const inputCls =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none transition-colors';
const labelCls = 'block text-sm font-medium text-inksoft mb-1.5';

function Step({ n, title, done, active, children }) {
  return (
    <section className={`py-8 border-t border-hairline ${!active && !done ? 'opacity-45' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`font-mono text-sm font-bold ${
            done ? 'text-[var(--success)]' : active ? 'text-teal' : 'text-muted'
          }`}
        >
          {done ? '✓' : String(n).padStart(2, '0')}
        </span>
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function TrustApply({ programs, preselect }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [orgForm, setOrgForm] = useState({
    name: '',
    legalName: '',
    contactEmail: '',
    country: 'VN',
  });
  const [domainForm, setDomainForm] = useState({ hostname: '', method: 'DNS_TXT' });
  const [domainId, setDomainId] = useState('');
  const [instructions, setInstructions] = useState(null);
  const [programSlug, setProgramSlug] = useState(preselect || '');
  const [scope, setScope] = useState('');
  const [evidence, setEvidence] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/trust/orgs');
    if (!r.ok) return;
    const d = await r.json();
    setOrgs(d);
    if (d.length && !orgId) setOrgId(d[0].id);
  }, [orgId]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  const org = orgs.find((o) => o.id === orgId) || null;
  const domain = org ? (org.domains || []).find((d) => d.id === domainId) : null;
  const domainVerified = domain && domain.status === 'VERIFIED';
  const program = programs.find((p) => p.slug === programSlug) || null;

  const call = async (url, body, method = 'POST') => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || `Lỗi ${r.status}`);
        return null;
      }
      return d;
    } finally {
      setBusy(false);
    }
  };

  async function createOrg(e) {
    e.preventDefault();
    const d = await call('/api/trust/orgs', orgForm);
    if (d) {
      setMsg('Đã tạo tổ chức.');
      setOrgForm({ name: '', legalName: '', contactEmail: '', country: 'VN' });
      await load();
      setOrgId(d.id);
    }
  }

  async function addDomain(e) {
    e.preventDefault();
    const d = await call(`/api/trust/orgs/${orgId}/domains`, domainForm);
    if (d) {
      setDomainId(d.id);
      setInstructions(d.instructions);
      setMsg('Đã thêm tên miền. Làm theo hướng dẫn bên dưới rồi bấm kiểm tra.');
      await load();
    }
  }

  async function runVerify() {
    const d = await call(`/api/trust/domains/${domainId}/verify`);
    if (d) {
      setMsg(d.ok ? 'Xác minh thành công.' : `Chưa đạt: ${d.detail}`);
      await load();
    }
  }

  async function submitApplication(e) {
    e.preventDefault();
    const created = await call('/api/trust/applications', { domainId, programSlug, scope });
    if (!created) return;
    for (const spec of program.evidenceSpec || []) {
      const val = (evidence[spec.kind] || '').trim();
      if (!val) continue;
      const isUrl = /^https?:\/\//i.test(val);
      await call(`/api/trust/applications/${created.id}/evidence`, {
        kind: spec.kind,
        label: spec.label,
        url: isUrl ? val : null,
        note: isUrl ? null : val,
      });
    }
    const sent = await call(`/api/trust/applications/${created.id}/submit`);
    if (sent) router.push('/trust/portal?submitted=1');
  }

  if (status !== 'loading' && !session) {
    return (
      <Layout active="/trust" bare>
        <Seo title="Đăng ký cấp dấu" path="/trust/apply" noindex />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-ink mb-2">Đăng ký cấp con dấu</h1>
          <p className="text-inksoft mb-6">Bạn cần đăng nhập bằng tài khoản tsudev để nộp hồ sơ.</p>
          <Button onClick={() => signIn()} size="lg">
            Đăng nhập
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="/trust" bare>
      <Seo title="Đăng ký cấp dấu" path="/trust/apply" noindex />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SectionHeading
          eyebrow="Đăng ký"
          title="Nộp hồ sơ cấp con dấu"
          action={
            <Button as="a" href="/trust/portal" variant="ghost" size="sm">
              Hồ sơ của tôi →
            </Button>
          }
        />

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

        <Step n={1} title="Tổ chức đứng tên" active={!orgId} done={!!orgId}>
          {orgs.length > 0 && (
            <label className="block mb-5">
              <span className={labelCls}>Chọn tổ chức đã có</span>
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setDomainId('');
                  setInstructions(null);
                }}
                className={inputCls}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <details open={orgs.length === 0}>
            <summary className="text-sm text-inksoft cursor-pointer hover:text-brandink mb-3">
              Hoặc tạo tổ chức mới
            </summary>
            <form onSubmit={createOrg} className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Tên tổ chức</span>
                <input
                  required
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Tên pháp nhân</span>
                <input
                  value={orgForm.legalName}
                  onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Email liên hệ</span>
                <input
                  required
                  type="email"
                  value={orgForm.contactEmail}
                  onChange={(e) => setOrgForm({ ...orgForm, contactEmail: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Quốc gia</span>
                <input
                  value={orgForm.country}
                  onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                  className={inputCls}
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy} size="sm">
                  Tạo tổ chức
                </Button>
              </div>
            </form>
          </details>
        </Step>

        <Step
          n={2}
          title="Xác minh quyền kiểm soát tên miền"
          active={!!orgId && !domainVerified}
          done={domainVerified}
        >
          {!orgId ? (
            <p className="text-sm text-muted">Chọn hoặc tạo tổ chức trước.</p>
          ) : (
            <>
              {org && (org.domains || []).length > 0 && (
                <div className="mb-5">
                  <div className={labelCls}>Tên miền đã thêm</div>
                  <div className="space-y-1">
                    {org.domains.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-panel transition-colors cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="domain"
                          checked={domainId === d.id}
                          onChange={() => {
                            setDomainId(d.id);
                            setInstructions(null);
                          }}
                        />
                        <span className="font-mono text-sm text-ink flex-1">{d.hostname}</span>
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
                        <span className="text-xs text-muted hidden sm:inline">
                          {METHOD_LABEL[d.method]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <details open={!org || (org.domains || []).length === 0}>
                <summary className="text-sm text-inksoft cursor-pointer hover:text-brandink mb-3">
                  Thêm tên miền mới
                </summary>
                <form
                  onSubmit={addDomain}
                  className="grid sm:grid-cols-[1fr_200px_auto] gap-3 items-end"
                >
                  <label className="block">
                    <span className={labelCls}>Tên miền</span>
                    <input
                      required
                      placeholder="example.com"
                      value={domainForm.hostname}
                      onChange={(e) => setDomainForm({ ...domainForm, hostname: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Cách xác minh</span>
                    <select
                      value={domainForm.method}
                      onChange={(e) => setDomainForm({ ...domainForm, method: e.target.value })}
                      className={inputCls}
                    >
                      {Object.entries(METHOD_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" disabled={busy}>
                    Thêm
                  </Button>
                </form>
              </details>

              {instructions && (
                <div className="mt-5 rounded-lg bg-panel2 p-4">
                  <div className="font-semibold text-ink text-sm">{instructions.title}</div>
                  {instructions.record && (
                    <dl className="mt-3 font-mono text-xs space-y-1.5">
                      <div>
                        <span className="text-muted">Loại: </span>
                        <span className="text-ink">{instructions.record.type}</span>
                      </div>
                      <div>
                        <span className="text-muted">Tên: </span>
                        <span className="text-ink break-all">{instructions.record.name}</span>
                      </div>
                      <div>
                        <span className="text-muted">Giá trị: </span>
                        <span className="text-ink break-all">{instructions.record.value}</span>
                      </div>
                    </dl>
                  )}
                  {instructions.snippet && (
                    <pre className="mt-3 text-xs text-ink overflow-x-auto whitespace-pre-wrap break-all">
                      {instructions.snippet}
                    </pre>
                  )}
                  {instructions.path && (
                    <div className="mt-2 font-mono text-xs text-muted break-all">
                      Đường dẫn: {instructions.path}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted">{instructions.note}</p>
                </div>
              )}
              {domainId && (
                <div className="mt-4">
                  <Button onClick={runVerify} disabled={busy} variant="secondary" size="sm">
                    Kiểm tra ngay
                  </Button>
                </div>
              )}
            </>
          )}
        </Step>

        <Step n={3} title="Chọn chương trình và nộp hồ sơ" active={domainVerified} done={false}>
          {!domainVerified ? (
            <p className="text-sm text-muted">Xác minh tên miền xong mới nộp được hồ sơ.</p>
          ) : (
            <form onSubmit={submitApplication} className="space-y-5">
              <label className="block">
                <span className={labelCls}>Chương trình</span>
                <select
                  required
                  value={programSlug}
                  onChange={(e) => setProgramSlug(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— chọn —</option>
                  {programs.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} ({p.feeCredits > 0 ? `${p.feeCredits} tín dụng` : 'miễn phí'})
                    </option>
                  ))}
                </select>
              </label>

              {program && (
                <>
                  <label className="block">
                    <span className={labelCls}>Phạm vi khẳng định</span>
                    <textarea
                      required
                      rows={2}
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      className={inputCls + ' resize-y'}
                      placeholder="Ví dụ: Chuyên mục Kiến thức dịch từ tài liệu tsudev"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Nội dung này in nguyên văn lên chứng chỉ và trang xác thực công khai.
                    </p>
                  </label>

                  <div className="space-y-4">
                    <div className="text-sm font-medium text-inksoft">Bằng chứng</div>
                    {(program.evidenceSpec || []).map((spec) => (
                      <label className="block" key={spec.kind}>
                        <span className={labelCls}>
                          {spec.label}{' '}
                          {spec.required && <span className="text-[var(--warning)]">*</span>}
                        </span>
                        <input
                          required={spec.required}
                          value={evidence[spec.kind] || ''}
                          onChange={(e) =>
                            setEvidence({ ...evidence, [spec.kind]: e.target.value })
                          }
                          className={inputCls}
                          placeholder="URL hoặc ghi chú"
                        />
                      </label>
                    ))}
                  </div>

                  <p className="text-sm text-muted">
                    Nộp hồ sơ sẽ trừ{' '}
                    <span className="text-ink font-medium">{program.feeCredits} tín dụng</span> từ
                    ví của bạn. Nếu tsudev yêu cầu bổ sung, lần nộp lại không tính phí thêm.
                  </p>
                </>
              )}
              <Button type="submit" disabled={busy || !program} size="lg">
                {busy ? 'Đang gửi…' : 'Nộp hồ sơ'}
              </Button>
            </form>
          )}
        </Step>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ query }) {
  const programs = await trust.programs();
  return {
    props: { programs, preselect: typeof query.program === 'string' ? query.program : null },
  };
}
