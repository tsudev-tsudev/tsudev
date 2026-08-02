import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Badge, SectionHeading } from '@tsudev/ui';

const STATUS_TONE = { HELD: 'warning', RELEASED: 'success', REFUNDED: 'neutral' };
const STATUS_LABEL = { HELD: 'Đang ký quỹ', RELEASED: 'Đã hoàn tất', REFUNDED: 'Đã hoàn tiền' };

export default function Orders() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/market/orders');
    if (r.ok) setOrders(await r.json());
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
    const d = await r.json();
    if (!r.ok) setMsg('⛔ ' + (d.error || 'Lỗi'));
    else {
      setMsg('✓ ' + (d.message || 'Xong'));
      load();
    }
  }
  async function rate(id) {
    const v = window.prompt('Đánh giá người bán 1–5?');
    const n = parseInt(v);
    if (!(n >= 1 && n <= 5)) return;
    await act(`/api/market/orders/${id}/rate`, {
      rating: n,
      comment: window.prompt('Nhận xét (tuỳ chọn)?') || '',
    });
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
          <p className="text-inksoft mb-3">Đăng nhập để xem đơn.</p>
          <Button onClick={() => signIn()}>Đăng nhập</Button>
        </div>
      </Layout>
    );

  return (
    <Layout active="/market" bare>
      <Head>
        <title>Đơn của tôi — Chợ tsudev</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/market" className="hover:text-brandink">
            Chợ
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">Đơn của tôi</span>
        </nav>
        <SectionHeading eyebrow="Giao dịch" title="Đơn của tôi" />
        {msg && <Card className="p-3 mb-4 text-sm text-inksoft">{msg}</Card>}
        <div className="space-y-3">
          {orders.length === 0 && (
            <Card className="p-8 text-center text-muted">Chưa có giao dịch nào.</Card>
          )}
          {orders.map((o) => (
            <Card key={o.id} className="p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={o.role === 'buyer' ? 'brand' : 'teal'} mono>
                    {o.role === 'buyer' ? 'Mua' : 'Bán'}
                  </Badge>
                  <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  {o.rating && <span className="text-xs text-teal">★ {o.rating}</span>}
                </div>
                <div className="font-medium text-ink mt-1 truncate">{o.title}</div>
                <div className="text-xs text-muted">{o.amountCredits} tín dụng</div>
              </div>
              {o.role === 'buyer' && o.status === 'HELD' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="teal"
                    onClick={() => act(`/api/market/orders/${o.id}/release`)}
                  >
                    Đã nhận hàng
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(`/api/market/orders/${o.id}/refund`)}
                  >
                    Hoàn tiền
                  </Button>
                </div>
              )}
              {o.role === 'buyer' && o.status === 'RELEASED' && !o.rating && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => rate(o.id)}
                  className="shrink-0"
                >
                  Đánh giá
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
