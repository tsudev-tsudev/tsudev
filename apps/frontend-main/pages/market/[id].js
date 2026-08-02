import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Layout, Card, Button, Badge, Avatar } from '@tsudev/ui';
import { api } from '../../lib/api';

export default function ListingDetail({ listing }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!listing)
    return (
      <Layout>
        <Card className="p-8 text-center text-muted">Không tìm thấy tin đăng.</Card>
      </Layout>
    );

  async function buy() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/market/listings/${listing.id}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) router.push('/market/orders');
    else setMsg('⛔ ' + (d.error || 'Không mua được'));
  }

  const r = listing.sellerRating || { avg: null, count: 0 };
  return (
    <Layout active="/market" bare>
      <Head>
        <title>{listing.title} — Chợ tsudev</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <nav className="text-sm text-muted mb-4">
          <a href="/market" className="hover:text-brandink">
            Chợ
          </a>{' '}
          <span className="mx-1.5">/</span> <span className="text-inksoft">{listing.title}</span>
        </nav>
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="neutral" mono className="mb-2">
                {listing.category}
              </Badge>
              <h1 className="text-2xl font-bold text-ink">{listing.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-2xl font-bold text-brandink">
                {listing.priceCredits}
              </div>
              <div className="text-xs text-muted">tín dụng</div>
            </div>
          </div>
          <p className="mt-4 text-inksoft whitespace-pre-wrap">{listing.description}</p>
          <div className="mt-6 pt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar name={listing.sellerName} size={36} />
              <div>
                <div className="text-sm font-medium text-ink">{listing.sellerName}</div>
                <div className="text-xs text-muted">
                  {r.avg ? `★ ${r.avg} (${r.count} đánh giá)` : 'Chưa có đánh giá'}
                </div>
              </div>
            </div>
            {listing.status === 'ACTIVE' ? (
              session ? (
                <Button onClick={buy} disabled={busy}>
                  {busy ? 'Đang xử lý…' : `Mua với ${listing.priceCredits} tín dụng`}
                </Button>
              ) : (
                <Button onClick={() => signIn()}>Đăng nhập để mua</Button>
              )
            ) : (
              <Badge tone="warning">{listing.status === 'SOLD' ? 'Đã bán' : listing.status}</Badge>
            )}
          </div>
          {msg && <p className="mt-3 text-sm text-[var(--error)]">{msg}</p>}
          <p className="mt-4 text-xs text-muted">
            💡 Khi mua, tín dụng được giữ trong ký quỹ và chỉ chuyển cho người bán sau khi bạn xác
            nhận đã nhận hàng ở trang “Đơn của tôi”.
          </p>
        </Card>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  const listing = await api.listing(params.id);
  return { props: { listing } };
}
