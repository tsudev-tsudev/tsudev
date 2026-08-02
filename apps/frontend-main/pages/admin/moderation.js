import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Badge, SectionHeading } from '@tsudev/ui';

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

const ACTION_LABEL = {
  PIN: 'Ghim',
  UNPIN: 'Bỏ ghim',
  LOCK: 'Khoá',
  UNLOCK: 'Mở khoá',
  DELETE_POST: 'Gỡ bài',
  BAN_USER: 'Cấm',
  UNBAN_USER: 'Bỏ cấm',
  RESOLVE_REPORT: 'Xử lý báo cáo',
  DISMISS_REPORT: 'Bỏ qua báo cáo',
};

export default function Moderation() {
  const { data: session, status } = useSession();
  const [reports, setReports] = useState([]);
  const [listings, setListings] = useState([]);
  const [audit, setAudit] = useState([]);
  const [denied, setDenied] = useState(false);
  const [banUser, setBanUser] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/mod/reports?status=OPEN'),
        fetch('/api/mod/audit'),
        fetch('/api/mod/listings'),
      ]);
      if (r1.status === 403 || r1.status === 401) {
        setDenied(true);
        return;
      }
      setReports(await r1.json());
      setAudit(await r2.json());
      setListings(await r3.json());
    } catch (e) {
      setMsg(e.message);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  async function act(url, body) {
    setMsg(null);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg('⛔ ' + (d.error || 'Thất bại'));
      return false;
    }
    await load();
    return true;
  }

  if (status === 'loading')
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Đang tải…</Card>
      </Layout>
    );
  if (!session)
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-inksoft mb-3">Cần đăng nhập kiểm duyệt viên.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );
  if (denied)
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-ink mb-2">Không có quyền</h1>
          <p className="text-muted">
            Đăng nhập bằng <code className="font-mono text-brandink">tsudev</code> /{' '}
            <code className="font-mono">devpass</code>.
          </p>
        </div>
      </Layout>
    );

  return (
    <Layout active="/admin" bare>
      <Head>
        <title>Kiểm duyệt — tsudev</title>
      </Head>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/admin" className="hover:text-brandink">
            Quản trị
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">Kiểm duyệt</span>
        </nav>
        {msg && <Card className="p-3 mb-4 text-sm text-inksoft">{msg}</Card>}

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <div>
            <SectionHeading eyebrow={`${reports.length} chờ xử lý`} title="Hàng chờ báo cáo" />
            <div className="space-y-3">
              {reports.length === 0 && (
                <Card className="p-8 text-center text-muted">✓ Không có báo cáo nào đang chờ.</Card>
              )}
              {reports.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge tone="warning" mono>
                      {r.targetType}
                    </Badge>
                    <span className="text-xs text-muted">
                      bởi {r.reporterName} · {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-inksoft mb-1">
                    <span className="text-muted">Lý do:</span> {r.reason}
                  </p>
                  {r.targetPreview && (
                    <p className="text-sm text-muted italic bg-panel2 rounded-lg px-3 py-2 my-2">
                      “{r.targetPreview}”
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {r.targetType === 'POST' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => act(`/api/mod/posts/${r.targetId}/delete`)}
                      >
                        Gỡ bài
                      </Button>
                    )}
                    {r.targetType === 'THREAD' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => act(`/api/mod/threads/${r.targetId}/lock`)}
                      >
                        Khoá chủ đề
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="teal"
                      onClick={() => act(`/api/mod/reports/${r.id}/resolve`, { action: 'resolve' })}
                    >
                      Đã xử lý
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(`/api/mod/reports/${r.id}/resolve`, { action: 'dismiss' })}
                    >
                      Bỏ qua
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-8">
              <SectionHeading eyebrow={`${listings.length} chờ duyệt`} title="Tin đăng chờ duyệt" />
              <div className="space-y-3">
                {listings.length === 0 && (
                  <Card className="p-6 text-center text-muted text-sm">
                    Không có tin đăng chờ duyệt.
                  </Card>
                )}
                {listings.map((l) => (
                  <Card key={l.id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-ink truncate">
                          {l.title}{' '}
                          <span className="font-mono text-brandink text-sm">
                            · {l.priceCredits} tín dụng
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          bởi {l.sellerName} · {l.category}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="teal"
                          onClick={() => act(`/api/mod/listings/${l.id}/approve`)}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => act(`/api/mod/listings/${l.id}/reject`)}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <SectionHeading eyebrow="Công cụ" title="Cấm thành viên" />
              <Card className="p-5">
                <div className="grid sm:grid-cols-[1fr_1fr_90px] gap-2">
                  <input
                    value={banUser}
                    onChange={(e) => setBanUser(e.target.value)}
                    placeholder="username"
                    className="rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
                  />
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="lý do"
                    className="rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
                  />
                  <input
                    value={banDays}
                    onChange={(e) => setBanDays(e.target.value)}
                    placeholder="ngày"
                    type="number"
                    className="rounded-lg border border-hairline bg-surface p-2.5 text-sm text-ink placeholder:text-muted focus:border-brand outline-none"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (
                        await act(`/api/mod/users/${banUser}/ban`, {
                          reason: banReason,
                          days: banDays ? Number(banDays) : null,
                        })
                      ) {
                        setMsg('✓ Đã cấm ' + banUser);
                        setBanUser('');
                        setBanReason('');
                        setBanDays('');
                      }
                    }}
                  >
                    Cấm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (await act(`/api/mod/users/${banUser}/unban`))
                        setMsg('✓ Đã bỏ cấm ' + banUser);
                    }}
                  >
                    Bỏ cấm
                  </Button>
                  <span className="text-xs text-muted self-center">
                    Để trống “ngày” = cấm vĩnh viễn
                  </span>
                </div>
              </Card>
            </div>
          </div>

          <aside>
            <SectionHeading eyebrow="Nhật ký" title="Hoạt động gần đây" />
            <Card className="p-2 space-y-1">
              {audit.length === 0 && (
                <div className="p-5 text-sm text-muted">Chưa có hoạt động.</div>
              )}
              {audit.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral" mono>
                      {ACTION_LABEL[a.action] || a.action}
                    </Badge>
                    <span className="text-xs text-muted">{timeAgo(a.createdAt)}</span>
                  </div>
                  <div className="text-sm text-inksoft mt-1 truncate">
                    {a.targetLabel || a.targetType} {a.note ? `· ${a.note}` : ''}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">bởi {a.moderatorName}</div>
                </div>
              ))}
            </Card>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
