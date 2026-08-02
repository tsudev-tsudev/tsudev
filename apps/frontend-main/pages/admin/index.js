import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, SectionHeading, Badge } from '@tsudev/ui';

export default function AdminHome() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/mod/summary')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Không có quyền');
        setSummary(d);
      })
      .catch((e) => setErr(e.message));
  }, [status]);

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
          <h1 className="text-2xl font-bold text-ink mb-2">Khu vực quản trị</h1>
          <p className="text-muted mb-4">
            Đăng nhập bằng tài khoản có quyền kiểm duyệt (ví dụ{' '}
            <code className="font-mono text-brandink">tsudev</code>).
          </p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  const tiles = summary
    ? [
        {
          label: 'Báo cáo chờ xử lý',
          value: summary.openReports,
          tone: summary.openReports > 0 ? 'warning' : 'neutral',
        },
        { label: 'Tài khoản bị cấm', value: summary.activeBans, tone: 'neutral' },
        { label: 'Bài đã gỡ', value: summary.deletedPosts, tone: 'neutral' },
        { label: 'Chủ đề bị khoá', value: summary.lockedThreads, tone: 'neutral' },
      ]
    : [];

  return (
    <Layout active="/admin" bare>
      <Head>
        <title>Quản trị — tsudev</title>
      </Head>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <SectionHeading
          eyebrow="Bảng điều khiển"
          title="Quản trị hệ thống"
          action={
            session && (
              <Badge tone="brand" mono>
                {session.user?.name}
              </Badge>
            )
          }
        />

        {err && (
          <Card
            className="p-6"
            style={{ backgroundColor: 'color-mix(in srgb, var(--error) 10%, var(--panel))' }}
          >
            <p className="text-[var(--error)] font-medium">⛔ {err}</p>
            <p className="text-muted text-sm mt-1">
              Tài khoản hiện tại không có quyền kiểm duyệt. Hãy đăng nhập bằng{' '}
              <code className="font-mono text-brandink">tsudev</code> /{' '}
              <code className="font-mono">devpass</code>.
            </p>
          </Card>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {tiles.map((t) => (
                <Card key={t.label} className="p-5">
                  <div
                    className={`text-3xl font-bold font-mono tabular-nums ${
                      t.tone === 'warning' ? 'text-[var(--warning)]' : 'text-ink'
                    }`}
                  >
                    {t.value}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted mt-1">{t.label}</div>
                </Card>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Card as="a" href="/admin/moderation" hover className="p-5 block group">
                <h3 className="font-semibold text-ink group-hover:text-brandink transition-colors">
                  Hàng chờ kiểm duyệt →
                </h3>
                <p className="text-sm text-muted mt-1">
                  Xử lý báo cáo, khoá/ghim chủ đề, gỡ bài, cấm thành viên.
                </p>
              </Card>
              <Card as="a" href="/admin/trust" hover className="p-5 block group">
                <h3 className="font-semibold text-ink group-hover:text-brandink transition-colors">
                  Con dấu tín nhiệm →
                </h3>
                <p className="text-sm text-muted mt-1">
                  Thẩm định hồ sơ, cấp/đình chỉ/thu hồi chứng chỉ, tái kiểm tên miền.
                </p>
              </Card>
              <Card className="p-5 opacity-60">
                <h3 className="font-semibold text-ink">Quản lý thành viên</h3>
                <p className="text-sm text-muted mt-1">Sắp có.</p>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
